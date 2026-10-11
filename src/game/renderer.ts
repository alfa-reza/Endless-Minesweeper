import type { Camera } from "./camera";
import { COLORS, getBoardPalette, type BoardPalette } from "./config";
import {
  CHUNK_SIZE,
  EXPLODED,
  FLAGGED,
  FOG_RADIUS,
  HIDDEN,
  REVEALED,
  type World,
} from "./world";

export interface PressIndicator {
  x: number;
  y: number;
  progress: number; // 0..1 long-press charge
  isTouch: boolean;
}

export interface Particle {
  wx: number;
  wy: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface ScorePop {
  wx: number;
  wy: number;
  text: string;
  life: number;
  maxLife: number;
  color: string;
}

export class EffectsPool {
  readonly particles: Particle[] = [];
  readonly pops: ScorePop[] = [];
  private lastNow = 0;

  spawnBurst(wx: number, wy: number, count: number, color: string, speed = 4.5) {
    const max = 90;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= max) this.particles.shift();
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.45 + Math.random() * 0.85);
      this.particles.push({
        wx,
        wy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.25,
        size: 2.2 + Math.random() * 2.4,
        color,
      });
    }
  }

  spawnPop(wx: number, wy: number, text: string, color: string) {
    if (this.pops.length >= 16) this.pops.shift();
    this.pops.push({
      wx: wx + (Math.random() - 0.5) * 0.25,
      wy: wy - 0.2,
      text,
      life: 0,
      maxLife: 0.85,
      color,
    });
  }

  step(now: number): boolean {
    const dt = this.lastNow ? Math.min(0.05, (now - this.lastNow) / 1000) : 0.016;
    this.lastNow = now;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.wx += p.vx * dt;
      p.wy += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }

    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i];
      pop.life += dt;
      if (pop.life >= pop.maxLife) {
        this.pops.splice(i, 1);
        continue;
      }
      pop.wy -= dt * 1.15;
    }

    return this.particles.length > 0 || this.pops.length > 0;
  }
}

export interface RenderOptions {
  now: number;
  hover: { x: number; y: number } | null;
  cursor?: { x: number; y: number } | null;
  press?: PressIndicator | null;
  gameOver: boolean;
  explodedAt: { x: number; y: number; at: number } | null;
  highContrast?: boolean;
  reduceMotion?: boolean;
  effects?: EffectsPool;
  showStartBeacon?: boolean;
}

const REVEAL_MS = 180;
const FLAG_MS = 170;
const SHOCK_MS = 850;
const NUM_STR = ["", "1", "2", "3", "4", "5", "6", "7", "8"];
const FONT_FAMILY = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const easeOutBack = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const m = k - 1;
  return 1 + c3 * m * m * m + c1 * m * m;
};

function drawHiddenTile(
  ctx: CanvasRenderingContext2D,
  X: number,
  Y: number,
  w: number,
  h: number,
  fog: number,
  pal: BoardPalette,
) {
  ctx.globalAlpha = 0.28 + 0.72 * (fog / (FOG_RADIUS + 1));
  ctx.fillStyle = pal.hidden;
  ctx.fillRect(X, Y, w, h);
  if (w >= 11) {
    ctx.fillStyle = pal.hiddenHi;
    ctx.fillRect(X, Y, w, 1.5);
    ctx.fillRect(X, Y, 1.5, h);
    ctx.fillStyle = pal.hiddenLo;
    ctx.fillRect(X, Y + h - 1.5, w, 1.5);
    ctx.fillRect(X + w - 1.5, Y, 1.5, h);
  }
  ctx.globalAlpha = 1;
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  X: number,
  Y: number,
  w: number,
  h: number,
  pal: BoardPalette,
  highContrast: boolean,
  scale = 1,
) {
  ctx.save();
  if (scale !== 1) {
    ctx.translate(X + w / 2, Y + h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(X + w / 2), -(Y + h / 2));
  }
  if (highContrast) {
    ctx.strokeStyle = pal.flag;
    ctx.lineWidth = Math.max(1.5, w * 0.06);
    ctx.strokeRect(X + 2, Y + 2, w - 4, h - 4);
  }
  ctx.fillStyle = pal.flag;
  ctx.beginPath();
  ctx.moveTo(X + w * 0.32, Y + h * 0.17);
  ctx.lineTo(X + w * 0.78, Y + h * 0.36);
  ctx.lineTo(X + w * 0.32, Y + h * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(X + w * 0.32 - 1, Y + h * 0.17, Math.max(1.5, w * 0.065), h * 0.63);
  ctx.fillStyle = "rgba(241, 245, 249, 0.78)";
  ctx.fillRect(X + w * 0.2, Y + h * 0.78, w * 0.34, Math.max(1.5, h * 0.065));
  ctx.restore();
}

function drawMine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  if (r >= 3) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.4, r * 0.28);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      const dx = Math.cos(a) * r * 1.45;
      const dy = Math.sin(a) * r * 1.45;
      ctx.moveTo(cx + dx, cy + dy);
      ctx.lineTo(cx - dx, cy - dy);
    }
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.33, cy - r * 0.33, Math.max(1, r * 0.24), 0, Math.PI * 2);
  ctx.fill();
}

