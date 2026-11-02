"""Your own favourites (SeLoger, Leboncoin...), kept in favorites.json at the repo root.

They are copied by hand (or by Claude reading your favourites page in your browser):
no request is made to those sites here. Favourites always pass the filters.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..models import Listing
from . import seloger_scan


def fetch(cfg: dict) -> list[Listing]:
    path = Path((cfg["sources"].get("favorites") or {}).get("file", "favorites.json"))
    if not path.exists():
        return []
    det_file = Path((cfg["sources"].get("seloger_scan") or {}).get("details_file", "seloger_details.json"))
    details = json.loads(det_file.read_text()) if det_file.exists() else {}
    out = []
    for f in json.loads(path.read_text()):
        url = f["url"].split("?")[0]
        out.append(Listing(
            source=f.get("source", "manual"),
            source_id=url.rstrip("/").rsplit("/", 1)[-1],
            url=url,
            title=f.get("title", ""),
            price=f.get("price"),
            surface=f.get("surface"),
            rooms=f.get("rooms"),
            bedrooms=f.get("bedrooms"),
            city=f.get("city", ""),
            postal_code=f.get("postal_code", ""),
            lat=f.get("lat"),
            lon=f.get("lon"),
            location_precise=bool(f.get("precise")),  # neighbourhood-level unless told otherwise
            published=f.get("published", ""),
            floor=f.get("floor"),
            furnished=f.get("furnished"),
            parking=f.get("parking"),
            garage=f.get("garage"),
            photo=f.get("photo", ""),
            description=f.get("description", ""),
            features=list(f.get("features", [])),
            extra={"charges": f["charges"]} if f.get("charges") else {},
            favorite=True,
            note=f.get("note", "") or (f"Area: {f['area']}" if f.get("area") else ""),
        ))
        if out[-1].source == "seloger" and (det := details.get(out[-1].source_id)):
            seloger_scan.apply_details(out[-1], det)
    print(f"  [favorites] {len(out)} from {path}")
    return out
