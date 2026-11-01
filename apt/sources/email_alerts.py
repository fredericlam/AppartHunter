"""Read listing alert e-mails (Leboncoin, SeLoger, PAP, Logic-Immo, Figaro Immo, Bien'ici...) over IMAP.

No request is ever sent to those sites: we only read e-mails they chose to send you.
Parsing is heuristic (each site's e-mail layout differs and changes): for every link that
looks like a listing we take the surrounding "card" text and extract price / m² / rooms / city.
Run `python run.py emails --debug` to see what gets extracted from your actual e-mails.
"""
from __future__ import annotations

import email
import hashlib
import imaplib
import os
import re
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from urllib.parse import parse_qs, unquote, urlparse

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from ..models import Listing

# domain fragment -> (source name, regex a listing URL must match)
SITES = {
    "leboncoin.fr": ("leboncoin", re.compile(r"leboncoin\.fr/(ad/|[a-z_]+/\d+)")),
    "seloger.com": ("seloger", re.compile(r"seloger\.com/annonces/")),
    "pap.fr": ("pap", re.compile(r"pap\.fr/annonces?/")),
    "logic-immo.com": ("logicimmo", re.compile(r"logic-immo\.com/(detail|annonce)")),
    "lefigaro.fr": ("figaroimmo", re.compile(r"immobilier\.lefigaro\.fr/annonces/annonce-")),
    "bienici.com": ("bienici", re.compile(r"bienici\.com/annonce/")),
    "laforet.com": ("laforet", re.compile(r"laforet\.com/agence-immobiliere/.+/(louer|acheter)/")),
    "orpi.com": ("orpi", re.compile(r"orpi\.com/annonce-")),
    "century21.fr": ("century21", re.compile(r"century21\.fr/trouver_logement/detail/")),
    "foncia.com": ("foncia", re.compile(r"foncia\.com/(location|achat)/.+\d+\.htm")),
    "jinka.fr": ("jinka", re.compile(r"jinka\.fr/.*(ad|alert)")),
}
SENDER_HINTS = list(SITES) + ["seloger", "leboncoin", "logic-immo"]

RE_PRICE = re.compile(r"(\d{1,3}(?:[   .]\d{3})+|\d{3,7})\s?(?:€|eur)", re.I)
RE_SURF = re.compile(r"(\d{1,4}(?:[.,]\d{1,2})?)\s?m(?:²|2)\b", re.I)
RE_ROOMS = re.compile(r"(\d{1,2})\s?(?:pièces?|pieces?|p\.?)(?=\W|$)|\bT(\d)\b|\bF(\d)\b", re.I)
RE_BED = re.compile(r"(\d)\s?(?:chambres?|ch\.)(?=\W|$)", re.I)
RE_CP = re.compile(r"\b(69\d{3})\b")
RE_ARR = re.compile(r"Lyon\s?(\d{1,2})(?:e|er|ème|eme)?\b", re.I)
RE_CITY = re.compile(r"\b(Lyon|Villeurbanne|Caluire[- ]et[- ]Cuire|Vénissieux|Bron|Oullins|"
                     r"Sainte?-Foy-l[eè]s-Lyon|Tassin|Écully|Ecully|Vaulx-en-Velin|Saint-Fons)\b", re.I)


def _unwrap(href: str) -> str:
    """Follow common tracker patterns that embed the real URL in a query parameter."""
    for _ in range(3):
        q = parse_qs(urlparse(href).query)
        for k in ("url", "u", "redirect", "target", "dest", "destination", "link"):
            if k in q and q[k][0].startswith("http"):
                href = unquote(q[k][0])
                break
        else:
            return href
    return href


def _site_for(url: str):
    host = urlparse(url).netloc.lower()
    for dom, (name, rx) in SITES.items():
        if dom in host and rx.search(url):
            return name
    return None


def _num(s: str) -> float:
    return float(re.sub(r"[   .]", "", s).replace(",", "."))


