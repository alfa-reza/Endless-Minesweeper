import { DEFAULT_CELL, MAX_CELL, MIN_CELL } from "./config";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface Flight {
  fromX: number;
  fromY: number;
  fromSize: number;
  toX: number;
  toY: number;
  toSize: number;
  t0: number;
  dur: number;
}

/**
 * Camera over an infinite grid.
 * (cx, cy) is the world position (in cell units) at the middle of the viewport
 * and `size` is the on-screen size of one cell in CSS pixels.
 */
export class Camera {
  cx = 0.5;
  cy = 0.5;
  size = DEFAULT_CELL;
  target = DEFAULT_CELL;
  minSize = MIN_CELL;
  viewW = 800;
  viewH = 600;
  dirty = true;

  // Trauma-based screen shake (CSS px offset, visual only)
  trauma = 0;
  shakeX = 0;
  shakeY = 0;

  private shakeTime = 0;
  private lastNow = 0;
  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private flight: Flight | null = null;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emitChange() {
    this.listeners.forEach((fn) => fn());
  }

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    this.dirty = true;
    this.emitChange();
  }

  setMinSize(min: number) {
    this.minSize = min;
    if (this.target < min) this.target = min;
    if (this.size < min) this.size = min;
  }

  screenToWorld(sx: number, sy: number) {
    return {
      x: this.cx + (sx - this.viewW / 2) / this.size,
      y: this.cy + (sy - this.viewH / 2) / this.size,
    };
  }

  screenToCell(sx: number, sy: number) {
    const p = this.screenToWorld(sx, sy);
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  }

  cancelFlight() {
    this.flight = null;
  }

  addTrauma(amount: number) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
    this.dirty = true;
  }

  panBy(dxPx: number, dyPx: number) {
    this.flight = null;
    this.cx -= dxPx / this.size;
    this.cy -= dyPx / this.size;
    this.dirty = true;
    this.emitChange();
  }

  jumpTo(x: number, y: number) {
    this.flight = null;
    this.cx = x;
    this.cy = y;
    this.dirty = true;
    this.emitChange();
  }

  /** Keep a cell comfortably inside the viewport (for keyboard/gamepad cursor). */
  ensureCellVisible(x: number, y: number, marginCells = 2.5) {
    const halfW = this.viewW / (2 * this.size) - marginCells;
    const halfH = this.viewH / (2 * this.size) - marginCells;
    if (halfW <= 0 || halfH <= 0) {
      this.cx = x + 0.5;
      this.cy = y + 0.5;
      this.dirty = true;
      this.emitChange();
      return;
    }
    const tx = x + 0.5;
    const ty = y + 0.5;
    let moved = false;
    if (tx < this.cx - halfW) {
      this.cx = tx + halfW;
      moved = true;
    } else if (tx > this.cx + halfW) {
      this.cx = tx - halfW;
      moved = true;
    }
    if (ty < this.cy - halfH) {
      this.cy = ty + halfH;
      moved = true;
    } else if (ty > this.cy + halfH) {
      this.cy = ty - halfH;
      moved = true;
    }
    if (moved) {
      this.flight = null;
      this.dirty = true;
      this.emitChange();
    }
  }

  /** Smoothly zoom by a factor around a screen point. */
  zoomAt(sx: number, sy: number, factor: number, immediate = false) {
    this.flight = null;
    const p = this.screenToWorld(sx, sy);
    this.target = clamp(this.target * factor, this.minSize, MAX_CELL);
    this.anchor = { sx, sy, wx: p.x, wy: p.y };
    if (immediate) {
      this.size = this.target;
      this.applyAnchor();
      this.anchor = null;
      this.emitChange();
    }
    this.dirty = true;
  }

  private applyAnchor() {
    if (!this.anchor) return;
    const a = this.anchor;
    this.cx = a.wx - (a.sx - this.viewW / 2) / this.size;
    this.cy = a.wy - (a.sy - this.viewH / 2) / this.size;
  }

  flyTo(x: number, y: number, size = this.size, dur = 520) {
    this.anchor = null;
    this.target = clamp(size, this.minSize, MAX_CELL);
    this.flight = {
      fromX: this.cx,
      fromY: this.cy,
      fromSize: this.size,
      toX: x,
      toY: y,
      toSize: this.target,
      t0: performance.now(),
      dur,
    };
    this.dirty = true;
  }

  /** Advance animations & trauma shake. Returns true if camera moved or shook. */
  update(now: number, reduceMotion = false): boolean {
    const dt = this.lastNow ? Math.min(0.064, (now - this.lastNow) / 1000) : 0.016;
    this.lastNow = now;
    let moved = false;

    if (this.flight) {
      const f = this.flight;
      if (reduceMotion) {
        this.cx = f.toX;
        this.cy = f.toY;
        this.size = f.toSize;
        this.flight = null;
      } else {
        const t = clamp((now - f.t0) / f.dur, 0, 1);
        const e = easeInOut(t);
        this.cx = f.fromX + (f.toX - f.fromX) * e;
        this.cy = f.fromY + (f.toY - f.fromY) * e;
        this.size = f.fromSize + (f.toSize - f.fromSize) * e;
        if (t >= 1) this.flight = null;
      }
      moved = true;
    } else if (Math.abs(this.target - this.size) > 0.02) {
      if (reduceMotion) {
        this.size = this.target;
      } else {
        this.size += (this.target - this.size) * 0.32;
        if (Math.abs(this.target - this.size) <= 0.02) this.size = this.target;
      }
      this.applyAnchor();
      moved = true;
    } else if (this.anchor) {
      this.anchor = null;
    }

    if (this.trauma > 0) {
      if (reduceMotion) {
        this.trauma = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      } else {
        this.trauma = Math.max(0, this.trauma - 1.75 * dt);
        this.shakeTime += dt * 34;
        const s = this.trauma * this.trauma;
        this.shakeX = 11 * s * Math.sin(this.shakeTime * 1.7);
        this.shakeY = 8 * s * Math.sin(this.shakeTime * 2.3);
        if (this.trauma === 0) {
          this.shakeX = 0;
          this.shakeY = 0;
        }
      }
      moved = true;
    }

    if (moved) {
      this.dirty = true;
      this.emitChange();
    }
    return moved;
  }
}
