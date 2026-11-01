"""Your own favourites (SeLoger, Leboncoin...), kept in favorites.json at the repo root.

They are copied by hand (or by Claude reading your favourites page in your browser):
no request is made to those sites here. Favourites always pass the filters.
"""
from __future__ import annotations

import json
from pathlib import Path

from ..models import Listing


def fetch(cfg: dict) -> list[Listing]:
    path = Path((cfg["sources"].get("favorites") or {}).get("file", "favorites.json"))
    if not path.exists():
        return []
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
            parking=f.get("parking"),
            garage=f.get("garage"),
            photo=f.get("photo", ""),
            description=f.get("description", ""),
            features=list(f.get("features", [])),
            favorite=True,
            note=f.get("note", "") or (f"Area: {f['area']}" if f.get("area") else ""),
        ))
    print(f"  [favorites] {len(out)} from {path}")
    return out
