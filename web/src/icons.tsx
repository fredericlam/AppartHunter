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