function drawCellHighlight(
  ctx: CanvasRenderingContext2D,
  world: World,
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  xs: Int32Array,
  ys: Int32Array,
  color: string,
  dashed = false,
) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return;
  const st = world.getState(x, y);
  if (st === REVEALED && world.getNumber(x, y) > 0) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
    for (const [dx, dy] of world.neighbors()) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
      if (world.getState(nx, ny) !== HIDDEN) continue;
      const X = xs[nx - x0];
      const Y = ys[ny - y0];
      ctx.fillRect(X, Y, xs[nx - x0 + 1] - X, ys[ny - y0 + 1] - Y);
    }
  }
  const X = xs[x - x0];
  const Y = ys[y - y0];
  const w = xs[x - x0 + 1] - X;
  const h = ys[y - y0 + 1] - Y;
  if (st === HIDDEN || st === FLAGGED) {
    ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
    ctx.fillRect(X, Y, w, h);
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.strokeRect(X + 1, Y + 1, w - 2, h - 2);
  ctx.restore();
}

/** Draw the visible part of the world. Returns true while animations are running. */
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  o: RenderOptions,
): boolean {
  const W = cam.viewW;
  const H = cam.viewH;
  const size = cam.size;
  const now = o.now;
  const pal = getBoardPalette(!!o.highContrast);
  const reduce = !!o.reduceMotion;
  let animating = false;

  // ---- background (flat, crisp) ----
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.base;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  if (cam.shakeX !== 0 || cam.shakeY !== 0) {
    ctx.translate(cam.shakeX, cam.shakeY);
  }

  // ---- visible range & pixel edges ----
  const left = cam.cx - W / (2 * size);
  const top = cam.cy - H / (2 * size);
  const x0 = Math.floor(left) - 1;
  const y0 = Math.floor(top) - 1;
  const x1 = Math.ceil(left + W / size) + 1;
  const y1 = Math.ceil(top + H / size) + 1;
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const xs = new Int32Array(cols + 1);
  const ys = new Int32Array(rows + 1);
  for (let i = 0; i <= cols; i++) xs[i] = Math.round((x0 + i - left) * size);
  for (let j = 0; j <= rows; j++) ys[j] = Math.round((y0 + j - top) * size);

  // ---- faint grid + chunk guides ----
  if (size >= 11) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = pal.gridFaint;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) {
      if (((x0 + i) & (CHUNK_SIZE - 1)) === 0) continue;
      ctx.moveTo(xs[i] + 0.5, 0);
      ctx.lineTo(xs[i] + 0.5, H);
    }
    for (let j = 0; j <= rows; j++) {
      if (((y0 + j) & (CHUNK_SIZE - 1)) === 0) continue;
      ctx.moveTo(0, ys[j] + 0.5);
      ctx.lineTo(W, ys[j] + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = pal.gridChunk;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) {
      if (((x0 + i) & (CHUNK_SIZE - 1)) !== 0) continue;
      ctx.moveTo(xs[i] + 0.5, 0);
      ctx.lineTo(xs[i] + 0.5, H);
    }
    for (let j = 0; j <= rows; j++) {
      if (((y0 + j) & (CHUNK_SIZE - 1)) !== 0) continue;
      ctx.moveTo(0, ys[j] + 0.5);
      ctx.lineTo(W, ys[j] + 0.5);
    }
    ctx.stroke();
  }

  // ---- origin beacon (0, 0) ----
  const ox = (0.5 - left) * size;
  const oy = (0.5 - top) * size;
  if (ox > -size * 2 && ox < W + size * 2 && oy > -size * 2 && oy < H + size * 2) {
    if (o.showStartBeacon && !world.hasSafeZone) {
      const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now * 0.0045);
      if (!reduce) animating = true;
      ctx.save();
      ctx.fillStyle = `rgba(52, 211, 153, ${0.12 + 0.1 * pulse})`;
      const X = Math.round((0 - left) * size);
      const Y = Math.round((0 - top) * size);
      const w = Math.round((1 - left) * size) - X;
      const h = Math.round((1 - top) * size) - Y;
      ctx.fillRect(X, Y, w, h);
      ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 + 0.35 * pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(X + 1, Y + 1, w - 2, h - 2);
      ctx.beginPath();
      ctx.arc(ox, oy, size * (0.16 + 0.05 * pulse), 0, Math.PI * 2);
      ctx.fillStyle = pal.mint;
      ctx.fill();
      ctx.restore();
    } else if (world.hasSafeZone) {
      ctx.save();
      ctx.strokeStyle = "rgba(52, 211, 153, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ox, oy, Math.max(3, size * 0.14), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- chunks ----
  ctx.font = `700 ${Math.max(8, Math.floor(size * 0.58))}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cx0 = x0 >> 5;
  const cx1 = x1 >> 5;
  const cy0 = y0 >> 5;
  const cy1 = y1 >> 5;

  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const chunk = world.getChunk(cx, cy);
      if (!chunk) continue;
      const bx = cx * CHUNK_SIZE;
      const by = cy * CHUNK_SIZE;
      const lx0 = Math.max(0, x0 - bx);
      const lx1 = Math.min(CHUNK_SIZE - 1, x1 - bx);
      const ly0 = Math.max(0, y0 - by);
      const ly1 = Math.min(CHUNK_SIZE - 1, y1 - by);

      for (let ly = ly0; ly <= ly1; ly++) {
        for (let lx = lx0; lx <= lx1; lx++) {
          const i = ly * CHUNK_SIZE + lx;
          const st = chunk.state[i];
          const fog = chunk.fog[i];
          if (st === HIDDEN && fog === 0) continue;

          const x = bx + lx;
          const y = by + ly;
          const X = xs[x - x0];
          const Y = ys[y - y0];
          const w = xs[x - x0 + 1] - X;
          const h = ys[y - y0 + 1] - Y;

          if (st === HIDDEN) {
            drawHiddenTile(ctx, X, Y, w, h, fog, pal);
            continue;
          }
          if (st === FLAGGED) {
            drawHiddenTile(ctx, X, Y, w, h, Math.max(fog, 2), pal);
            const fp = !reduce && chunk.stamp[i] > 0 ? (now - chunk.stamp[i]) / FLAG_MS : 1;
            let scale = 1;
            if (fp >= 0 && fp < 1) {
              animating = true;
              scale = Math.max(0.4, easeOutBack(fp));
            }
            drawFlag(ctx, X, Y, w, h, pal, !!o.highContrast, scale);
            continue;
          }

          if (st === EXPLODED) {
            drawHiddenTile(ctx, X, Y, w, h, FOG_RADIUS + 1, pal);
            ctx.fillStyle = "rgba(244, 63, 94, 0.42)";
            ctx.fillRect(X, Y, w, h);
            drawMine(ctx, X + w / 2, Y + h / 2, w * 0.26, pal.danger);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(X + 1.5, Y + 1.5, w - 3, h - 3);
            continue;
          }

          const p = reduce ? 1 : (now - chunk.stamp[i]) / REVEAL_MS;
          if (p <= 0) {
            animating = true;
            drawHiddenTile(ctx, X, Y, w, h, FOG_RADIUS + 1, pal);
            continue;
          }
          const n = chunk.num[i];
          let ease = 1;
          if (p < 1) {
            animating = true;
            ease = p * (2 - p);
            drawHiddenTile(ctx, X, Y, w, h, FOG_RADIUS + 1, pal);
            ctx.globalAlpha = ease;
          }
          ctx.fillStyle =
            n === 0 ? pal.revealedZero : (x + y) & 1 ? pal.revealedA : pal.revealedB;
          ctx.fillRect(X, Y, w, h);
          if (w >= 11) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
            ctx.fillRect(X, Y, w, 1);
            ctx.fillRect(X, Y, 1, h);
            ctx.fillStyle = "rgba(2, 4, 12, 0.45)";
            ctx.fillRect(X, Y + h - 1, w, 1);
            ctx.fillRect(X + w - 1, Y, 1, h);
          }
          ctx.globalAlpha = 1;

          if (n > 0) {
            ctx.fillStyle = pal.numbers[n - 1];
            if (p < 1) {
              ctx.save();
              ctx.globalAlpha = ease;
              ctx.translate(X + w / 2, Y + h / 2);
              ctx.scale(0.65 + 0.35 * ease, 0.65 + 0.35 * ease);
              ctx.fillText(NUM_STR[n], 0, 1);
              ctx.restore();
            } else {
              ctx.fillText(NUM_STR[n], X + w / 2, Y + h / 2 + 1);
            }
          }
          if (p < 1) {
            ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - p)})`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(X + 1, Y + 1, w - 2, h - 2);
          }
        }
      }
    }
  }

  // ---- game over: expose every mine & wrong flag in view ----
  if (o.gameOver) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const st = world.getState(x, y);
        if (st === EXPLODED || st === REVEALED) continue;
        const mine = world.isMine(x, y);
        if (!mine && st !== FLAGGED) continue;
        const X = xs[x - x0];
        const Y = ys[y - y0];
        const w = xs[x - x0 + 1] - X;
        const h = ys[y - y0 + 1] - Y;
        if (st === HIDDEN) {
          ctx.fillStyle = "rgba(251, 113, 133, 0.16)";
          ctx.fillRect(X, Y, w, h);
          drawMine(ctx, X + w / 2, Y + h / 2, w * 0.22, "rgba(251, 113, 133, 0.85)");
        } else if (mine) {
          ctx.strokeStyle = pal.mint;
          ctx.lineWidth = 2;
          ctx.strokeRect(X + 1.5, Y + 1.5, w - 3, h - 3);
        } else {
          ctx.strokeStyle = pal.danger;
          ctx.lineWidth = Math.max(2, w * 0.1);
          ctx.beginPath();
          ctx.moveTo(X + w * 0.2, Y + h * 0.2);
          ctx.lineTo(X + w * 0.8, Y + h * 0.8);
          ctx.moveTo(X + w * 0.8, Y + h * 0.2);
          ctx.lineTo(X + w * 0.2, Y + h * 0.8);
          ctx.stroke();
        }
      }
    }
  }

  // ---- hover / keyboard cursor / touch press highlights ----
  if (!o.gameOver) {
    if (o.hover) {
      drawCellHighlight(ctx, world, o.hover.x, o.hover.y, x0, y0, x1, y1, xs, ys, pal.accent);
    }
    if (o.cursor) {
      drawCellHighlight(
        ctx,
        world,
        o.cursor.x,
        o.cursor.y,
        x0,
        y0,
        x1,
        y1,
        xs,
        ys,
        pal.mint,
        true,
      );
    }
    if (o.press) {
      const pr = o.press;
      drawCellHighlight(ctx, world, pr.x, pr.y, x0, y0, x1, y1, xs, ys, pal.flag);
      if (pr.isTouch && pr.progress > 0.08) {
        animating = true;
        const cx = (pr.x + 0.5 - left) * size;
        // Offset above the fingertip so the ring remains visible under a thumb!
        const cy = (pr.y + 0.5 - top) * size - Math.max(28, size * 0.65);
        const r = 15;
        ctx.save();
        ctx.fillStyle = "rgba(9, 13, 22, 0.82)";
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = pal.flag;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pr.progress));
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // ---- explosion shockwave ----
  if (o.explodedAt && !reduce) {
    const t = (now - o.explodedAt.at) / SHOCK_MS;
    if (t >= 0 && t < 1) {
      animating = true;
      const sx = (o.explodedAt.x + 0.5 - left) * size;
      const sy = (o.explodedAt.y + 0.5 - top) * size;
      const e = 1 - Math.pow(1 - t, 3);
      ctx.strokeStyle = `rgba(251, 113, 133, ${0.75 * (1 - t)})`;
      ctx.lineWidth = Math.max(1, 6 * (1 - t));
      ctx.beginPath();
      ctx.arc(sx, sy, size * (0.6 + e * 4.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(244, 63, 94, ${0.28 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size * (0.6 + e * 2.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- pooled particles & floating score pops ----
  if (o.effects && !reduce) {
    if (o.effects.step(now)) animating = true;
    for (const p of o.effects.particles) {
      const a = 1 - p.life / p.maxLife;
      const px = (p.wx - left) * size;
      const py = (p.wy - top) * size;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (o.effects.pops.length > 0) {
      ctx.font = `700 ${Math.max(12, Math.min(18, Math.round(size * 0.42)))}px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const pop of o.effects.pops) {
        const t = pop.life / pop.maxLife;
        const a = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
        const px = (pop.wx - left) * size;
        const py = (pop.wy - top) * size;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = "rgba(9, 13, 22, 0.75)";
        ctx.fillText(pop.text, px + 1, py + 1);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, px, py);
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
  return animating;
}

export const MINIMAP_CHUNK_PX = 5;

/** Overview of explored chunks around the camera. */
export function renderMinimap(
  ctx: CanvasRenderingContext2D,
  world: World,
  cam: Camera,
  w: number,
  h: number,
  palette: BoardPalette = COLORS,
) {
  const S = MINIMAP_CHUNK_PX;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(9, 13, 22, 0.88)";
  ctx.fillRect(0, 0, w, h);

  const ccx = cam.cx / CHUNK_SIZE;
  const ccy = cam.cy / CHUNK_SIZE;

  // subtle guide grid
  ctx.strokeStyle = "rgba(148, 163, 184, 0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const startX = w / 2 - (ccx - Math.floor(ccx)) * S;
  const startY = h / 2 - (ccy - Math.floor(ccy)) * S;
  for (let x = startX % (S * 4); x < w; x += S * 4) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = startY % (S * 4); y < h; y += S * 4) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();

  for (const chunk of world.chunks.values()) {
    if (chunk.revealed === 0) continue;
    const px = w / 2 + (chunk.cx - ccx) * S;
    const py = h / 2 + (chunk.cy - ccy) * S;
    if (px < -S || py < -S || px > w || py > h) continue;
    const a = 0.35 + 0.65 * Math.min(1, chunk.revealed / 260);
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = a;
    ctx.fillRect(Math.round(px), Math.round(py), S - 1, S - 1);
  }
  ctx.globalAlpha = 1;

  // origin marker (clamped to edge when out of range)
  const ox = w / 2 + (0.5 / CHUNK_SIZE - ccx) * S;
  const oy = h / 2 + (0.5 / CHUNK_SIZE - ccy) * S;
  const m = 7;
  const cxp = Math.min(w - m, Math.max(m, ox));
  const cyp = Math.min(h - m, Math.max(m, oy));
  ctx.strokeStyle = palette.mint;
  ctx.fillStyle = palette.mint;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cxp, cyp, 3, 0, Math.PI * 2);
  if (cxp === ox && cyp === oy) ctx.stroke();
  else ctx.fill();

  // viewport rectangle
  const vw = (cam.viewW / cam.size / CHUNK_SIZE) * S;
  const vh = (cam.viewH / cam.size / CHUNK_SIZE) * S;
  ctx.strokeStyle = "rgba(241, 245, 249, 0.9)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(w / 2 - vw / 2) + 0.5,
    Math.round(h / 2 - vh / 2) + 0.5,
    Math.max(3, vw),
    Math.max(3, vh),
  );
}
