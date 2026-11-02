import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapView from "./MapView";
import { DEFAULT_FILTERS, type Commute, type Data, type Filters, type Listing, type Room, type Sort, type Target } from "./types";
import { ago, date, daysSince, duration, isNew, listedAt, num, price, realDate, shortDate, SOURCE_LABEL } from "./format";
import { Balcony, Bath, Cellar, Heart, Kitchen, Lift, Snow, Sun, Users } from "./icons";
import { Area, Bed, Bookmark, Calendar, Car, Door, Euro, External, Eye, EyeOff, MapIcon, Parking, Pin, Refresh, Route, Sofa, Stairs, Transit, Walk } from "./icons";
import { PALETTES, type PaletteId, useTheme } from "./theme";

type Marks = Record<string, "saved" | "hidden">;

function useMarks() {
  const [marks, setMarks] = useState<Marks>(() => JSON.parse(localStorage.getItem("apt-marks") || "{}"));
  const toggle = useCallback((key: string, v: "saved" | "hidden") =>
    setMarks((m) => {
      const n = { ...m };
      if (n[key] === v) delete n[key]; else n[key] = v;
      localStorage.setItem("apt-marks", JSON.stringify(n));
      return n;
    }), []);
  return [marks, toggle] as const;
}

function matches(l: Listing, f: Filters, marks: Marks, showHidden: boolean) {
  if (marks[l.key] === "hidden" && !showHidden) return false;
  if (f.onlySaved && marks[l.key] !== "saved") return false;
  if (!f.flatshares && l.colocation) return false;
  if (l.favorite) return true; // your own favourites ignore the other filters
  if (f.rooms.length) {
    const size = roomKey(l.rooms);
    if (!size || !f.rooms.includes(size)) return false;
  }
  if (f.commute !== "any") {
    const nearSchool = l.commute_min != null && l.commute_min <= f.commute;
    const nearLine = (l.near ?? []).some((n) => f.lines.includes(n.line));
    if (!nearSchool && !nearLine) return false;
  }
  if (f.maxPrice && l.price && l.price > f.maxPrice) return false;
  if (f.parking && !l.parking) return false;
  if (f.garage && !l.garage) return false;
  if (f.onlyNew && !isNew(l)) return false;
  return true;
}

const roomKey = (n: number | null): Room | null => (n == null ? null : n >= 5 ? "5+" : n === 4 ? "4" : n === 3 ? "3" : null);
/** "Best match" shows T4 first, then T3, then T5+ — each group ranked by score. */
const ROOM_PRIORITY: Record<string, number> = { "4": 0, "3": 1, "5+": 2 };
const roomRank = (l: Listing) => ROOM_PRIORITY[roomKey(l.rooms) ?? ""] ?? 3;

