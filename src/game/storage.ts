import type { DifficultyId } from "./config";

const KEY = "endless-minesweeper:v1";

export interface SaveData {
  best: Partial<Record<DifficultyId, number>>;
  bestCleared: Partial<Record<DifficultyId, number>>;
  games: number;
  muted: boolean;
  difficulty: DifficultyId;
  musicVolume: number;
  sfxVolume: number;
  haptics: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  longPressMs: number;
}

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

const defaults = (): SaveData => ({
  best: {},
  bestCleared: {},
  games: 0,
  muted: false,
  difficulty: "normal",
  musicVolume: 0.65,
  sfxVolume: 0.85,
  haptics: true,
  reduceMotion: false,
  highContrast: false,
  longPressMs: 350,
});

function normalize(raw: Partial<SaveData> | null): SaveData {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;
  const lp = raw.longPressMs;
  return {
    ...base,
    ...raw,
    musicVolume: clamp01(raw.musicVolume, base.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, base.sfxVolume),
    haptics: typeof raw.haptics === "boolean" ? raw.haptics : base.haptics,
    reduceMotion: typeof raw.reduceMotion === "boolean" ? raw.reduceMotion : base.reduceMotion,
    highContrast: typeof raw.highContrast === "boolean" ? raw.highContrast : base.highContrast,
    longPressMs: typeof lp === "number" && lp >= 200 && lp <= 700 ? lp : base.longPressMs,
  };
}

let cached: SaveData | null = null;
const listeners = new Set<() => void>();

export function loadSave(): SaveData {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? normalize(JSON.parse(raw) as Partial<SaveData>) : defaults();
  } catch {
    cached = defaults();
  }
  return cached;
}

export function patchSave(patch: Partial<SaveData>): SaveData {
  const next = normalize({ ...loadSave(), ...patch });
  cached = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable – ignore */
  }
  listeners.forEach((fn) => fn());
  return next;
}

export function subscribeSave(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
