export type DifficultyId = "easy" | "normal" | "hard" | "insane";

export interface Difficulty {
  id: DifficultyId;
  name: string;
  /** Probability that any given cell is a mine. */
  density: number;
  lives: number;
  /** Score multiplier. */
  multiplier: number;
  tagline: string;
  accent: string;
}

export const DIFFICULTIES: Difficulty[] = [
  {
    id: "easy",
    name: "Easy",
    density: 0.12,
    lives: 3,
    multiplier: 1,
    tagline: "Relaxed exploring",
    accent: "#34d399",
  },
  {
    id: "normal",
    name: "Normal",
    density: 0.16,
    lives: 2,
    multiplier: 2,
    tagline: "The classic feel",
    accent: "#38bdf8",
  },
  {
    id: "hard",
    name: "Hard",
    density: 0.2,
    lives: 1,
    multiplier: 3,
    tagline: "One mistake and it's over",
    accent: "#fbbf24",
  },
  {
    id: "insane",
    name: "Insane",
    density: 0.25,
    lives: 1,
    multiplier: 5,
    tagline: "Pure nerve",
    accent: "#fb7185",
  },
];

export const getDifficulty = (id: DifficultyId): Difficulty =>
  DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

export interface BoardPalette {
  base: string;
  baseGlow: string;
  gridFaint: string;
  gridChunk: string;
  hidden: string;
  hiddenHi: string;
  hiddenLo: string;
  revealedA: string;
  revealedB: string;
  revealedZero: string;
  accent: string;
  mint: string;
  danger: string;
  flag: string;
  numbers: readonly string[];
}

export const COLORS: BoardPalette = {
  base: "#090d16",
  baseGlow: "#11192c",
  gridFaint: "rgba(148, 163, 184, 0.08)",
  gridChunk: "rgba(56, 189, 248, 0.16)",
  hidden: "#23314f",
  hiddenHi: "rgba(203, 213, 225, 0.22)",
  hiddenLo: "rgba(3, 6, 15, 0.62)",
  revealedA: "#121a2d",
  revealedB: "#151f35",
  revealedZero: "#0d1424",
  accent: "#38bdf8",
  mint: "#34d399",
  danger: "#fb7185",
  flag: "#fbbf24",
  numbers: [
    "#60a5fa",
    "#34d399",
    "#fb7185",
    "#c084fc",
    "#fbbf24",
    "#2dd4bf",
    "#f472b6",
    "#f8fafc",
  ],
};

export const HIGH_CONTRAST_COLORS: BoardPalette = {
  base: "#05070d",
  baseGlow: "#0c1322",
  gridFaint: "rgba(203, 213, 225, 0.16)",
  gridChunk: "rgba(56, 189, 248, 0.34)",
  hidden: "#2c3f66",
  hiddenHi: "rgba(255, 255, 255, 0.34)",
  hiddenLo: "rgba(0, 0, 0, 0.78)",
  revealedA: "#0b111f",
  revealedB: "#10182b",
  revealedZero: "#070b14",
  accent: "#7dd3fc",
  mint: "#4ade80",
  danger: "#ff6b81",
  flag: "#fde047",
  numbers: [
    "#7dd3fc",
    "#4ade80",
    "#fca5a5",
    "#e9d5ff",
    "#fde047",
    "#5eead4",
    "#fbcfe8",
    "#ffffff",
  ],
};

export const getBoardPalette = (highContrast: boolean): BoardPalette =>
  highContrast ? HIGH_CONTRAST_COLORS : COLORS;

export const MIN_CELL = 12;
export const MAX_CELL = 72;
export const DEFAULT_CELL = 36;

export const minCellSize = (coarse: boolean) => (coarse ? 18 : MIN_CELL);
export const defaultCellSize = (coarse: boolean) => (coarse ? 44 : DEFAULT_CELL);
