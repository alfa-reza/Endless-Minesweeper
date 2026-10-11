import type { Camera } from "./camera";
import { COLORS } from "./config";
import {
  CHUNK_SIZE,
  EXPLODED,
  FLAGGED,
  FOG_RADIUS,
  HIDDEN,
  REVEALED,
  type World,
} from "./world";

export interface RenderOptions {
  now: number;
  hover: { x: number; y: number } | null;
  gameOver: boolean;
  explodedAt: { x: number; y: number; at: number } | null;
}

const REVEAL_MS = 200;
const SHOCK_MS = 900;
const NUM_STR = ["", "1", "2", "3", "4", "5", "6", "7", "8"];
const FONT_FAMILY = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function drawHiddenTile(
  ctx: CanvasRenderingContext2D,
  X: number,
  Y: number,
  w: number,
  h: number,
  fog: number,
) {
  ctx.globalAlpha = 0.22 + 0.78 * (fog / (FOG_RADIUS + 1));
  ctx.fillStyle = COLORS.hidden;
  ctx.fillRect(X, Y, w, h);
  if (w >= 12) {
    ctx.fillStyle = COLORS.hiddenHi;
    ctx.fillRect(X, Y, w, 1);
    ctx.fillRect(X, Y, 1, h);
    ctx.fillStyle = COLORS.hiddenLo;
    ctx.fillRect(X, Y + h - 1, w, 1);
    ctx.fillRect(X + w - 1, Y, 1, h);
  }
  ctx.globalAlpha = 1;
}

