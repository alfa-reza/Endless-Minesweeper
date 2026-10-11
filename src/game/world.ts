/**
 * Infinite, chunk-based minesweeper world.
 *
 * Mines are generated deterministically from (x, y, seed) so the board is
 * infinite and never needs to be stored. Only cells the player has touched
 * (and the fog around them) live in memory, grouped into 32x32 chunks that are
 * backed by typed arrays.
 */

export const CHUNK_SIZE = 32;
const CHUNK_SHIFT = 5;
const CHUNK_MASK = 31;
const CELLS = CHUNK_SIZE * CHUNK_SIZE;

export const HIDDEN = 0;
export const REVEALED = 1;
export const FLAGGED = 2;
export const EXPLODED = 3;

/** How far (in cells) the "fog of war" tiles extend beyond explored cells. */
export const FOG_RADIUS = 3;

export class Chunk {
  readonly cx: number;
  readonly cy: number;
  /** HIDDEN / REVEALED / FLAGGED / EXPLODED */
  readonly state = new Uint8Array(CELLS);
  /** Cached neighbouring-mine count for revealed cells. */
  readonly num = new Uint8Array(CELLS);
  /** Fog level 0..FOG_RADIUS+1 (higher = closer to explored area). */
  readonly fog = new Uint8Array(CELLS);
  /** Time at which a cell was revealed (drives the reveal animation). */
  readonly stamp = new Float32Array(CELLS);
  revealed = 0;

  constructor(cx: number, cy: number) {
    this.cx = cx;
    this.cy = cy;
  }
}

export const chunkKey = (cx: number, cy: number) =>
  (cx & 0xffff) * 65536 + (cy & 0xffff);

