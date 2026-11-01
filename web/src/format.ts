const eur = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const price = (v: number | null) => (v == null ? "—" : `${eur.format(v)} €`);
export const num = (v: number | null) => (v == null ? "?" : eur.format(v));

export function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [u, n] of units) if (Math.abs(s) >= n) return rtf.format(Math.round(s / n), u);
  return "just now";
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
export const date = (iso: string) => dateFmt.format(new Date(iso));
export const shortDate = (iso: string) => shortFmt.format(new Date(iso));
export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);

/** "3 days", "5 weeks", "4 months" */
export function duration(days: number): string {
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days > 1 ? "s" : ""}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30.4)} months`;
}

export const realDate = (iso?: string) => (iso && !iso.startsWith("1970") ? iso : "");

/** Listing date: publication date when real, else when we first saw it. */
export const listedAt = (l: { published: string; first_seen: string }) =>
  l.published && !l.published.startsWith("1970") ? l.published : l.first_seen;

export const isNew = (l: { first_seen: string }) => Date.now() - new Date(l.first_seen).getTime() < 36 * 3600 * 1000;

export const SOURCE_LABEL: Record<string, string> = {
  bienici: "Bien'ici", leboncoin: "Leboncoin", seloger: "SeLoger", pap: "PAP", logicimmo: "Logic-Immo",
  figaroimmo: "Figaro Immo", orpi: "Orpi", century21: "Century 21", foncia: "Foncia", laforet: "Laforêt", jinka: "Jinka",
};
