"""Shared, polite HTTP client: one browser-like UA, timeouts, retries with backoff, random pauses."""
from __future__ import annotations

import random
import time

import httpx

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")

_client: httpx.Client | None = None


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6"},
            timeout=25,
            follow_redirects=True,
        )
    return _client


def get(url: str, *, params=None, headers=None, retries: int = 3) -> httpx.Response:
    """GET with backoff. Stops immediately on 403/429 (= we're unwelcome, don't insist)."""
    last: Exception | None = None
    for attempt in range(retries):
        try:
            r = client().get(url, params=params, headers=headers)
            if r.status_code in (403, 429):
                raise PermissionError(f"{url} answered {r.status_code} — backing off, not retrying")
            r.raise_for_status()
            return r
        except PermissionError:
            raise
        except Exception as e:  # network / 5xx
            last = e
            time.sleep(2 ** attempt * 3 + random.random() * 2)
    raise RuntimeError(f"GET {url} failed: {last}")


def pause(bounds: tuple[float, float] | list[float]) -> None:
    time.sleep(random.uniform(*bounds))
