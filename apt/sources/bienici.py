"""Bien'ici — public JSON endpoint used by their own website. Aggregates thousands of agencies."""
from __future__ import annotations

import json

from .. import http
from ..models import Listing

API = "https://www.bienici.com/realEstateAds.json"
SUGGEST = "https://res.bienici.com/suggest.json"
PAGE_SIZE = 50


def zone_ids(cities: list[str]) -> list[str]:
    ids: list[str] = []
    for c in cities:
        res = http.get(SUGGEST, params={"q": c}).json()
        city = next((z for z in res if z.get("type") == "city"), res[0] if res else None)
        if not city:
            print(f"  [bienici] unknown city: {c}")
            continue
        ids += city["zoneIds"]
    return ids


def build_filters(search: dict, zones: list[str], page: int) -> dict:
    f: dict = {
        "size": PAGE_SIZE,
        "from": (page - 1) * PAGE_SIZE,
        "page": page,
        "filterType": search.get("transaction", "rent"),
        "propertyType": search.get("property_types", ["flat"]),
        "sortBy": "publicationDate",
        "sortOrder": "desc",
        "onTheMarket": [True],
        "zoneIdsByTypes": {"zoneIds": zones},
    }
    for ours, theirs in [("min_price", "minPrice"), ("max_price", "maxPrice"),
                         ("min_rooms", "minRooms"), ("max_rooms", "maxRooms")]:
        if search.get(ours) is not None:
            f[theirs] = search[ours]
    return f


def to_listing(a: dict) -> Listing:
    pos = (a.get("blurInfo") or {}).get("position") or {}
    photos = a.get("photos") or []
    return Listing(
        source="bienici",
        source_id=a["id"],
        url=f"https://www.bienici.com/annonce/{a['id']}",
        title=a.get("title") or "",
        price=a.get("price") if isinstance(a.get("price"), (int, float)) else None,
        surface=a.get("surfaceArea"),
        rooms=a.get("roomsQuantity"),
        bedrooms=a.get("bedroomsQuantity"),
        city=a.get("city") or "",
        postal_code=a.get("postalCode") or "",
        lat=pos.get("lat"),
        lon=pos.get("lon"),
        location_precise=bool(pos) and (a.get("blurInfo") or {}).get("radius", 999) <= 300,
        published="" if (a.get("publicationDate") or "1970").startswith("1970") else a["publicationDate"],
        dpe=(a.get("energyClassification") or "").upper(),
        furnished=a.get("isFurnished"),
        floor=a.get("floor"),
        parking=(a.get("parkingPlacesQuantity") or 0) + (a.get("enclosedParkingQuantity") or 0)
                or (0 if "parkingPlacesQuantity" in a else None),
        garage=bool(a.get("enclosedParkingQuantity")) or None,
        colocation=bool(a.get("flatSharing")),
        photo=(photos[0].get("url") if photos else "") or "",
        description=(a.get("description") or "")[:1500],
        extra={"charges": a.get("charges"), "agency": a.get("accountType")},
    )


def fetch(cfg: dict) -> list[Listing]:
    src = cfg["sources"]["bienici"]
    search = cfg["search"]
    zones = zone_ids(search.get("cities") or ["Lyon"])
    out: list[Listing] = []
    for page in range(1, src.get("max_pages", 5) + 1):
        if page > 1:
            http.pause(src.get("delay_seconds", [3, 8]))
        data = http.get(API, params={"filters": json.dumps(build_filters(search, zones, page))},
                        headers={"Accept": "application/json"}).json()
        ads = data.get("realEstateAds") or []
        out += [to_listing(a) for a in ads]
        print(f"  [bienici] page {page}: {len(ads)} ads (total matching: {data.get('total')})")
        if len(ads) < PAGE_SIZE:
            break
    return out
