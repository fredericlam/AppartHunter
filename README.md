# Lyon apartment hunter

Collects 3-room apartments around **Groupe scolaire Chevreul Lestonnac** (Lyon 7e), drops flatshares,
estimates the commute (walk or TCL) to school, ranks everything, and gives you a map + list report
and a notification when a good new one appears.

## Setup

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp config.example.yaml config.yaml     # then set max_price, rent/buy, school site(s)
.venv/bin/python run.py --open         # fetch, rank, open data/report.html
```

## Sources

| Source | How | Notes |
|---|---|---|
| **Bien'ici** | public JSON endpoint of their site | aggregates thousands of agencies (incl. most agency ads you see on SeLoger/Logic-Immo). GPS, parking/garage, flatshare flag. |
| **Leboncoin, SeLoger, PAP, Logic-Immo, Figaro Immo, Orpi, Century 21, Foncia…** | **their own e-mail alerts**, read from your mailbox | These sites block automated access (DataDome / Cloudflare), so the app never contacts them. Create a saved search with instant e-mail alerts on each one; the app reads those e-mails over IMAP (read-only). |

E-mail setup (Gmail): enable 2-step verification → create an *App password* →
`export APT_IMAP_PASSWORD='xxxx xxxx xxxx xxxx'` → set `email_alerts.enabled: true` and your address in `config.yaml`.
Check what gets extracted with `.venv/bin/python run.py emails`. Alert layouts vary: if a site's e-mails
parse badly, tweak the regexes at the top of `apt/sources/email_alerts.py`.

Tip for private-owner ads (Leboncoin, PAP): alerts let you see them minutes after posting, which is what
matters in Lyon's market.

## Ranking

Hard filters: 3 rooms, price, no colocation, commute ≤ `max_minutes` (30), parking/garage if set to `required`.
Score (0–100), weights in `config.yaml`: commute (biggest; within 20 min ranks first, then drops sharply),
price, €/m², parking, garage, freshness. Hover the score in the report to see the breakdown.

Commute is an **estimate** from straight-line distance (walk 4.8 km/h; TCL ≈ 10 min overhead + 18 km/h).
Check the real route on the TCL app for your shortlist.
With several school sites in `targets`, the commute is taken to the farthest one.

## Run automatically (macOS)

```sh
cp scheduling/com.lamf.apt-hunter.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.lamf.apt-hunter.plist
```
Runs at 8h, 11h, 14h, 17h and 20h, each time delayed by a random 0–20 min. Logs are in `data/run.log`.
Set `notify.ntfy_topic` to get push notifications on your phone (free [ntfy](https://ntfy.sh) app).

## Being a good citizen

Low volume (a few requests per run, random pauses, newest-first so it stops early), no proxy rotation,
no CAPTCHA solving. If a site answers 403/429 the run stops for that source instead of retrying.
