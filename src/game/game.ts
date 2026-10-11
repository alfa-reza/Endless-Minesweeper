import type { Difficulty } from "./config";
import { loadSave, patchSave } from "./storage";
import { HIDDEN, REVEALED, World, seedFromString } from "./world";

export type Status = "ready" | "playing" | "over";

export type GameEvent =
  | { type: "reveal"; cells: number }
  | { type: "chord" }
  | { type: "flag"; placed: boolean }
  | { type: "boom"; x: number; y: number; livesLeft: number }
  | { type: "gameover"; record: boolean };

export interface Snapshot {
  status: Status;
  score: number;
  best: number;
  revealed: number;
  flags: number;
  lives: number;
  maxLives: number;
  minesHit: number;
  maxDist: number;
  record: boolean;
}

const WAVE_MS = 34;

export class Game {
  readonly world: World;
  readonly difficulty: Difficulty;
  readonly seedLabel: string;

  status: Status = "ready";
  score = 0;
  lives: number;
  minesHit = 0;
  maxDist = 0;
  record = false;
  explodedAt: { x: number; y: number; at: number } | null = null;
  /** Bumped on every change so the render loop knows to repaint. */
  version = 0;
  onEvent: ((e: GameEvent) => void) | null = null;

  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private best: number;
  private startedAt = 0;
  private accumulated = 0;
  private running = false;
  private committed = false;

  constructor(difficulty: Difficulty, seedLabel: string) {
    this.difficulty = difficulty;
    this.seedLabel = seedLabel;
    this.world = new World(seedFromString(seedLabel), difficulty.density);
    this.lives = difficulty.lives;
    this.best = loadSave().best[difficulty.id] ?? 0;
    this.snap = this.makeSnapshot();
  }

  // ---- store plumbing (useSyncExternalStore) ----
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = () => this.snap;

  private makeSnapshot(): Snapshot {
    return {
      status: this.status,
      score: this.score,
      best: Math.max(this.best, this.score),
      revealed: this.world.revealedTotal,
      flags: this.world.flagsTotal,
      lives: this.lives,
      maxLives: this.difficulty.lives,
      minesHit: this.minesHit,
      maxDist: Math.round(this.maxDist),
      record: this.record,
    };
  }

  private changed() {
    this.version++;
    this.snap = this.makeSnapshot();
    this.listeners.forEach((l) => l());
  }

  private emit(e: GameEvent) {
    this.onEvent?.(e);
  }

  // ---- timer ----
  elapsed(): number {
    return this.accumulated + (this.running ? performance.now() - this.startedAt : 0);
  }

  pause() {
    if (!this.running) return;
    this.accumulated += performance.now() - this.startedAt;
    this.running = false;
  }

  resume() {
    if (this.running || this.status !== "playing") return;
    this.startedAt = performance.now();
    this.running = true;
  }

  // ---- actions ----
  private begin(x: number, y: number) {
    this.world.setSafeZone(x, y);
    this.status = "playing";
    this.startedAt = performance.now();
    this.running = true;
  }

  private addPoints(points: number, maxDist: number) {
    this.score += points * this.difficulty.multiplier;
    if (maxDist > this.maxDist) this.maxDist = maxDist;
  }

  private hitMine(x: number, y: number) {
    const now = performance.now();
    this.world.explode(x, y, now);
    this.explodedAt = { x, y, at: now };
    this.lives--;
    this.minesHit++;
    this.emit({ type: "boom", x, y, livesLeft: this.lives });
    if (this.lives <= 0) this.finish();
  }

  /** Left action: dig a hidden cell, or chord on a revealed number. */
  reveal(x: number, y: number) {
    if (this.status === "over") return;
    const s = this.world.getState(x, y);
    if (s === REVEALED) {
      this.chord(x, y);
      return;
    }
    if (s !== HIDDEN) return;

    if (this.status === "ready") this.begin(x, y);

    if (this.world.isMine(x, y)) {
      this.hitMine(x, y);
    } else {
      const res = this.world.flood(x, y, performance.now(), WAVE_MS);
      this.addPoints(res.points, res.maxDist);
      this.emit({ type: "reveal", cells: res.cells });
    }
    this.changed();
  }

  chord(x: number, y: number) {
    if (this.status === "over") return;
    if (this.world.getState(x, y) !== REVEALED) return;
    const n = this.world.getNumber(x, y);
    if (n <= 0 || this.world.flagsAround(x, y) !== n) return;

    let opened = 0;
    let hit = false;
    for (const [dx, dy] of this.world.neighbors()) {
      const nx = x + dx;
      const ny = y + dy;
      if (this.world.getState(nx, ny) !== HIDDEN) continue;
      if (this.world.isMine(nx, ny)) {
        hit = true;
        this.hitMine(nx, ny);
        if (this.isOver()) break;
      } else {
        const res = this.world.flood(nx, ny, performance.now(), WAVE_MS);
        this.addPoints(res.points, res.maxDist);
        opened += res.cells;
      }
    }
    if (opened > 0) this.emit({ type: hit ? "reveal" : "chord", cells: opened });
    this.changed();
  }

  toggleFlag(x: number, y: number) {
    if (this.status === "over") return;
    const placed = this.world.toggleFlag(x, y);
    if (placed === null) return;
    this.emit({ type: "flag", placed });
    this.changed();
  }

  /** Persist the best score. Safe to call more than once. */
  commit() {
    if (this.committed) return;
    this.committed = true;
    const save = loadSave();
    const id = this.difficulty.id;
    const prev = save.best[id] ?? 0;
    const prevCleared = save.bestCleared[id] ?? 0;
    if (this.score > prev) this.record = true;
    if (this.score > 0 || this.world.revealedTotal > 0) {
      patchSave({
        games: save.games + 1,
        best: { ...save.best, [id]: Math.max(prev, this.score) },
        bestCleared: {
          ...save.bestCleared,
          [id]: Math.max(prevCleared, this.world.revealedTotal),
        },
      });
    }
  }

  private finish() {
    if (this.status === "over") return;
    this.pause();
    this.status = "over";
    this.commit();
    this.emit({ type: "gameover", record: this.record });
  }

  /** Called when the player leaves mid-run (e.g. back to menu). */
  dispose() {
    this.pause();
    if (this.status !== "ready") this.commit();
  }

  isOver(): boolean {
    return this.status === "over";
  }
}