def _card_text(node) -> str:
    """Climb from the link to the smallest ancestor that contains a price."""
    cur, best = node, node.text(separator=" ", strip=True)
    for _ in range(8):
        cur = cur.parent
        if cur is None:
            break
        t = cur.text(separator=" ", strip=True)
        if len(t) > 700:
            break
        best = t
        if RE_PRICE.search(t) and RE_SURF.search(t):
            break
    return best


def parse_html(html: str, sender: str = "") -> list[Listing]:
    tree = HTMLParser(html)
    seen: dict[str, Listing] = {}
    for a in tree.css("a[href]"):
        url = _unwrap(a.attributes.get("href") or "")
        site = _site_for(url)
        if not site:
            continue
        url = url.split("#")[0]
        if site != "leboncoin":  # strip tracking params; lbc ids are in the path anyway
            url = url.split("?")[0]
        text = _card_text(a)
        prev = seen.get(url)
        if prev and len(prev.description) >= len(text):
            continue
        lst = Listing(source=site, source_id=hashlib.sha1(url.encode()).hexdigest()[:16], url=url,
                      title=(a.text(strip=True) or text)[:140], description=text[:700])
        if m := RE_PRICE.search(text):
            lst.price = _num(m.group(1))
        if m := RE_SURF.search(text):
            lst.surface = _num(m.group(1))
        if m := RE_ROOMS.search(text):
            lst.rooms = int(next(g for g in m.groups() if g))
        if m := RE_BED.search(text):
            lst.bedrooms = int(m.group(1))
        if m := RE_CP.search(text):
            lst.postal_code = m.group(1)
        if m := RE_ARR.search(text):
            arr = int(m.group(1))
            if 1 <= arr <= 9:
                lst.city, lst.postal_code = f"Lyon {arr}e", lst.postal_code or f"6900{arr}"
        if not lst.city and (m := RE_CITY.search(text)):
            lst.city = m.group(1)
        seen[url] = lst
    # keep only links that look like real listing cards (have at least a price or surface)
    return [l for l in seen.values() if l.price or l.surface]


def _decode(s) -> str:
    return str(make_header(decode_header(s or "")))


def fetch(cfg: dict, debug: bool = False) -> list[Listing]:
    c = cfg["sources"]["email_alerts"]
    pwd = os.environ.get(c.get("password_env", "APT_IMAP_PASSWORD"))
    if not pwd:
        raise RuntimeError(f"set the {c.get('password_env')} environment variable (IMAP app password)")
    since = (datetime.now() - timedelta(days=c.get("days_back", 7))).strftime("%d-%b-%Y")
    out: list[Listing] = []
    with imaplib.IMAP4_SSL(c["imap_host"]) as M:
        M.login(c["username"], pwd)
        M.select(c.get("folder", "INBOX"), readonly=True)
        _, data = M.search(None, f'(SINCE "{since}")')
        ids = data[0].split()
        for mid in ids:
            _, hdr = M.fetch(mid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            h = email.message_from_bytes(hdr[0][1])
            sender = _decode(h.get("From")).lower()
            if not any(s in sender for s in SENDER_HINTS):
                continue
            _, raw = M.fetch(mid, "(BODY.PEEK[])")
            msg = email.message_from_bytes(raw[0][1])
            for part in msg.walk():
                if part.get_content_type() == "text/html":
                    html = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", "replace")
                    found = parse_html(html, sender)
                    try:
                        date = email.utils.parsedate_to_datetime(h.get("Date")).isoformat()
                    except Exception:
                        date = ""
                    for l in found:
                        l.published = l.published or date
                    if debug:
                        print(f"\n--- {_decode(h.get('Subject'))}  <{sender}>  -> {len(found)} listings")
                        for l in found:
                            print(f"   {l.source:10} {l.price!s:>8}€ {l.surface!s:>6}m² {l.rooms!s:>2}p "
                                  f"{l.city or l.postal_code:14} {l.url[:90]}")
                    out += found
    print(f"  [email] {len(out)} listings from alert e-mails")
    return out
