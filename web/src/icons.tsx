// Minimal 16px stroke icons (1.5px), inherit currentColor.
const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const Bookmark = ({ filled = false }: { filled?: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"}><path d="M6 3h12v18l-6-4-6 4z" /></svg>);
export const EyeOff = () => (
  <svg {...base}><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a13 13 0 01-3.2 4.2M6.6 6.6A13 13 0 002 12c1 2.5 5 7 10 7a9.7 9.7 0 004.4-1" /></svg>);
export const Eye = () => (
  <svg {...base}><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>);
export const External = () => (
  <svg {...base}><path d="M7 17L17 7M9 7h8v8" /></svg>);
export const Walk = () => (
  <svg {...base}><circle cx="13" cy="4" r="1.6" /><path d="M10 21l2-6-2-3 1-5 3 3 3 1M8 10l2-3M14 15l2 6" /></svg>);
export const Transit = () => (
  <svg {...base}><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8 21l2-4M16 21l-2-4" /><circle cx="9" cy="14" r=".6" fill="currentColor" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></svg>);
export const Refresh = ({ spin = false }: { spin?: boolean }) => (
  <svg {...base} className={spin ? "spin" : undefined}><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" /></svg>);
export const MapIcon = () => (
  <svg {...base}><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14" /></svg>);
export const Pin = () => (
  <svg {...base} width={13} height={13}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" /></svg>);
export const Door = () => (
  <svg {...base}><path d="M4 21h16M6 21V4a1 1 0 011-1h10a1 1 0 011 1v17" /><circle cx="14.5" cy="12.5" r=".8" fill="currentColor" /></svg>);
export const Bed = () => (
  <svg {...base}><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 00-3-3h-7v5" /><circle cx="7" cy="11" r="2" /></svg>);
export const Area = () => (
  <svg {...base}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const Stairs = () => (
  <svg {...base}><path d="M3 20h5v-5h5v-5h5V5h3" /></svg>);
export const Sofa = () => (
  <svg {...base}><path d="M5 11V8a2 2 0 012-2h10a2 2 0 012 2v3M3 13a2 2 0 014 0v2h10v-2a2 2 0 014 0v5H3zM6 18v2M18 18v2" /></svg>);
export const Car = () => (
  <svg {...base}><path d="M5 16V11l2-5h10l2 5v5M3 16h18v2H3zM5 11h14" /><circle cx="8" cy="14" r=".7" fill="currentColor" /><circle cx="16" cy="14" r=".7" fill="currentColor" /></svg>);
export const Parking = () => (
  <svg {...base}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M10 16V8h3a2.5 2.5 0 010 5h-3" /></svg>);
export const Calendar = () => (
  <svg {...base}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>);
export const Route = () => (
  <svg {...base}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7.5a3.5 3.5 0 000-7h-7a3.5 3.5 0 010-7H16" /></svg>);
export const Euro = () => (
  <svg {...base}><path d="M17 6.5A6.5 6.5 0 0011 5a7 7 0 000 14 6.5 6.5 0 006-1.5M4 10h9M4 14h9" /></svg>);
export const Heart = () => (
  <svg {...base} fill="currentColor" strokeWidth={0}><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" /></svg>);
/** Raw SVG (for Leaflet markers, which take HTML strings). */
export const SCHOOL_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5L12 4.5l10 5-10 5z"/><path d="M6 11.5V16c0 1.2 2.7 3 6 3s6-1.8 6-3v-4.5"/><path d="M22 9.5v5"/></svg>`;
export const HEART_SVG = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>`;
export const Snow = () => (
  <svg {...base}><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5" /></svg>);
export const Cellar = () => (
  <svg {...base}><path d="M4 9l8-5 8 5v11H4zM9 20v-6h6v6" /></svg>);
export const Kitchen = () => (
  <svg {...base}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M8 6h.01M11 6h.01M9 13h6" /></svg>);
export const Sun = () => (
  <svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const Balcony = () => (
  <svg {...base}><path d="M3 12h18M5 12v8M9 12v8M15 12v8M19 12v8M3 20h18M8 12V5a1 1 0 011-1h6a1 1 0 011 1v7" /></svg>);
export const Lift = () => (
  <svg {...base}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9.5 9L12 6.5 14.5 9M9.5 15l2.5 2.5 2.5-2.5" /></svg>);
export const Bath = () => (
  <svg {...base}><path d="M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4zM6 12V6a2 2 0 014 0M7 19l-1 2M17 19l1 2" /></svg>);
export const Users = () => (
  <svg {...base}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M16 5a3 3 0 010 6M21 20a6 6 0 00-4-5.6" /></svg>);
