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
  base: "#111317",
  baseGlow: "#15181e",
  gridFaint: "rgba(161, 161, 170, 0.10)",
  gridChunk: "rgba(52, 211, 153, 0.18)",
  hidden: "#282d37",
  hiddenHi: "rgba(255, 255, 255, 0.14)",
  hiddenLo: "rgba(0, 0, 0, 0.48)",
  revealedA: "#161920",
  revealedB: "#191d25",
  revealedZero: "#12151b",
  accent: "#38bdf8",
  mint: "#34d399",
  danger: "#f43f5e",
  flag: "#fbbf24",
  numbers: [
    "#60a5fa",
    "#34d399",
    "#fb7185",
    "#c084fc",
    "#fbbf24",
    "#2dd4bf",
    "#f472b6",
    "#f4f4f5",
  ],
};

export const HIGH_CONTRAST_COLORS: BoardPalette = {
  base: "#090a0d",
  baseGlow: "#0e1014",
  gridFaint: "rgba(212, 212, 216, 0.16)",
  gridChunk: "rgba(52, 211, 153, 0.34)",
  hidden: "#333946",
  hiddenHi: "rgba(255, 255, 255, 0.28)",
  hiddenLo: "rgba(0, 0, 0, 0.72)",
  revealedA: "#101217",
  revealedB: "#14171d",
  revealedZero: "#0b0c10",
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
