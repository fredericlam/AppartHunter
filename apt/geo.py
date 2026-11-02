"""Geocoding via the French government API (free, no key) + distance helpers, with a disk cache."""
from __future__ import annotations

import json
import math
from pathlib import Path

from . import http

CACHE = Path("data/geocache.json")
_cache: dict[str, list[float] | None] | None = None


def _load() -> dict:
    global _cache
    if _cache is None:
        _cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    return _cache


def geocode(query: str) -> tuple[float, float] | None:
    """Return (lat, lon) for a French address / city / postcode, or None."""
    cache = _load()
    if query in cache:
        v = cache[query]
        return tuple(v) if v else None
    r = http.get("https://api-adresse.data.gouv.fr/search/", params={"q": query, "limit": 1})
    feats = r.json().get("features") or []
    res = None
    if feats:
        lon, lat = feats[0]["geometry"]["coordinates"]
        res = (lat, lon)
    cache[query] = list(res) if res else None
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    return res


def geocode_address(query: str, postcode: str = "") -> dict | None:
    """Street-level geocoding: {'lat','lon','level': 'address'|'street','label'} or None.
    Rejects weak matches and results outside the listing's postcode."""
    cache = _load()
    ck = f"addr|{query}|{postcode}"
    if ck in cache:
        return cache[ck]
    params = {"q": query, "limit": 1}
    if postcode:
        params["postcode"] = postcode
    r = http.get("https://api-adresse.data.gouv.fr/search/", params=params)
    feats = r.json().get("features") or []
    res = None
    if feats:
        f = feats[0]
        p = f["properties"]
        if p.get("score", 0) >= 0.55 and p.get("type") in ("housenumber", "street") \
                and (not postcode or p.get("postcode") == postcode):
            lon, lat = f["geometry"]["coordinates"]
            res = {"lat": lat, "lon": lon, "label": p.get("label", ""),
                   "level": "address" if p["type"] == "housenumber" else "street"}
    cache[ck] = res
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    return res


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


DETOUR = 1.3  # real street distance ≈ 1.3 × straight line in Lyon


def walk_minutes(km: float) -> int:
    return round(km * DETOUR / 4.8 * 60)


def transit_minutes(km: float) -> int:
    """Rough TCL metro/tram/bus estimate: ~10 min fixed (walk to stop, wait, walk from stop)
    + ride at ~18 km/h average. Good to ±5 min on main lines; worse where no direct line."""
    return round(10 + km * DETOUR / 18 * 60)


def commute(km: float) -> tuple[int, str]:
    w, t = walk_minutes(km), transit_minutes(km)
    return (w, "walk") if w <= t else (t, "transit")
