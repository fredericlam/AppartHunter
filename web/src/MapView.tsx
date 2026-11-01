import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Corridor, Listing, Target } from "./types";
import { num } from "./format";

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
      L.marker([t.lat, t.lon], {
        icon: L.divIcon({ className: "", html: `<div class="pin-school" title="${t.name}"></div>`, iconSize: [14, 14] }),
        zIndexOffset: 1000,
      }).bindTooltip(t.name, { direction: "top", offset: [0, -8] }).addTo(g);
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
      const mk = L.marker([l.lat, l.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div class="pin${l.location_precise ? "" : " approx"}">${num(l.price)}</div>`,
          iconSize: null as unknown as L.PointExpression, // size from CSS
        }),
        riseOnHover: true,
      }).on("click", () => onSelect(l.key));
      mk.addTo(lg);
      markers.current.set(l.key, mk);
      pts.push([l.lat, l.lon]);
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
      mk.setZIndexOffset(key === activeKey ? 900 : 0);
    });
  }, [activeKey, listings]);

  return <div ref={el} className="map" />;
}
