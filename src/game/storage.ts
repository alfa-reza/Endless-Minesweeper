import { DIFFICULTIES, type DifficultyId } from "./config";
import { dbGetState, dbPutState } from "./db";

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

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const VALID_DIFFICULTIES = new Set<string>(DIFFICULTIES.map((d) => d.id));

function sanitizeScoreMap(raw: unknown): Partial<Record<DifficultyId, number>> {
  if (!isRecord(raw)) return {};
  const out: Partial<Record<DifficultyId, number>> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (VALID_DIFFICULTIES.has(k) && typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k as DifficultyId] = Math.floor(v);
    }
  }
  return out;
}

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

export function normalizeSave(raw: unknown): SaveData {
  const base = defaults();
  if (!isRecord(raw)) return base;
  const lp = raw.longPressMs;
  const diff = typeof raw.difficulty === "string" && VALID_DIFFICULTIES.has(raw.difficulty)
    ? (raw.difficulty as DifficultyId)
    : base.difficulty;
  return {
    best: sanitizeScoreMap(raw.best),
    bestCleared: sanitizeScoreMap(raw.bestCleared),
    games:
      typeof raw.games === "number" && Number.isFinite(raw.games) && raw.games >= 0
        ? Math.floor(raw.games)
        : base.games,
    muted: typeof raw.muted === "boolean" ? raw.muted : base.muted,
    difficulty: diff,
    musicVolume: clamp01(raw.musicVolume, base.musicVolume),
    sfxVolume: clamp01(raw.sfxVolume, base.sfxVolume),
    haptics: typeof raw.haptics === "boolean" ? raw.haptics : base.haptics,
    reduceMotion: typeof raw.reduceMotion === "boolean" ? raw.reduceMotion : base.reduceMotion,
    highContrast: typeof raw.highContrast === "boolean" ? raw.highContrast : base.highContrast,
    longPressMs: typeof lp === "number" && Number.isFinite(lp) && lp >= 200 && lp <= 700 ? lp : base.longPressMs,
  };
}

let cached: SaveData | null = null;
const listeners = new Set<() => void>();

export function loadSave(): SaveData {
  if (cached) return cached;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    cached = raw ? normalizeSave(JSON.parse(raw)) : defaults();
  } catch {
    cached = defaults();
  }
  return cached;
}

export function patchSave(patch: Partial<SaveData>): SaveData {
  const next = normalizeSave({ ...loadSave(), ...patch });
  cached = next;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(next));
    }
  } catch {
    /* storage unavailable – ignore */
  }
  void dbPutState("save", next);
  listeners.forEach((fn) => fn());
  return next;
}

/** Hydrate from IndexedDB on startup (critical for WebView EXE/APK persistence). */
export async function hydrateSaveFromDb(): Promise<void> {
  const dbRaw = await dbGetState<Partial<SaveData>>("save");
  if (!dbRaw) {
    // Seed IndexedDB from current localStorage state on first run
    void dbPutState("save", loadSave());
    return;
  }
  const dbSave = normalizeSave(dbRaw);
  const local = loadSave();
  const mergedBest: Partial<Record<DifficultyId, number>> = { ...local.best };
  const mergedCleared: Partial<Record<DifficultyId, number>> = { ...local.bestCleared };
  for (const d of DIFFICULTIES) {
    const b = Math.max(local.best[d.id] ?? 0, dbSave.best[d.id] ?? 0);
    if (b > 0) mergedBest[d.id] = b;
    const c = Math.max(local.bestCleared[d.id] ?? 0, dbSave.bestCleared[d.id] ?? 0);
    if (c > 0) mergedCleared[d.id] = c;
  }
  const merged = normalizeSave({
    ...dbSave,
    ...local,
    games: Math.max(local.games, dbSave.games),
    best: mergedBest,
    bestCleared: mergedCleared,
  });
  cached = merged;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(merged));
    }
  } catch {
    /* ignore */
  }
  void dbPutState("save", merged);
  listeners.forEach((fn) => fn());
}

export function subscribeSave(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
