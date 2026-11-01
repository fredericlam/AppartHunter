from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

from .models import Listing


class DB:
    def __init__(self, path: str):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.c = sqlite3.connect(path)
        self.c.execute("""CREATE TABLE IF NOT EXISTS listings(
            key TEXT PRIMARY KEY, data TEXT, first_seen TEXT, last_seen TEXT, notified INTEGER DEFAULT 0)""")

    def upsert(self, listings: list[Listing], first_seen_hint: dict[str, str] | None = None) -> set[str]:
        """Store listings; return keys that were never seen before.
        first_seen_hint (key -> ISO date, from the previous JSON export) keeps "first seen" stable
        when the DB is fresh, e.g. in CI where only listings.json is persisted."""
        hint = first_seen_hint or {}
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        known = {k for (k,) in self.c.execute("SELECT key FROM listings")}
        new = set()
        for l in listings:
            data = json.dumps(asdict(l), ensure_ascii=False)
            if l.key in known:
                self.c.execute("UPDATE listings SET data=?, last_seen=? WHERE key=?", (data, now, l.key))
            else:
                self.c.execute("INSERT INTO listings(key,data,first_seen,last_seen) VALUES(?,?,?,?)",
                               (l.key, data, hint.get(l.key, now), now))
                if l.key not in hint:
                    new.add(l.key)
        self.c.commit()
        return new

    def current(self) -> list[tuple[Listing, str, str]]:
        """Listings seen during the latest run (= still online)."""
        (last,) = self.c.execute("SELECT max(last_seen) FROM listings").fetchone()
        if not last:
            return []
        rows = self.c.execute("SELECT data, first_seen, last_seen FROM listings WHERE last_seen >= ?",
                              (last[:16],))  # same run (minute precision)
        return [(Listing(**json.loads(d)), f, s) for d, f, s in rows]
