import { useEffect, useState } from "react";

/** Soft accent palettes. Each has a light-mode and a dark-mode tone (same hue, tuned contrast). */
export const PALETTES = {
  sage:     { name: "Sage",     light: "#5a8a6f", dark: "#8cc3a3" },
  ocean:    { name: "Ocean",    light: "#4a7ea6", dark: "#8ab9de" },
  lavender: { name: "Lavender", light: "#7b6bb0", dark: "#b2a4e3" },
  clay:     { name: "Clay",     light: "#b06a50", dark: "#e3a389" },
  sand:     { name: "Sand",     light: "#a5843c", dark: "#dcbd76" },
  rose:     { name: "Rose",     light: "#ae5d7b", dark: "#e39bb5" },
  slate:    { name: "Slate",    light: "#4f5b6b", dark: "#adb6c4" },
} as const;
export type PaletteId = keyof typeof PALETTES;

/** Follows the device setting (System Settings → Appearance), live. */
export function usePrefersDark(): boolean {
  const q = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

/** Selected palette (remembered) + the resolved accent for the current light/dark mode. */
export function useTheme() {
  const dark = usePrefersDark();
  const [palette, setPalette] = useState<PaletteId>(() => {
    const saved = localStorage.getItem("apt-palette") as PaletteId | null;
    return saved && saved in PALETTES ? saved : "sage";
  });
  const accent = PALETTES[palette][dark ? "dark" : "light"];
  useEffect(() => {
    localStorage.setItem("apt-palette", palette);
    document.documentElement.style.setProperty("--accent", accent);
    document.documentElement.dataset.palette = palette;
  }, [palette, accent]);
  return { dark, palette, setPalette, accent };
}
