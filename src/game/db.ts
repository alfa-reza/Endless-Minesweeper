import type { DifficultyId } from "./config";

const DB_NAME = "endless-minesweeper-db";
const DB_VERSION = 1;
const STORE_STATE = "state";
const STORE_RUNS = "runs";
const FALLBACK_RUNS_KEY = "endless-minesweeper:runs:v1";
const MAX_RUNS = 300;

export interface RunRecord {
  id?: number;
  playedAt: number;
  difficulty: DifficultyId;
  seed: string;
  score: number;
  cleared: number;
  maxDist: number;
  minesHit: number;
  durationMs: number;
  record: boolean;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_RUNS)) {
          const runs = db.createObjectStore(STORE_RUNS, { keyPath: "id", autoIncrement: true });
          runs.createIndex("by_playedAt", "playedAt");
          runs.createIndex("by_difficulty", "difficulty");
          runs.createIndex("by_score", "score");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function dbGetState<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STATE, "readonly");
      const req = tx.objectStore(STORE_STATE).get(key);
      req.onsuccess = () => resolve((req.result as { key: string; value: T } | undefined)?.value ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function dbPutState<T>(key: string, value: T): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_STATE, "readwrite");
      tx.objectStore(STORE_STATE).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function loadFallbackRuns(): RunRecord[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(FALLBACK_RUNS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return [];
  }
}

function saveFallbackRuns(runs: RunRecord[]) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FALLBACK_RUNS_KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  } catch {
    /* ignore */
  }
}

export async function recordRun(run: Omit<RunRecord, "id">): Promise<void> {
  const db = await openDb();
  if (!db) {
    const list = [{ ...run, id: Date.now() }, ...loadFallbackRuns()].slice(0, MAX_RUNS);
    saveFallbackRuns(list);
    return;
  }
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RUNS, "readwrite");
      tx.objectStore(STORE_RUNS).add(run);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listRuns(limit = 50): Promise<RunRecord[]> {
  const db = await openDb();
  if (!db) return loadFallbackRuns().slice(0, limit);
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RUNS, "readonly");
      const idx = tx.objectStore(STORE_RUNS).index("by_playedAt");
      const out: RunRecord[] = [];
      const req = idx.openCursor(null, "prev");
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor && out.length < limit) {
          out.push(cursor.value as RunRecord);
          cursor.continue();
        } else {
          resolve(out);
        }
      };
      req.onerror = () => resolve(loadFallbackRuns().slice(0, limit));
    } catch {
      resolve(loadFallbackRuns().slice(0, limit));
    }
  });
}

export async function clearRuns(): Promise<void> {
  saveFallbackRuns([]);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RUNS, "readwrite");
      tx.objectStore(STORE_RUNS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
