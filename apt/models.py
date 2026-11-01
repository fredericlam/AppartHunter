from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Listing:
    source: str                 # "bienici", "leboncoin", "seloger", ...
    source_id: str              # unique within source
    url: str
    title: str = ""
    price: float | None = None  # €
    surface: float | None = None  # m²
    rooms: int | None = None
    bedrooms: int | None = None
    city: str = ""
    postal_code: str = ""
    lat: float | None = None
    lon: float | None = None
    location_precise: bool = False  # True = real GPS, False = city/arrondissement centroid
    published: str = ""         # ISO date the ad went online ("" = not given by the source)
    updated: str = ""           # ISO date of the source's last modification
    dpe: str = ""               # energy class A..G
    furnished: bool | None = None
    floor: int | None = None
    parking: int | None = None    # parking spaces (None = unknown)
    garage: bool | None = None    # closed garage / box
    colocation: bool = False
    bathrooms: int | None = None  # bathrooms + shower rooms
    features: list = field(default_factory=list)  # "ac", "cellar", "kitchen", "terrace", "balcony", "lift", "baths2"
    photo: str = ""
    description: str = ""
    # computed
    distance_km: float | None = None   # straight line to the farthest target
    commute_min: int | None = None     # estimated door-to-door minutes to the farthest target
    commute_mode: str = ""             # "walk" | "transit"
    near: list = field(default_factory=list)  # [{"line": "Metro D", "stop": "Sans Souci", "walk_min": 3}]
    score: float = 0.0
    dup_of: str | None = None
    extra: dict = field(default_factory=dict)

    @property
    def key(self) -> str:
        return f"{self.source}:{self.source_id}"

    @property
    def price_per_m2(self) -> float | None:
        if self.price and self.surface:
            return self.price / self.surface
        return None