const SORTS: Record<Sort, (a: Listing, b: Listing) => number> = {
  best: (a, b) => roomRank(a) - roomRank(b) || b.score - a.score,
  commute: (a, b) => (a.commute_min ?? 999) - (b.commute_min ?? 999),
  price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
  newest: (a, b) => listedAt(b).localeCompare(listedAt(a)),
};

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [marks, toggleMark] = useMarks();
  const theme = useTheme();
  const [showHidden, setShowHidden] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);
  const [, tick] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/listings.json?t=${Date.now()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`listings.json: HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5 * 60_000); // pick up scheduled runs
    const clock = setInterval(() => tick((n) => n + 1), 60_000); // keep "x min ago" fresh
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/refresh", { method: "POST" });
      if (r.status === 404) setError("Refresh is only available with `npm run dev`. Run `python run.py` instead.");
      else if (!r.ok) setError("Check failed — see terminal output.");
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const all = data?.listings ?? [];
  const visible = useMemo(
    () => all.filter((l) => matches(l, filters, marks, showHidden)).sort(SORTS[filters.sort]),
    [all, filters, marks, showHidden]);
  const hiddenCount = useMemo(() => all.filter((l) => marks[l.key] === "hidden").length, [all, marks]);
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  const select = useCallback((key: string) => {
    setActive(key);
    document.getElementById(`card-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const stale = data?.last_check ? Date.now() - new Date(data.last_check).getTime() > 12 * 3600_000 : true;
  const failed = Object.entries(data?.sources ?? {}).filter(([, s]) => !s.ok);

  return (
    <div className={`app${mapOpen ? "" : " nomap"}`}>
      <header className="top">
        <div className="brand">
          <span className="mark" />
          <span>Apartments</span>
          <span className="muted">near {data?.targets.map((t) => t.name.split("—")[0].trim()).join(" & ") || "…"}</span>
        </div>
        <div className="status">
          <span className={`dot${stale ? " warn" : ""}`} />
          <span className="muted" title={data?.last_check ? new Date(data.last_check).toLocaleString("fr-FR") : ""}>
            Last check {ago(data?.last_check ?? null)}
          </span>
          {import.meta.env.DEV ? (
            <button className="btn ghost" onClick={refresh} disabled={refreshing}>
              <Refresh spin={refreshing} /> {refreshing ? "Checking…" : "Check now"}
            </button>
          ) : import.meta.env.VITE_UPDATE_URL ? (
            // Static hosting can't run the fetcher: open the GitHub workflow ("Run workflow").
            // The site redeploys by itself a few minutes after it finishes.
            <a className="btn ghost" href={import.meta.env.VITE_UPDATE_URL} target="_blank" rel="noreferrer"
              title="Updates run automatically 4× a day. Opens GitHub → Run workflow.">
              <Refresh /> Check now
            </a>
          ) : null}
          <div className="palettes" role="radiogroup" aria-label="Colour palette">
            {(Object.keys(PALETTES) as PaletteId[]).map((id) => (
              <button key={id} role="radio" aria-checked={theme.palette === id} title={PALETTES[id].name}
                className={`swatch${theme.palette === id ? " on" : ""}`}
                style={{ "--sw": PALETTES[id][theme.dark ? "dark" : "light"] } as React.CSSProperties}
                onClick={() => theme.setPalette(id)} />
            ))}
          </div>
          <button className={`btn ghost icon${mapOpen ? " on" : ""}`} onClick={() => setMapOpen((o) => !o)} title="Toggle map">
            <MapIcon />
          </button>
        </div>
      </header>

      <div className="filters">
        <div className="seg" role="group" aria-label="Rooms">
          <span className="seg-label">Rooms</span>
          <div className="seg-track">
            {(["3", "4", "5+"] as Room[]).map((r) => (
              <button key={r} className={filters.rooms.includes(r) ? "on" : ""} aria-pressed={filters.rooms.includes(r)}
                onClick={() => set("rooms", filters.rooms.includes(r) ? filters.rooms.filter((x) => x !== r) : [...filters.rooms, r].sort())}>
                T{r}
              </button>
            ))}
            <button className={filters.rooms.length === 0 ? "on" : ""} onClick={() => set("rooms", [])}>All</button>
          </div>
        </div>
        <Segmented label="To school" value={filters.commute} onChange={(v) => set("commute", v)}
          options={[[15, "15 min"], [20, "20 min"], [30, "30 min"], ["any", "Any"]] as [Commute, string][]} />
        {(data?.corridors?.length ?? 0) > 0 && (
          <div className="seg">
            <span className="seg-label">or 5 min from</span>
            {data!.corridors!.map((c) => (
              <Chip key={c.name} on={filters.lines.includes(c.name)} line={c.name}
                onClick={() => set("lines", filters.lines.includes(c.name)
                  ? filters.lines.filter((x) => x !== c.name) : [...filters.lines, c.name])}>
                {c.name}
              </Chip>
            ))}
          </div>
        )}
        <label className="field">
          <span>Max</span>
          <input type="number" inputMode="numeric" step={50} placeholder="—" value={filters.maxPrice ?? ""}
            onChange={(e) => set("maxPrice", e.target.value ? Number(e.target.value) : null)} />
          <span className="muted">€</span>
        </label>
        <Chip on={filters.parking} onClick={() => set("parking", !filters.parking)}>Parking</Chip>
        <Chip on={filters.garage} onClick={() => set("garage", !filters.garage)}>Garage</Chip>
        <Chip on={filters.onlyNew} onClick={() => set("onlyNew", !filters.onlyNew)}>New</Chip>
        <Chip on={filters.onlySaved} onClick={() => set("onlySaved", !filters.onlySaved)}>Saved</Chip>
        <Chip on={filters.flatshares} onClick={() => set("flatshares", !filters.flatshares)}>Flatshares</Chip>
        <div className="spacer" />
        {!isDefault && <button className="link" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset</button>}
        <select className="sort" value={filters.sort} onChange={(e) => set("sort", e.target.value as Sort)}>
          <option value="best">Best match</option>
          <option value="commute">Closest</option>
          <option value="price">Lowest price</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <main className="body">
        <section className="list" ref={listRef}>
          <div className="count">
            <b>{visible.length}</b> <span className="muted">of {all.length} listings</span>
            {hiddenCount > 0 && (
              <button className="link" onClick={() => setShowHidden((s) => !s)}>
                {showHidden ? "Hide" : "Show"} {hiddenCount} hidden
              </button>
            )}
          </div>
          {error && <div className="notice">{error}</div>}
          {failed.map(([name, s]) => (
            <div className="notice" key={name}>{SOURCE_LABEL[name] ?? name} failed on last check: {s.error}</div>
          ))}
          {!data && !error && <div className="empty">Loading…</div>}
          {data && visible.length === 0 && (
            <div className="empty">
              Nothing matches these filters.
              {filters.commute !== "any" && filters.commute < 30 && (
                <button className="link" onClick={() => set("commute", 30)}>Widen to 30 min</button>
              )}
            </div>
          )}
          {visible.map((l) => (
            <Card key={l.key} l={l} mark={marks[l.key]} active={active === l.key} school={data?.targets[0]}
              onHover={setActive} onToggle={toggleMark} ideal={data?.commute.ideal_minutes ?? 20} />
          ))}
        </section>
        {mapOpen && data && (
          <aside className="mapwrap">
            <MapView listings={visible} targets={data.targets} idealMinutes={data.commute.ideal_minutes}
              corridors={data.corridors ?? []} accent={theme.accent} dark={theme.dark}
              activeKey={active} onSelect={select} />
          </aside>
        )}
      </main>
    </div>
  );
}

