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
    accent: "#69e0b9",
  },
  {
    id: "normal",
    name: "Normal",
    density: 0.16,
    lives: 2,
    multiplier: 2,
    tagline: "The classic feel",
    accent: "#7aa2ff",
  },
  {
    id: "hard",
    name: "Hard",
    density: 0.2,
    lives: 1,
    multiplier: 3,
    tagline: "One mistake and it's over",
    accent: "#ffaf38",
  },
  {
    id: "insane",
    name: "Insane",
    density: 0.25,
    lives: 1,
    multiplier: 5,
    tagline: "Pure nerve",
    accent: "#ff6b6b",
  },
];

export const getDifficulty = (id: DifficultyId): Difficulty =>
  DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];

/** Canvas palette. */
export const COLORS = {
  base: "#0b0e22",
  baseGlow: "#161c4a",
  gridFaint: "rgba(140,160,255,0.045)",
  gridChunk: "rgba(140,170,255,0.10)",
  hidden: "#1a2158",
  hiddenHi: "rgba(160,180,255,0.14)",
  hiddenLo: "rgba(0,0,10,0.35)",
  revealedA: "#3a4189",
  revealedB: "#353c82",
  revealedZero: "#2f3677",
  accent: "#7aa2ff",
  mint: "#69e0b9",
  danger: "#ff6b6b",
  flag: "#ffaf38",
  numbers: [
    "#a9bbff",
    "#69e0b9",
    "#ffd166",
    "#ff9f1c",
    "#ff6b6b",
    "#ff5fa2",
    "#d0a2ff",
    "#ffffff",
  ],
} as const;

export const MIN_CELL = 10;
export const MAX_CELL = 72;
export const DEFAULT_CELL = 34;
