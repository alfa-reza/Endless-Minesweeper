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
    density: 0.11,
    lives: 5,
    multiplier: 1,
    tagline: "Long, forgiving runs",
    accent: "#34d399",
  },
  {
    id: "normal",
    name: "Normal",
    density: 0.15,
    lives: 3,
    multiplier: 2,
    tagline: "Balanced endless",
    accent: "#38bdf8",
  },
  {
    id: "hard",
    name: "Hard",
    density: 0.19,
    lives: 2,
    multiplier: 3,
    tagline: "Tight margin",
    accent: "#fbbf24",
  },
  {
    id: "insane",
    name: "Insane",
    density: 0.24,
    lives: 1,
    multiplier: 5,
    tagline: "One mistake and it's over",
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
  base: "#181b20",
  baseGlow: "#1c2026",
  gridFaint: "rgba(176, 183, 195, 0.11)",
  gridChunk: "rgba(74, 222, 128, 0.22)",
  hidden: "#3a414c",
  hiddenHi: "rgba(255, 255, 255, 0.24)",
  hiddenLo: "rgba(0, 0, 0, 0.56)",
  revealedA: "#1e2229",
  revealedB: "#22262e",
  revealedZero: "#1a1e24",
  accent: "#38bdf8",
  mint: "#4ade80",
  danger: "#f87171",
  flag: "#facc15",
  numbers: [
    "#60a5fa",
    "#4ade80",
    "#f87171",
    "#c084fc",
    "#fbbf24",
    "#2dd4bf",
    "#e5e7eb",
    "#ffffff",
  ],
};

export const HIGH_CONTRAST_COLORS: BoardPalette = {
  base: "#101215",
  baseGlow: "#14171b",
  gridFaint: "rgba(229, 231, 235, 0.18)",
  gridChunk: "rgba(74, 222, 128, 0.36)",
  hidden: "#434b59",
  hiddenHi: "rgba(255, 255, 255, 0.34)",
  hiddenLo: "rgba(0, 0, 0, 0.78)",
  revealedA: "#14171c",
  revealedB: "#181c22",
  revealedZero: "#101216",
  accent: "#7dd3fc",
  mint: "#4ade80",
  danger: "#fb7185",
  flag: "#fde047",
  numbers: [
    "#7dd3fc",
    "#4ade80",
    "#fca5a5",
    "#e9d5ff",
    "#fde047",
    "#5eead4",
    "#f3f4f6",
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