function drawFlag(ctx: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number) {
  ctx.fillStyle = COLORS.flag;
  ctx.beginPath();
  ctx.moveTo(X + w * 0.32, Y + h * 0.18);
  ctx.lineTo(X + w * 0.76, Y + h * 0.37);
  ctx.lineTo(X + w * 0.32, Y + h * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e8ebff";
  ctx.fillRect(X + w * 0.32 - 1, Y + h * 0.18, Math.max(1.5, w * 0.06), h * 0.62);
  ctx.fillStyle = "rgba(232,235,255,0.65)";
  ctx.fillRect(X + w * 0.2, Y + h * 0.78, w * 0.3, Math.max(1.5, h * 0.06));
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
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.33, cy - r * 0.33, Math.max(1, r * 0.24), 0, Math.PI * 2);
  ctx.fill();
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
  let animating = false;

  // ---- background ----
  ctx.globalAlpha = 1;
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
  bg.addColorStop(0, COLORS.baseGlow);
  bg.addColorStop(1, COLORS.base);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ---- visible range & pixel edges (rounded so tiles never leave seams) ----
  const left = cam.cx - W / (2 * size);
  const top = cam.cy - H / (2 * size);
  const x0 = Math.floor(left);
  const y0 = Math.floor(top);
  const x1 = Math.ceil(left + W / size);
  const y1 = Math.ceil(top + H / size);
  const cols = x1 - x0 + 1;
  const rows = y1 - y0 + 1;
  const xs = new Int32Array(cols + 1);
  const ys = new Int32Array(rows + 1);
  for (let i = 0; i <= cols; i++) xs[i] = Math.round((x0 + i - left) * size);
  for (let j = 0; j <= rows; j++) ys[j] = Math.round((y0 + j - top) * size);

  // ---- faint grid + chunk guides ----
  if (size >= 12) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.gridFaint;
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
    ctx.strokeStyle = COLORS.gridChunk;
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
            drawHiddenTile(ctx, X, Y, w, h, fog);
            continue;
          }
          if (st === FLAGGED) {
            drawHiddenTile(ctx, X, Y, w, h, Math.max(fog, 2));
            drawFlag(ctx, X, Y, w, h);
            continue;
          }

          const p = (now - chunk.stamp[i]) / REVEAL_MS;

          if (st === EXPLODED) {
            drawHiddenTile(ctx, X, Y, w, h, FOG_RADIUS + 1);
            ctx.fillStyle = "rgba(255,70,90,0.38)";
            ctx.fillRect(X, Y, w, h);
            drawMine(ctx, X + w / 2, Y + h / 2, w * 0.26, COLORS.danger);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(X + 1.5, Y + 1.5, w - 3, h - 3);
            continue;
          }

          // revealed
          if (p <= 0) {
            animating = true;
            drawHiddenTile(ctx, X, Y, w, h, FOG_RADIUS + 1);
            continue;
          }
          const n = chunk.num[i];
          let ease = 1;
          if (p < 1) {
            animating = true;
            ease = p * (2 - p);
            drawHiddenTile(ctx, X, Y, w, h, FOG_RADIUS + 1);
            ctx.globalAlpha = ease;
          }
          ctx.fillStyle =
            n === 0 ? COLORS.revealedZero : (x + y) & 1 ? COLORS.revealedA : COLORS.revealedB;
          ctx.fillRect(X, Y, w, h);
          if (w >= 12) {
            ctx.fillStyle = "rgba(6,8,40,0.26)";
            ctx.fillRect(X, Y + h - 1, w, 1);
            ctx.fillRect(X + w - 1, Y, 1, h);
          }
          ctx.globalAlpha = 1;

          if (n > 0) {
            ctx.fillStyle = COLORS.numbers[n - 1];
            if (p < 1) {
              ctx.save();
              ctx.globalAlpha = ease;
              ctx.translate(X + w / 2, Y + h / 2);
              ctx.scale(0.6 + 0.4 * ease, 0.6 + 0.4 * ease);
              ctx.fillText(NUM_STR[n], 0, 1);
              ctx.restore();
            } else {
              ctx.fillText(NUM_STR[n], X + w / 2, Y + h / 2 + 1);
            }
          }
          if (p < 1) {
            ctx.strokeStyle = `rgba(255,255,255,${0.2 * (1 - p)})`;
            ctx.lineWidth = 2;
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
          ctx.fillStyle = "rgba(255,90,100,0.14)";
          ctx.fillRect(X, Y, w, h);
          drawMine(ctx, X + w / 2, Y + h / 2, w * 0.22, "rgba(255,107,107,0.8)");
        } else if (mine) {
          ctx.strokeStyle = COLORS.mint;
          ctx.lineWidth = 2;
          ctx.strokeRect(X + 1.5, Y + 1.5, w - 3, h - 3);
        } else {
          ctx.strokeStyle = COLORS.danger;
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

  // ---- hover highlight ----
  if (o.hover && !o.gameOver) {
    const { x, y } = o.hover;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
      const st = world.getState(x, y);
      if (st === REVEALED && world.getNumber(x, y) > 0) {
        ctx.fillStyle = "rgba(122,162,255,0.20)";
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
        ctx.fillStyle = "rgba(122,162,255,0.16)";
        ctx.fillRect(X, Y, w, h);
      }
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(X + 1, Y + 1, w - 2, h - 2);
    }
  }

  // ---- explosion shockwave ----
  if (o.explodedAt) {
    const t = (now - o.explodedAt.at) / SHOCK_MS;
    if (t >= 0 && t < 1) {
      animating = true;
      const sx = (o.explodedAt.x + 0.5 - left) * size;
      const sy = (o.explodedAt.y + 0.5 - top) * size;
      const e = 1 - Math.pow(1 - t, 3);
      ctx.strokeStyle = `rgba(255,120,110,${0.7 * (1 - t)})`;
      ctx.lineWidth = Math.max(1, 6 * (1 - t));
      ctx.beginPath();
      ctx.arc(sx, sy, size * (0.6 + e * 4.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,90,80,${0.28 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size * (0.6 + e * 2.2), 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
) {
  const S = MINIMAP_CHUNK_PX;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(8,10,28,0.78)";
  ctx.fillRect(0, 0, w, h);

  const ccx = cam.cx / CHUNK_SIZE;
  const ccy = cam.cy / CHUNK_SIZE;

  // subtle guide grid
  ctx.strokeStyle = "rgba(140,170,255,0.06)";
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
    const a = 0.3 + 0.7 * Math.min(1, chunk.revealed / 260);
    ctx.fillStyle = `rgba(122,162,255,${a})`;
    ctx.fillRect(Math.round(px), Math.round(py), S - 1, S - 1);
  }

  // origin marker (clamped to edge when out of range)
  const ox = w / 2 + (0.5 / CHUNK_SIZE - ccx) * S;
  const oy = h / 2 + (0.5 / CHUNK_SIZE - ccy) * S;
  const m = 7;
  const cxp = Math.min(w - m, Math.max(m, ox));
  const cyp = Math.min(h - m, Math.max(m, oy));
  ctx.strokeStyle = COLORS.mint;
  ctx.fillStyle = COLORS.mint;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cxp, cyp, 3, 0, Math.PI * 2);
  if (cxp === ox && cyp === oy) ctx.stroke();
  else ctx.fill();

  // viewport rectangle
  const vw = (cam.viewW / cam.size / CHUNK_SIZE) * S;
  const vh = (cam.viewH / cam.size / CHUNK_SIZE) * S;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    Math.round(w / 2 - vw / 2) + 0.5,
    Math.round(h / 2 - vh / 2) + 0.5,
    Math.max(3, vw),
    Math.max(3, vh),
  );
}