function Segmented<T extends string | number>({ label, value, options, onChange }:
  { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div className="seg-track">
        {options.map(([v, text]) => (
          <button key={String(v)} className={v === value ? "on" : ""} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export const lineClass = (line: string) => (line.includes("T4") ? "l-t4" : line.includes("D") ? "l-d" : "");

function Chip({ on, onClick, children, line }:
  { on: boolean; onClick: () => void; children: React.ReactNode; line?: string }) {
  return (
    <button className={`chip${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}>
      {line && <span className={`line-dot ${lineClass(line)}`} />}{children}
    </button>
  );
}

function Card({ l, mark, active, ideal, school, onHover, onToggle }: {
  l: Listing; mark?: "saved" | "hidden"; active: boolean; ideal: number; school?: Target;
  onHover: (k: string | null) => void; onToggle: (k: string, v: "saved" | "hidden") => void;
}) {
  const [imgOk, setImgOk] = useState(true);
  const near = l.commute_min != null && l.commute_min <= ideal;
  const specs: [React.ReactNode, string][] = [];
  if (l.rooms) specs.push([<Door />, `T${l.rooms}`]);
  if (l.bedrooms) specs.push([<Bed />, `${l.bedrooms} bedroom${l.bedrooms > 1 ? "s" : ""}`]);
  if (l.surface) specs.push([<Area />, `${num(l.surface)} m²`]);
  if (l.floor != null) specs.push([<Stairs />, l.floor === 0 ? "Ground floor" : `Floor ${l.floor}`]);
  if (l.furnished) specs.push([<Sofa />, "Furnished"]);

  return (
    <article id={`card-${l.key}`} className={`card${active ? " active" : ""}${mark === "hidden" ? " dim" : ""}`}
      onMouseEnter={() => onHover(l.key)} onMouseLeave={() => onHover(null)}>
      <a className="photo" href={l.url} target="_blank" rel="noreferrer">
        {l.photo && imgOk ? <img src={l.photo} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
          : <div className="nophoto" />}
        {isNew(l) && <span className="badge">New</span>}
      </a>
      <div className="info">
        <div className="row">
          <div className="price">
            {price(l.price)}<span className="muted"> /month{l.colocation ? " · often per room" : ""}</span>
            {l.charges ? <span className="muted small"> · incl. {num(l.charges)} € charges</span> : null}
          </div>
          <Sources l={l} />
          <div className="actions">
            <button className={`icon-btn${mark === "saved" ? " on" : ""}`} title="Save" onClick={() => onToggle(l.key, "saved")}>
              <Bookmark filled={mark === "saved"} />
            </button>
            <button className="icon-btn" title={mark === "hidden" ? "Unhide" : "Hide"} onClick={() => onToggle(l.key, "hidden")}>
              {mark === "hidden" ? <Eye /> : <EyeOff />}
            </button>
            <a className="icon-btn" href={l.url} target="_blank" rel="noreferrer" title="Open listing"><External /></a>
          </div>
        </div>
        <div className="specs">
          {specs.map(([icon, text]) => <span key={text} className="spec">{icon}{text}</span>)}
        </div>
        <div className="where">
          {l.commute_min != null ? (
            <span className={`commute${near ? " near" : ""}`}>
              {l.commute_mode === "walk" ? <Walk /> : <Transit />}
              {l.location_precise ? "" : "~"}{l.commute_min} min {l.commute_mode === "walk" ? "walk" : "by transit"}
            </span>
          ) : <span className="muted">location unknown</span>}
          <Located l={l} />
          <GmapsLinks l={l} school={school} />
        </div>
        {(l.near ?? []).length > 0 && (
          <div className="where">
            {l.near.map((n) => (
              <span key={n.line} className="station">
                <span className={`line-dot ${lineClass(n.line)}`} />
                {n.stop} <span className="muted">· {n.walk_min} min walk</span>
              </span>
            ))}
          </div>
        )}
        <Dates l={l} />
        <Tags l={l} />
        <div className="foot">
          {l.price_per_m2 && <span className="spec muted small"><Euro />{l.price_per_m2.toFixed(1).replace(".", ",")} €/m²</span>}
          <span className="spacer" />
          <span className="score" title={Object.entries(l.score_parts).map(([k, v]) => `${k} ${Math.round(v * 100)}`).join("\n")}>
            {Math.round(l.score)}
          </span>
        </div>
      </div>
    </article>
  );
}

const OLD_AFTER_DAYS = 45;

function Dates({ l }: { l: Listing }) {
  const published = realDate(l.published);
  const updated = realDate(l.updated);
  const upd = updated && <span className="muted"> · updated {shortDate(updated)}</span>;
  if (published) {
    const days = daysSince(published);
    return (
      <div className={`dates${days > OLD_AFTER_DAYS ? " old" : ""}`}>
        <Calendar />Online since {date(published)} · <b>{duration(days)}</b>{upd}
      </div>
    );
  }
  return (
    <div className="dates muted">
      <Calendar />Publication date not given · tracked since {date(l.first_seen)}{upd}
    </div>
  );
}

/** Where the position comes from: exact address read in the ad, ~150 m, or only a zone (highlighted). */
function Located({ l }: { l: Listing }) {
  const place = [l.city, l.postal_code].filter(Boolean).join(" ");
  if (!l.location_precise)
    return (
      <span className="zone-badge" title="Exact address unknown: the listing only gives this area. Hover to see the zone on the map.">
        <Pin /> Zone · {l.geo?.label || place}
      </span>
    );
  if (l.geo?.level === "address" || l.geo?.level === "street")
    return <span className="addr" title="Address read in the listing text">{l.geo.label || place}</span>;
  return <span className="muted">{place}</span>;
}

/** Google Maps: the listing's position (exact point when known, else its area) + transit route to school. */
function GmapsLinks({ l, school }: { l: Listing; school?: Target }) {
  const area = [l.postal_code, l.city].filter(Boolean).join(" ");
  const exact = l.geo?.level === "address" || l.geo?.level === "street";
  const here = exact && l.geo?.label ? l.geo.label : l.location_precise && l.lat != null ? `${l.lat},${l.lon}` : area;
  if (!here) return null;
  const q = encodeURIComponent(here);
  const place = `https://www.google.com/maps/search/?api=1&query=${q}`;
  const route = school &&
    `https://www.google.com/maps/dir/?api=1&origin=${q}&destination=${school.lat},${school.lon}&travelmode=transit`;
  return (
    <span className="gmaps">
      <a href={place} target="_blank" rel="noreferrer"
        title={exact ? "Address written in the listing" : l.location_precise ? "Position given by the listing, within ~150 m (agencies hide the exact address)" : "Exact position not given: shows the area"}>
        <Pin /> Google Maps
      </a>
      {route && <a href={route} target="_blank" rel="noreferrer" title="Real public-transport route to school"><Route /> Route to school</a>}
    </span>
  );
}

const FEATURES: Record<string, [React.ReactNode, string]> = {
  ac: [<Snow />, "Air con"],
  cellar: [<Cellar />, "Cellar"],
  kitchen: [<Kitchen />, "Fitted kitchen"],
  terrace: [<Sun />, "Terrace"],
  balcony: [<Balcony />, "Balcony"],
  lift: [<Lift />, "Lift"],
  baths2: [<Bath />, "2+ bathrooms"],
};

function Tags({ l }: { l: Listing }) {
  const feats = (l.features ?? []).filter((f) => f in FEATURES);
  if (!l.favorite && !l.colocation && !l.garage && !l.parking && feats.length === 0) return null;
  const favOn = l.also_on.find((a) => a.source !== "bienici")?.source ?? (l.source !== "bienici" ? l.source : "");
  return (
    <div className="tags">
      {l.favorite && (
        <span className="tag fav">
          <Heart />Your {SOURCE_LABEL[favOn] ?? ""} favourite{l.note ? ` · ${l.note}` : ""}
        </span>
      )}
      {l.colocation && (
        <span className="tag coloc" title="Listed as a flatshare: the price is often per room. Ask the agency whether you can rent the whole flat.">
          <Users />Flatshare · ask for whole flat
        </span>
      )}
      {l.garage ? <span className="tag"><Car />Garage</span> : l.parking ? <span className="tag"><Parking />Parking</span> : null}
      {feats.map((f) => <span key={f} className="tag">{FEATURES[f][0]}{FEATURES[f][1]}</span>)}
    </div>
  );
}

/** Every site this flat is published on (same flat merged across sites), each linking to its ad. */
function Sources({ l }: { l: Listing }) {
  const seen = new Set<string>();
  const all = [{ source: l.source, url: l.url }, ...l.also_on].filter((s) => !seen.has(s.source) && seen.add(s.source));
  const order = ["seloger", "bienici", "leboncoin"];
  all.sort((a, b) => (order.indexOf(a.source) + 1 || 9) - (order.indexOf(b.source) + 1 || 9));
  return (
    <div className="sources" aria-label="Published on">
      {all.map((s) => (
        <a key={s.source} className={`src src-${s.source}`} href={s.url} target="_blank" rel="noreferrer"
          title={`Open on ${SOURCE_LABEL[s.source] ?? s.source}`}>
          {SOURCE_LABEL[s.source] ?? s.source}
        </a>
      ))}
    </div>
  );
}
