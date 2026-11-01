"""Locate → filter → dedupe → score."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from . import geo
from .models import Listing

CENTROID_SLACK_MIN = 8  # arrondissement-level positions are fuzzy: be lenient


def locate(listings: list[Listing], targets: list[tuple[float, float]], corridors: list[dict] = ()) -> None:
    """Position each listing, then compute distance/commute to the *farthest* target
    (every child must be able to get to school)."""
    for l in listings:
        if l.lat is None:
            q = " ".join(x for x in [l.postal_code, l.city] if x)
            if q:
                pos = geo.geocode(q if "lyon" in q.lower() or l.postal_code else f"{q} 69")
                if pos:
                    l.lat, l.lon = pos
                    l.location_precise = False
        if l.lat is not None:
            l.distance_km = round(max(geo.haversine_km(t, (l.lat, l.lon)) for t in targets), 2)
            l.commute_min, l.commute_mode = geo.commute(l.distance_km)
        l.near = near_stations(l, corridors) if l.location_precise else []


def near_stations(l: Listing, corridors) -> list[dict]:
    """Closest stop of each corridor line, if within its walking limit (precise positions only:
    an arrondissement centroid can't tell whether a flat is 5 min from a station)."""
    out = []
    for c in corridors:
        best = min(((geo.haversine_km((l.lat, l.lon), (s["lat"], s["lon"])), s["name"]) for s in c["stops"]),
                   default=None)
        if best and geo.walk_minutes(best[0]) <= c.get("walk_minutes", 5):
            out.append({"line": c["name"], "stop": best[1], "walk_min": max(1, geo.walk_minutes(best[0]))})
    return out


RE_COLOC = re.compile(r"\bcolocation\b|\bcoloc\b|chambre (?:dans|en) (?:une )?coloc", re.I)
RE_PARKING = re.compile(r"\b(parking|place de stationnement|stationnement privatif)\b", re.I)
RE_GARAGE = re.compile(r"\bgarage\b(?! ?(?:à|a|pour|de)? ?(?:vélos?|velos?|2 roues|deux roues))"
                       r"|\bbox\b(?! ?(?:internet|fibre|adsl|tv|wifi|vélos?|velos?))", re.I)
RE_NEGATION = re.compile(r"(?:pas de|sans|aucun|ni)\s+(?:\w+\s+)?$", re.I)


def _mentions(rx: re.Pattern, text: str) -> bool:
    """True if rx matches somewhere not preceded by a negation ("pas de parking", "sans garage")."""
    return any(not RE_NEGATION.search(text[max(0, m.start() - 20):m.start()]) for m in rx.finditer(text))


def enrich_from_text(l: Listing) -> None:
    """Fill parking / garage / colocation from the listing text when the source doesn't say."""
    text = f"{l.title} {l.description}"
    if RE_COLOC.search(text):
        l.colocation = True
    if not l.garage and _mentions(RE_GARAGE, text):
        l.garage = True
    if not l.parking and (l.garage or _mentions(RE_PARKING, text)):
        l.parking = max(1, l.parking or 0)


def keep(l: Listing, s: dict, max_minutes: int) -> bool:
    if l.colocation and s.get("exclude_colocation", True):
        return False
    if s.get("max_price") and l.price and l.price > s["max_price"]:
        return False
    if s.get("min_price") and l.price and l.price < s["min_price"]:
        return False
    if s.get("min_rooms") and l.rooms and l.rooms < s["min_rooms"]:
        return False
    if s.get("max_rooms") and l.rooms and l.rooms > s["max_rooms"]:
        return False
    if s.get("parking") == "required" and not l.parking:
        return False
    if s.get("garage") == "required" and not l.garage:
        return False
    if l.commute_min is not None and not l.near:  # near a corridor station = always in scope
        slack = 0 if l.location_precise else CENTROID_SLACK_MIN
        if l.commute_min > max_minutes + slack:
            return False
    return True


def dedupe(listings: list[Listing]) -> None:
    """Mark the same flat posted on several sites. Precise-location listings win as 'primary'."""
    ordered = sorted(listings, key=lambda l: (not l.location_precise, -len(l.description)))
    primaries: list[Listing] = []
    for l in ordered:
        for p in primaries:
            if p.source == l.source or not (l.price and p.price and l.surface and p.surface):
                continue
            same_area = (l.postal_code and l.postal_code == p.postal_code) or (
                l.distance_km is not None and p.distance_km is not None
                and abs(l.distance_km - p.distance_km) < 0.6)
            if same_area and abs(l.price - p.price) <= 0.03 * p.price and abs(l.surface - p.surface) <= 1.5:
                l.dup_of = p.key
                p.extra.setdefault("also_on", []).append({"source": l.source, "url": l.url})
                break
        else:
            primaries.append(l)


def _age_days(iso: str) -> float | None:
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - d).total_seconds() / 86400
    except Exception:
        return None


def score(listings: list[Listing], cfg: dict) -> None:
    w = cfg["scoring"]
    c = cfg["commute"]
    ideal, maxm = c["ideal_minutes"], c["max_minutes"]
    s = cfg["search"]
    ppm = sorted(l.price_per_m2 for l in listings if l.price_per_m2)
    prices_by_rooms: dict = {}
    for l in listings:  # compare a T4's rent with other T4s, not with T3s
        if l.price:
            prices_by_rooms.setdefault(l.rooms, []).append(l.price)

    def rank_low(v, arr):  # 1 = lowest of the batch
        if not arr or v is None:
            return 0.5
        return 1 - sum(1 for x in arr if x < v) / max(1, len(arr) - 1)

    def commute_score(m):
        if m is None:
            return 0.4
        if m <= ideal:   # inside the 20-min zone: 0.75 → 1 (closer still better)
            return 1 - 0.25 * m / ideal
        return max(0.0, 0.6 * (1 - (m - ideal) / max(1, maxm - ideal)))  # cliff after ideal

    def want(pref, have):  # "required" was already filtered in keep()
        return 0.5 if pref == "any" else (1.0 if have else 0.0)

    for l in listings:
        parts = {
            "commute": commute_score(l.commute_min) * (1 if l.location_precise else 0.9),
            "price": rank_low(l.price, sorted(prices_by_rooms.get(l.rooms, []))),
            "price_per_m2": rank_low(l.price_per_m2, ppm),
            "parking": want(s.get("parking", "preferred"), l.parking),
            "garage": want(s.get("garage", "any"), l.garage),
            "freshness": 0.5 if (a := _age_days(l.published)) is None else max(0.0, 1 - a / 14),
        }
        total_w = sum(w.get(k, 0) for k in parts) or 1
        l.score = round(100 * sum(parts[k] * w.get(k, 0) for k in parts) / total_w, 1)
        l.extra["score_parts"] = {k: round(v, 2) for k, v in parts.items() if w.get(k)}
