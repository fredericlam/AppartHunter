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

export const isNew = (l: { first_seen: string }) => Date.now() - new Date(l.first_seen).getTime() < 36 * 3600 * 1000;

export const SOURCE_LABEL: Record<string, string> = {
  bienici: "Bien'ici", leboncoin: "Leboncoin", seloger: "SeLoger", pap: "PAP", logicimmo: "Logic-Immo",
  figaroimmo: "Figaro Immo", orpi: "Orpi", century21: "Century 21", foncia: "Foncia", laforet: "Laforêt", jinka: "Jinka",
};
