# AppartHunter — Lyon

Finds T3–T5 apartments around **Groupe scolaire Chevreul Lestonnac** (Lyon 7e), excludes flatshares,
estimates the commute (walk or TCL) to school, ranks them, and shows them in a minimal web app
(default view: **T4 / 3 bedrooms, ≤ 20 min**).

```
GitHub Actions (4×/day) ── python run.py ──► web/public/listings.json ──commit──► Netlify rebuilds the site
```

## Deploy (GitHub + Netlify)

1. Push this repo to GitHub (already wired to `fredericlam/AppartHunter`).
2. **GitHub → Settings → Actions → General → Workflow permissions → "Read and write permissions"** (lets the
   workflow commit the updated listings).
3. **Netlify → Add new site → Import an existing project → GitHub → AppartHunter.**
   Everything is read from `netlify.toml`: no settings to type. Deploy.
4. Optional: **GitHub → Actions → Update listings → Run workflow** to trigger a first check right away.

After that, listings are refreshed at ≈ 7h, 11h, 15h, 19h (Lyon time). On the site, the **Check now**
button opens that GitHub page, so you can start an update by hand; the site redeploys about 2 min after it finishes.
If a check fails (a site blocks the request, for example), the site keeps the previous listings and shows a notice.

## Run locally

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python run.py          # fetch → web/public/listings.json
cd web && npm install && npm run dev   # http://localhost:5180 — "Check now" runs the fetcher directly
```

Settings (school sites, rooms, budget, cities, score weights) are in `config.yaml`.

## Sources

| Source | How | Notes |
|---|---|---|
| **Bien'ici** | public JSON endpoint of their site | aggregates thousands of agencies (incl. most agency ads also on SeLoger/Logic-Immo). GPS, parking/garage, flatshare flag. |
| **Leboncoin, SeLoger, PAP, Logic-Immo, Figaro Immo, Orpi, Century 21, Foncia…** | **their own e-mail alerts**, read from your mailbox | These sites block automated access, so the app never contacts them. Save a search with instant e-mail alerts on each site; the app reads those e-mails over IMAP (read-only). |

E-mail alerts setup (Gmail): enable 2-step verification → create an *App password* → set `email_alerts.enabled: true`
and your address in `config.yaml` → add the app password as a **GitHub secret** named `APT_IMAP_PASSWORD`
(Settings → Secrets and variables → Actions). Locally: `export APT_IMAP_PASSWORD=...` then
`.venv/bin/python run.py emails` to see what gets extracted.

## Ranking

Hard filters: 3–5 rooms, max price, no colocation, commute ≤ 30 min.
Score (0–100; hover it in the app for the breakdown): commute (within 20 min ranks first), price compared with
listings that have the same number of rooms, parking, garage, €/m², freshness.

Commute is an **estimate** from straight-line distance (walking at 4.8 km/h; TCL ≈ 10 min to reach and wait at the stop + 18 km/h).
Check the real route in the TCL app for your shortlist. With several school sites in `targets`, the farthest one counts.

## Good citizen

Few requests per run, random pauses and start time, newest listings first. No proxy rotation, no CAPTCHA solving.
If a site answers 403/429, that source is skipped for the run instead of retried.
The site is marked `noindex` so search engines don't list it.
