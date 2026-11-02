export interface Listing {
  key: string;
  source: string;
  url: string;
  title: string;
  price: number | null;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  city: string;
  postal_code: string;
  lat: number | null;
  lon: number | null;
  location_precise: boolean;
  published: string;
  updated?: string;
  furnished: boolean | null;
  floor: number | null;
  parking: number | null;
  garage: boolean | null;
  colocation?: boolean;
  bathrooms?: number | null;
  features?: string[];
  favorite?: boolean;    // saved by you on SeLoger / Leboncoin
  note?: string;   // "ac" | "cellar" | "kitchen" | "terrace" | "balcony" | "lift" | "baths2"
  photo: string;
  description: string;
  distance_km: number | null;
  commute_min: number | null;
  commute_mode: "walk" | "transit" | "";
  near: { line: string; stop: string; walk_min: number }[];
  score: number;
  first_seen: string;
  last_seen: string;
  price_per_m2: number | null;
  charges: number | null;
  also_on: { source: string; url: string }[];
  score_parts: Record<string, number>;
  /** how well the position is known: exact address / street (read in the ad text), ~150 m, or only a zone */
  geo?: { level: "address" | "street" | "near" | "zone"; label: string; radius_m?: number } | null;
}

export interface Target { name: string; lat: number; lon: number }
export interface Corridor { name: string; walk_minutes: number; stops: Target[] }

export interface Data {
  last_check: string | null;
  sources: Record<string, { ok: boolean; count?: number; error?: string }>;
  targets: Target[];
  commute: { ideal_minutes: number; max_minutes: number };
  corridors?: Corridor[];
  listings: Listing[];
}

/** Room sizes to show (cumulative). Empty = all sizes. */
export type Room = "3" | "4" | "5+";
export type Commute = 15 | 20 | 30 | "any";
export type Sort = "best" | "commute" | "price" | "newest";

export interface Filters {
  rooms: Room[];
  commute: Commute;
  lines: string[];          // corridor lines that also qualify (OR with the school commute)
  maxPrice: number | null;
  parking: boolean;
  garage: boolean;
  onlyNew: boolean;
  onlySaved: boolean;
  flatshares: boolean;      // include flatshare ads (3+ rooms)
  sort: Sort;
}

export const DEFAULT_FILTERS: Filters = {
  rooms: ["3", "4"],
  commute: 20,
  lines: ["Metro D", "Tram T4"],
  maxPrice: null,
  parking: false,
  garage: false,
  onlyNew: false,
  onlySaved: false,
  flatshares: true,
  sort: "best",
};
