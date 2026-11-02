"""SeLoger results read from YOUR browser (by Claude, on request), saved in seloger_scan.txt.

No request is ever made to SeLoger from here: this only parses the saved card texts.
Cards only give the neighbourhood; seloger_details.json (each ad page, also read in your browser)
adds the full description, features and creation date, from which the pipeline takes the address.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ..models import Listing

URL = "https://www.seloger.com/annonce/location/auvergne-rhone-alpes/rhone-69/lyon-69000/{id}"

# Neighbourhood centres (OpenStreetMap), as named on SeLoger cards
QUARTIERS = {
    "part-dieu": (45.75787, 4.8556),
    "la villette": (45.76019, 4.86651),
    "sans souci": (45.74998, 4.86861),
    "monplaisir": (45.74273, 4.86836),
    "girondins": (45.73995, 4.83412),
    "le grand trou": (45.73394, 4.85365),
}

RE_PRICE = re.compile(r"([\d   ]+(?:,\d+)?)\s*€/mois")
RE_ROOMS = re.compile(r"(\d+)\s*pièces?")
RE_BEDS = re.compile(r"(\d+)\s*chambres?")
RE_SURF = re.compile(r"([\d]+(?:,\d+)?)\s*m²")
RE_FLOOR = re.compile(r"(\d+)(?:er|ème)\s+étage|Étage\s+(\d+)/|\b(RDC)\b")
RE_PLACE = re.compile(r"([^|]+?),\s*Lyon\s*(\d)(?:er|ème)\s+arrondissement\s*\((\d{5})\)")
RE_DPE = re.compile(r"^[A-G]$")


def _num(s: str) -> float:
    return float(re.sub(r"[\s  ]", "", s).replace(",", "."))


def parse_line(line: str) -> dict | None:
    parts = [p.strip() for p in line.split("¦")]
    if len(parts) < 3:
        return None
    sid, photo, text = parts[0], parts[1], " ¦ ".join(parts[2:])
    fields = [f.strip() for f in text.split("|")]
    d: dict = {"id": sid, "photo": photo, "text": text}
    if m := RE_PRICE.search(text):
        d["price"] = _num(m.group(1))
    if m := RE_ROOMS.search(text):
        d["rooms"] = int(m.group(1))
    if m := RE_BEDS.search(text):
        d["bedrooms"] = int(m.group(1))
    if m := RE_SURF.search(text):
        d["surface"] = _num(m.group(1))
    if m := RE_FLOOR.search(text):
        d["floor"] = 0 if m.group(3) else int(m.group(1) or m.group(2))
    if m := RE_PLACE.search(text):
        d["quartier"], d["arr"], d["postal_code"] = m.group(1).strip(), m.group(2), m.group(3)
    d["dpe"] = next((f for f in fields if RE_DPE.match(f)), "")
    d["colocation"] = "Colocation à louer" in text
    d["exclusive"] = "Exclusivité" in fields
    d["private"] = "Particulier" in fields
    kind = next((f for f in fields if "à louer" in f), "Appartement à louer")
    place_idx = next((i for i, f in enumerate(fields) if RE_PLACE.search(f)), None)
    tail = [f for f in fields[place_idx + 1:] if f != "Exclusivité"] if place_idx is not None else []
    d["agency"] = "Particulier" if d["private"] else (tail[-1] if tail else "")
    d["title"] = " · ".join(x for x in [kind, d["agency"], "Exclusivité" if d["exclusive"] else ""] if x)
    return d


RE_COUNT = re.compile(r"^(\d+)\s+Salles? d(?:e bains?|['’]eau|e douche)", re.I)


def apply_details(l: Listing, det: dict) -> None:
    """Merge what the ad page says (description, feature list, dates) into the card listing."""
    feats = det.get("features") or []
    if det.get("desc"):
        l.description = f"{det['desc']}\n{l.description}"
    if feats:  # "Ascenseur", "Pas de cave", "Balcon"… : the text matcher already handles negations
        l.description += "\nCaractéristiques : " + ". ".join(feats) + "."
    baths = sum(int(m.group(1)) for f in feats if (m := RE_COUNT.match(f)))
    if baths:
        l.bathrooms = baths
        if baths >= 2 and "baths2" not in l.features:
            l.features.append("baths2")
    if any(f.lower() == "meublé" for f in feats):
        l.furnished = True
    l.published = det.get("created") or l.published
    l.updated = det.get("updated") or l.updated


def fetch(cfg: dict) -> list[Listing]:
    c = cfg["sources"].get("seloger_scan") or {}
    path = Path(c.get("file", "seloger_scan.txt"))
    if not path.exists():
        return []
    raw = path.read_text(encoding="utf-8")
    scanned = re.search(r"#\s*scanned:\s*(\S+)", raw)
    scanned_at = scanned.group(1) if scanned else ""
    if scanned_at:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(scanned_at).replace(tzinfo=timezone.utc)
        if age > timedelta(days=c.get("max_age_days", 21)):
            print(f"  [seloger_scan] {path} is {age.days} days old — ignored (ask Claude to rescan)")
            return []
    rows = [d for line in raw.splitlines() if line.strip() and not line.startswith("#") if (d := parse_line(line))]
    # lazy-loaded cards share a placeholder picture: ignore photos used on several cards
    shared = {p for p, n in Counter(d["photo"] for d in rows).items() if n > 1}
    fav_ids = set()
    fav_file = Path((cfg["sources"].get("favorites") or {}).get("file", "favorites.json"))
    if fav_file.exists():
        fav_ids = {f["url"].split("?")[0].rstrip("/").rsplit("/", 1)[-1] for f in json.loads(fav_file.read_text())}
    det_file = Path(c.get("details_file", "seloger_details.json"))
    details = json.loads(det_file.read_text()) if det_file.exists() else {}
    out = []
    for d in rows:
        if d["id"] in fav_ids:  # your favourites carry richer data
            continue
        det = details.get(d["id"]) or {}
        if det.get("gone"):  # ad removed since the scan
            continue
        pos = QUARTIERS.get(d.get("quartier", "").lower())
        out.append(Listing(
            source="seloger", source_id=d["id"], url=URL.format(id=d["id"]), title=d["title"],
            price=d.get("price"), surface=d.get("surface"), rooms=d.get("rooms"), bedrooms=d.get("bedrooms"),
            city=f"Lyon {d['arr']}e" if d.get("arr") else "Lyon", postal_code=d.get("postal_code", ""),
            lat=pos[0] if pos else None, lon=pos[1] if pos else None, location_precise=False,
            floor=d.get("floor"), dpe=d["dpe"], colocation=d["colocation"],
            photo="" if d["photo"] in shared else d["photo"],
            description=f"Quartier {d.get('quartier', '?')}. {d['text']}",
            note=d.get("quartier", ""),
            extra={"geo": {"level": "zone", "label": f"{d.get('quartier', '?')} ({d.get('postal_code', '')})",
                           "radius_m": 600}},
        ))
        apply_details(out[-1], det)
    print(f"  [seloger_scan] {len(out)} cards from {path} (scanned {scanned_at}), {len(details)} ad pages read")
    return out
