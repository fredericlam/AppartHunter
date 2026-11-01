#!/usr/bin/env python3
"""Lyon apartment hunter — fetches listings and writes the JSON cache read by the web app.

  python run.py               # fetch all sources, rank, write web/public/listings.json
  python run.py --jitter 1200 # same, after a random 0-1200 s delay (scheduled runs)
  python run.py export        # rewrite the JSON from the local DB only (no network)
  python run.py emails        # show what is extracted from your alert e-mails
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import yaml

from apt import geo, pipeline
from apt.db import DB
from apt.sources import bienici, email_alerts, favorites, seloger_scan

SOURCES = {"bienici": bienici.fetch, "favorites": favorites.fetch, "seloger_scan": seloger_scan.fetch,
           "email_alerts": email_alerts.fetch}
DROP_FIELDS = {"extra", "dup_of"}


def load_cfg(path: str) -> dict:
    p = Path(path)
    if not p.exists():
        sys.exit(f"{path} not found")
    return yaml.safe_load(p.read_text())


def targets_of(cfg: dict) -> list[tuple[float, float]]:
    out = []
    for t in cfg["targets"]:
        pos = (t["lat"], t["lon"]) if t.get("lat") is not None else geo.geocode(t["address"])
        if not pos:
            sys.exit(f"could not geocode target address: {t['address']}")
        out.append(pos)
    return out


def previous_export(cfg: dict) -> dict:
    p = Path(cfg["output"]["json"])
    return json.loads(p.read_text()) if p.exists() else {}


def export(cfg: dict, db: DB, targets, status: dict, keep_previous_listings: bool = False) -> None:
    out_path = Path(cfg["output"]["json"])
    previous = previous_export(cfg)
    listings = []
    for l, first_seen, last_seen in db.current():
        if l.dup_of:
            continue
        d = {k: v for k, v in asdict(l).items() if k not in DROP_FIELDS}
        d.update(key=l.key, first_seen=first_seen, last_seen=last_seen, price_per_m2=l.price_per_m2,
                 charges=l.extra.get("charges"), also_on=l.extra.get("also_on", []),
                 score_parts=l.extra.get("score_parts", {}))
        listings.append(d)
    listings.sort(key=lambda d: -d["score"])
    if keep_previous_listings:  # a failed run must never wipe what the site shows
        listings = previous.get("listings", [])
    doc = {
        "last_check": status.get("last_check") or previous.get("last_check"),
        "sources": status.get("sources") or previous.get("sources", {}),
        "targets": [{"name": t["name"], "lat": p[0], "lon": p[1]} for t, p in zip(cfg["targets"], targets)],
        "commute": cfg["commute"],
        "corridors": cfg.get("corridors") or [],
        "listings": listings,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False))
    tmp.replace(out_path)  # atomic: the app never reads a half-written file
    print(f"wrote {out_path} ({len(listings)} listings)")


def run(cfg: dict) -> None:
    targets = targets_of(cfg)
    listings, sources = [], {}
    for name, fetch in SOURCES.items():
        if not (cfg["sources"].get(name) or {}).get("enabled"):
            continue
        try:
            got = fetch(cfg)
            listings += got
            sources[name] = {"ok": True, "count": len(got)}
        except Exception as e:  # one broken source must not kill the run
            print(f"  [{name}] FAILED: {e}")
            sources[name] = {"ok": False, "error": str(e)[:200]}

    pipeline.locate(listings, targets, cfg.get("corridors") or [])
    for l in listings:
        pipeline.enrich_from_text(l)
    kept = [l for l in listings if pipeline.keep(l, cfg["search"], cfg["commute"]["max_minutes"])]
    pipeline.dedupe(kept)
    pipeline.score(kept, cfg)
    print(f"{len(listings)} fetched → {len(kept)} match ({sum(1 for l in kept if l.dup_of)} cross-site duplicates)")

    previous = previous_export(cfg)
    db = DB(cfg["output"]["db"])
    new = db.upsert(kept, {l["key"]: l["first_seen"] for l in previous.get("listings", [])})
    print(f"{len(new)} new")
    failed = not kept and any(not s["ok"] for s in sources.values())
    if failed:
        print("no listings and a source failed — keeping the previous listings")
    export(cfg, db, targets, {"last_check": previous.get("last_check") if failed
                              else datetime.now(timezone.utc).isoformat(timespec="seconds"),
                              "sources": sources}, keep_previous_listings=failed)
    if failed:
        sys.exit(1)  # make the scheduled job show as failed


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", nargs="?", default="run", choices=["run", "export", "emails"])
    ap.add_argument("-c", "--config", default="config.yaml")
    ap.add_argument("--jitter", type=int, default=0, help="random initial delay in seconds")
    a = ap.parse_args()
    cfg = load_cfg(a.config)
    if a.jitter:
        time.sleep(random.uniform(0, a.jitter))
    if a.cmd == "export":
        export(cfg, DB(cfg["output"]["db"]), targets_of(cfg), {})
    elif a.cmd == "emails":
        email_alerts.fetch(cfg, debug=True)
    else:
        run(cfg)


if __name__ == "__main__":
    main()
