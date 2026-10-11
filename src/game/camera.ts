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
  viewW = 800;
  viewH = 600;
  dirty = true;

  private anchor: { sx: number; sy: number; wx: number; wy: number } | null = null;
  private flight: Flight | null = null;

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    this.dirty = true;
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

  panBy(dxPx: number, dyPx: number) {
    this.flight = null;
    this.cx -= dxPx / this.size;
    this.cy -= dyPx / this.size;
    this.dirty = true;
  }

  /** Smoothly zoom by a factor around a screen point. */
  zoomAt(sx: number, sy: number, factor: number, immediate = false) {
    this.flight = null;
    const p = this.screenToWorld(sx, sy);
    this.target = clamp(this.target * factor, MIN_CELL, MAX_CELL);
    this.anchor = { sx, sy, wx: p.x, wy: p.y };
    if (immediate) {
      this.size = this.target;
      this.applyAnchor();
      this.anchor = null;
    }
    this.dirty = true;
  }

  private applyAnchor() {
    if (!this.anchor) return;
    const a = this.anchor;
    this.cx = a.wx - (a.sx - this.viewW / 2) / this.size;
    this.cy = a.wy - (a.sy - this.viewH / 2) / this.size;
  }

  flyTo(x: number, y: number, size = DEFAULT_CELL, dur = 600) {
    this.anchor = null;
    this.target = size;
    this.flight = {
      fromX: this.cx,
      fromY: this.cy,
      fromSize: this.size,
      toX: x,
      toY: y,
      toSize: size,
      t0: performance.now(),
      dur,
    };
    this.dirty = true;
  }

  /** Advance animations. Returns true if the camera moved. */
  update(now: number): boolean {
    let moved = false;
    if (this.flight) {
      const f = this.flight;
      const t = clamp((now - f.t0) / f.dur, 0, 1);
      const e = easeInOut(t);
      this.cx = f.fromX + (f.toX - f.fromX) * e;
      this.cy = f.fromY + (f.toY - f.fromY) * e;
      this.size = f.fromSize + (f.toSize - f.fromSize) * e;
      if (t >= 1) this.flight = null;
      moved = true;
    } else if (Math.abs(this.target - this.size) > 0.02) {
      this.size += (this.target - this.size) * 0.3;
      if (Math.abs(this.target - this.size) <= 0.02) {
        this.size = this.target;
      }
      this.applyAnchor();
      moved = true;
    } else if (this.anchor) {
      this.anchor = null;
    }
    if (moved) this.dirty = true;
    return moved;
  }
}