/** Fast deterministic 2D hash -> [0, 1). */
function hash01(x: number, y: number, s: number): number {
  let h = (2166136261 ^ s) >>> 0;
  h = (h ^ Math.imul(x, 374761393)) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h = (h ^ Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Turn any text into a stable 32-bit seed. */
export function seedFromString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

export interface FloodResult {
  cells: number;
  points: number;
  maxDist: number;
  capped: boolean;
}

const NEIGHBORS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

export class World {
  readonly seed: number;
  readonly density: number;
  readonly chunks = new Map<number, Chunk>();
  revealedTotal = 0;
  flagsTotal = 0;

  private safe: { x: number; y: number } | null = null;
  private lastKey = -1;
  private lastChunk: Chunk | null = null;

  constructor(seed: number, density: number) {
    this.seed = seed;
    this.density = density;
  }

  get hasSafeZone() {
    return this.safe !== null;
  }

  /** Guarantee a 3x3 mine-free zone (used for the very first click). */
  setSafeZone(x: number, y: number) {
    this.safe = { x, y };
  }

  isMine(x: number, y: number): boolean {
    const s = this.safe;
    if (s && Math.abs(x - s.x) <= 1 && Math.abs(y - s.y) <= 1) return false;
    return hash01(x, y, this.seed) < this.density;
  }

  countAround(x: number, y: number): number {
    let n = 0;
    for (const [dx, dy] of NEIGHBORS) if (this.isMine(x + dx, y + dy)) n++;
    return n;
  }

  getChunk(cx: number, cy: number): Chunk | undefined {
    const k = chunkKey(cx, cy);
    if (k === this.lastKey && this.lastChunk) return this.lastChunk;
    const c = this.chunks.get(k);
    if (c) {
      this.lastKey = k;
      this.lastChunk = c;
    }
    return c;
  }

  private ensureChunk(cx: number, cy: number): Chunk {
    const k = chunkKey(cx, cy);
    if (k === this.lastKey && this.lastChunk) return this.lastChunk;
    let c = this.chunks.get(k);
    if (!c) {
      c = new Chunk(cx, cy);
      this.chunks.set(k, c);
    }
    this.lastKey = k;
    this.lastChunk = c;
    return c;
  }

  getState(x: number, y: number): number {
    const c = this.getChunk(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    if (!c) return HIDDEN;
    return c.state[((y & CHUNK_MASK) << CHUNK_SHIFT) | (x & CHUNK_MASK)];
  }

  getNumber(x: number, y: number): number {
    const c = this.getChunk(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    if (!c) return 0;
    return c.num[((y & CHUNK_MASK) << CHUNK_SHIFT) | (x & CHUNK_MASK)];
  }

  private markFog(x: number, y: number) {
    const R = FOG_RADIUS;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const level = R + 1 - Math.max(Math.abs(dx), Math.abs(dy));
        const nx = x + dx;
        const ny = y + dy;
        const c = this.ensureChunk(nx >> CHUNK_SHIFT, ny >> CHUNK_SHIFT);
        const i = ((ny & CHUNK_MASK) << CHUNK_SHIFT) | (nx & CHUNK_MASK);
        if (c.fog[i] < level) c.fog[i] = level;
      }
    }
  }

  /** Reveal one (known safe, hidden) cell and return its number. */
  private revealOne(x: number, y: number, stamp: number): number {
    const c = this.ensureChunk(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    const i = ((y & CHUNK_MASK) << CHUNK_SHIFT) | (x & CHUNK_MASK);
    const n = this.countAround(x, y);
    c.state[i] = REVEALED;
    c.num[i] = n;
    c.stamp[i] = stamp;
    c.revealed++;
    this.revealedTotal++;
    this.markFog(x, y);
    return n;
  }

  /**
   * Reveal a safe cell and flood-fill through empty (zero) areas.
   * The flood is capped so a huge open field can never freeze the tab –
   * the player can simply click again to keep opening it.
   */
  flood(
    x: number,
    y: number,
    now: number,
    waveMs: number,
    limit = 6000,
  ): FloodResult {
    const res: FloodResult = { cells: 0, points: 0, maxDist: 0, capped: false };
    const queue: number[] = [];
    let head = 0;

    const open = (cx: number, cy: number) => {
      const n = this.revealOne(cx, cy, now + Math.hypot(cx - x, cy - y) * waveMs);
      res.cells++;
      res.points += 1 + n;
      const d = Math.hypot(cx, cy);
      if (d > res.maxDist) res.maxDist = d;
      if (n === 0) queue.push(cx, cy);
    };

    open(x, y);
    while (head < queue.length) {
      if (res.cells >= limit) {
        res.capped = true;
        break;
      }
      const cx = queue[head++];
      const cy = queue[head++];
      for (const [dx, dy] of NEIGHBORS) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (this.getState(nx, ny) !== HIDDEN) continue;
        open(nx, ny);
      }
    }
    return res;
  }

  /** Mark a mine as exploded. */
  explode(x: number, y: number, stamp: number) {
    const c = this.ensureChunk(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    const i = ((y & CHUNK_MASK) << CHUNK_SHIFT) | (x & CHUNK_MASK);
    c.state[i] = EXPLODED;
    c.num[i] = 0;
    c.stamp[i] = stamp;
    this.markFog(x, y);
  }

  /** Returns true when a flag was placed, false when removed, null if impossible. */
  toggleFlag(x: number, y: number): boolean | null {
    const c = this.ensureChunk(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    const i = ((y & CHUNK_MASK) << CHUNK_SHIFT) | (x & CHUNK_MASK);
    const s = c.state[i];
    if (s === HIDDEN) {
      c.state[i] = FLAGGED;
      this.flagsTotal++;
      return true;
    }
    if (s === FLAGGED) {
      c.state[i] = HIDDEN;
      this.flagsTotal--;
      return false;
    }
    return null;
  }

  /** Flags (and exploded mines, which count as known) around a cell. */
  flagsAround(x: number, y: number): number {
    let n = 0;
    for (const [dx, dy] of NEIGHBORS) {
      const s = this.getState(x + dx, y + dy);
      if (s === FLAGGED || s === EXPLODED) n++;
    }
    return n;
  }

  neighbors() {
    return NEIGHBORS;
  }
}
