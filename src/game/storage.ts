import type { DifficultyId } from "./config";

const KEY = "endless-minesweeper:v1";

export interface SaveData {
  best: Partial<Record<DifficultyId, number>>;
  bestCleared: Partial<Record<DifficultyId, number>>;
  games: number;
  muted: boolean;
  difficulty: DifficultyId;
}

const defaults = (): SaveData => ({
  best: {},
  bestCleared: {},
  games: 0,
  muted: false,
  difficulty: "normal",
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    return { ...defaults(), ...JSON.parse(raw) };
  } catch {
    return defaults();
  }
}

export function patchSave(patch: Partial<SaveData>): SaveData {
  const next = { ...loadSave(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable – ignore */
  }
  return next;
}
