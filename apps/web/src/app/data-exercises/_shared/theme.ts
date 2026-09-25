"use client";

import { createContext, useContext, type CSSProperties } from "react";

// A theme drives two things: CSS variables (--de-*) for the page's Tailwind
// classes, and this object via context for Recharts/SVG, which need real colour
// values rather than CSS variables.
export interface ExerciseTheme {
  id: string;
  name: string;
  note: string;
  paper: string; // page background
  surface: string; // cards, chart panel
  ink: string; // main text, strong lines
  muted: string; // secondary text, axis labels
  line: string; // borders, gridlines
  accent: string; // log button, highlights, single-series charts
  onAccent: string; // text on the accent colour
  edge: string; // the log button's outline + pressed shadow
  live: string; // the "Live" status dot
  categories: string[]; // one colour per answer option, in order
}

export const THEMES: ExerciseTheme[] = [
  {
    id: "paper",
    name: "Paper",
    note: "Warm and calm, the default",
    paper: "#F5F3EE",
    surface: "#FFFFFF",
    ink: "#16140F",
    muted: "#6B665C",
    line: "#DDD8CC",
    accent: "#FF5B1F",
    onAccent: "#16140F",
    edge: "#16140F",
    live: "#1F9D55",
    categories: ["#FF5B1F", "#2F6FEB", "#1F9D55", "#E0A800", "#8E44EC", "#E8457A", "#0FA3A3", "#9C6B3F"],
  },
  {
    id: "chalkboard",
    name: "Chalkboard",
    note: "Like the board at the front of the room",
    paper: "#1E3A2F",
    surface: "#244437",
    ink: "#F3F0E6",
    muted: "#A9C2B5",
    line: "#3D6353",
    accent: "#F6D55C",
    onAccent: "#1E3A2F",
    edge: "#0F2219",
    live: "#7EE2A8",
    categories: ["#F6D55C", "#8EC5FF", "#FF9AA2", "#A8E6CF", "#FFB870", "#CBB2FF", "#F3F0E6", "#8FE3E0"],
  },
  {
    id: "midnight",
    name: "Midnight",
    note: "Dark, for a dimmed room",
    paper: "#0F1115",
    surface: "#181B22",
    ink: "#ECEDEF",
    muted: "#9197A1",
    line: "#2B303B",
    accent: "#FF7A45",
    onAccent: "#0F1115",
    edge: "#000000",
    live: "#3DD68C",
    categories: ["#FF7A45", "#5B9BFF", "#3DD68C", "#F5C542", "#B18CFF", "#FF6B9A", "#2FD3D3", "#D9A66B"],
  },
  {
    id: "projector",
    name: "Projector",
    note: "Maximum contrast, colour-blind safe",
    paper: "#FFFFFF",
    surface: "#FFFFFF",
    ink: "#000000",
    muted: "#3D3D3D",
    line: "#B8B8B8",
    accent: "#0072B2",
    onAccent: "#FFFFFF",
    edge: "#000000",
    live: "#007A3D",
    // Okabe–Ito: distinguishable with the common forms of colour blindness.
    categories: ["#0072B2", "#E69F00", "#009E73", "#D55E00", "#CC79A7", "#56B4E9", "#F0E442", "#000000"],
  },
  {
    id: "sunshine",
    name: "Sunshine",
    note: "Bright and playful",
    paper: "#FFF4D6",
    surface: "#FFFDF6",
    ink: "#1D1A3A",
    muted: "#6A6488",
    line: "#EBDDB4",
    accent: "#FF4D6D",
    onAccent: "#FFFFFF",
    edge: "#1D1A3A",
    live: "#0A9F6F",
    categories: ["#FF4D6D", "#3A86FF", "#06D6A0", "#FFB703", "#8338EC", "#FB5607", "#118AB2", "#8D6E63"],
  },
];

export const DEFAULT_THEME = THEMES[0]!;
export const THEME_KEY = "ft_exercise_theme";

export function themeVars(t: ExerciseTheme): CSSProperties {
  return {
    "--de-paper": t.paper,
    "--de-surface": t.surface,
    "--de-ink": t.ink,
    "--de-muted": t.muted,
    "--de-line": t.line,
    "--de-accent": t.accent,
    "--de-on-accent": t.onAccent,
    "--de-edge": t.edge,
    "--de-live": t.live,
  } as CSSProperties;
}

export const ThemeContext = createContext<ExerciseTheme>(DEFAULT_THEME);
export const useExerciseTheme = () => useContext(ThemeContext);

export const categoryColor = (t: ExerciseTheme, i: number) => t.categories[i % t.categories.length]!;

export const SANS = "var(--font-geist-sans)";
export const MONO = "var(--font-geist-mono)";

/** Chart text styles, sized for a projector: readable from the back of a classroom. */
export function chartStyles(t: ExerciseTheme) {
  return {
    axisTick: { fontSize: 14, fill: t.muted, fontFamily: MONO },
    categoryTick: { fontSize: 16, fill: t.ink, fontFamily: SANS },
    dataLabel: { fontSize: 15, fontWeight: 600, fill: t.ink, fontFamily: MONO },
    tooltip: { background: t.ink, border: "none", borderRadius: 6, color: t.paper, fontSize: 13, fontFamily: MONO },
    tooltipLabel: { color: t.paper },
    cursorFill: `${t.ink}0D`,
  };
}
