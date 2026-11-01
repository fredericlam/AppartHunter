import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Corridor, Listing, Target } from "./types";
import { num } from "./format";
import { HEART_SVG, SCHOOL_SVG } from "./icons";

interface Props {
  listings: Listing[];
  targets: Target[];
  idealMinutes: number;
  corridors: Corridor[];
  accent: string;
  dark: boolean;
  activeKey: string | null;
  onSelect: (key: string) => void;
}

// ~20 min walk ≈ 1.23 km straight line (see apt/geo.py)
const walkRadiusM = (minutes: number) => (minutes / 60) * 4.8 / 1.3 * 1000;

/** Approximate positions (neighbourhood centre): spread pins up to ~250 m around it, stable per listing. */
function spread(key: string, lat: number, lon: number): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const angle = ((h >>> 0) % 360) * (Math.PI / 180);
  const r = 0.0005 + (((h >>> 9) % 1000) / 1000) * 0.0018; // ≈ 50–250 m
  return [lat + r * Math.sin(angle), lon + (r * Math.cos(angle)) / Math.cos((lat * Math.PI) / 180)];
}

const LINE_COLOR = (name: string) => (name.includes("T4") ? "#7c5cbf" : "#2f9e5b");

export default function MapView({ listings, targets, idealMinutes, corridors, accent, dark, activeKey, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const fitted = useRef(false);

  // init once
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([45.749, 4.85], 14);
    L.control.zoom({ position: "bottomright" }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => { ro.disconnect(); m.remove(); map.current = null; };
  }, []);

  // basemap: Esri Light / Dark Gray Canvas (keyless, very quiet), follows the device theme
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
    const tone = dark ? "Dark" : "Light";
    const g = L.layerGroup([
      L.tileLayer(`${esri}World_${tone}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 19, maxNativeZoom: 16, attribution: "Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors",
      }),
      L.tileLayer(`${esri}World_${tone}_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 19, maxNativeZoom: 16 }),
    ]).addTo(m);
    return () => { g.remove(); };
  }, [dark]);

  // schools + walking radius
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = L.layerGroup().addTo(m);
    for (const t of targets) {
      L.circle([t.lat, t.lon], { radius: walkRadiusM(idealMinutes), color: accent, weight: 1.2,
        dashArray: "3 5", fill: true, fillOpacity: 0.06, interactive: false }).addTo(g);
      const label = t.name.split("—")[0].trim();
      L.marker([t.lat, t.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div class="school"><span class="school-icon">${SCHOOL_SVG}</span><span class="school-label">${label}</span></div>`,
          iconSize: null as unknown as L.PointExpression,
        }),
        zIndexOffset: 2000,
        keyboard: false,
      }).bindTooltip(t.name, { direction: "top", offset: [0, -24] }).addTo(g);
    }
    return () => { g.remove(); };
  }, [targets, idealMinutes, accent]);

  // corridors: line + stops + walking radius
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = L.layerGroup().addTo(m);
    for (const c of corridors) {
      const color = LINE_COLOR(c.name);
      L.polyline(c.stops.map((s) => [s.lat, s.lon] as L.LatLngTuple), { color, weight: 2, opacity: 0.5, interactive: false }).addTo(g);
      for (const s of c.stops) {
        L.circle([s.lat, s.lon], { radius: walkRadiusM(c.walk_minutes), color, weight: 0, fillOpacity: 0.07, interactive: false }).addTo(g);
        L.circleMarker([s.lat, s.lon], { radius: 4, color: dark ? "#18191c" : "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
          .bindTooltip(`${c.name} · ${s.name}`, { direction: "top", offset: [0, -4] }).addTo(g);
      }
    }
    return () => { g.remove(); };
  }, [corridors, dark]);

  // listing markers
  useEffect(() => {
    const m = map.current, lg = layer.current;
    if (!m || !lg) return;
    lg.clearLayers();
    markers.current.clear();
    const pts: L.LatLngExpression[] = [];
    for (const l of listings) {
      if (l.lat == null || l.lon == null) continue;
      const [lat, lon] = l.location_precise ? [l.lat, l.lon] : spread(l.key, l.lat, l.lon);
      const mk = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "",
          html: `<div class="pin${l.location_precise ? "" : " approx"}${l.favorite ? " fav" : ""}">${l.favorite ? HEART_SVG : ""}${num(l.price)}</div>`,
          iconSize: null as unknown as L.PointExpression, // size from CSS
        }),
        riseOnHover: true,
        zIndexOffset: l.favorite ? 1500 : 0,
      }).on("click", () => onSelect(l.key));
      mk.addTo(lg);
      markers.current.set(l.key, mk);
      pts.push([lat, lon]);
    }
    if (!fitted.current && pts.length) {
      for (const t of targets) pts.push([t.lat, t.lon]);
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [listings, targets, onSelect]);

  // highlight active
  useEffect(() => {
    markers.current.forEach((mk, key) => {
      const node = mk.getElement()?.firstElementChild;
      node?.classList.toggle("active", key === activeKey);
      const fav = listings.find((l) => l.key === key)?.favorite;
      mk.setZIndexOffset(key === activeKey ? 1800 : fav ? 1500 : 0);
    });
  }, [activeKey, listings]);

  return <div ref={el} className="map" />;
}
