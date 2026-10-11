import { useEffect, useRef } from "react";
import { Camera } from "../game/camera";
import { renderWorld } from "../game/renderer";
import { HIDDEN, REVEALED, World } from "../game/world";

/** Lightweight, self-playing board that drifts behind the main menu. */
export function MenuBackdrop({
  reduceMotion,
  highContrast,
}: {
  reduceMotion: boolean;
  highContrast: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ reduceMotion, highContrast });
  live.current = { reduceMotion, highContrast };

  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const world = new World((Math.random() * 1e9) >>> 0, 0.15);
    const cam = new Camera();
    cam.size = cam.target = 38;
    const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let nextAct = last + 200;
    let disposed = false;

    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      cam.resize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const rand = (n: number) => Math.floor(Math.random() * n);

    const act = (now: number) => {
      const cols = Math.ceil(cam.viewW / cam.size);
      const rows = Math.ceil(cam.viewH / cam.size);
      const left = Math.floor(cam.cx - cols / 2);
      const top = Math.floor(cam.cy - rows / 2);

      if (Math.random() < 0.55) {
        for (let t = 0; t < 10; t++) {
          const x = left + rand(cols);
          const y = top + rand(rows);
          if (world.getState(x, y) !== HIDDEN || world.isMine(x, y)) continue;
          world.flood(x, y, now, 45, 70);
          return;
        }
      }
      for (let t = 0; t < 40; t++) {
        const x = left + rand(cols);
        const y = top + rand(rows);
        if (world.getState(x, y) !== HIDDEN || !world.isMine(x, y)) continue;
        const touches = world.neighbors().some(([dx, dy]) => world.getState(x + dx, y + dy) === REVEALED);
        if (!touches) continue;
        world.toggleFlag(x, y, now);
        return;
      }
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderWorld(ctx, world, cam, {
        now,
        hover: null,
        gameOver: false,
        explodedAt: null,
        highContrast: live.current.highContrast,
        reduceMotion: live.current.reduceMotion || osReduce,
      });
    };

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(64, now - last);
      last = now;
      const reduce = live.current.reduceMotion || osReduce;
      if (!reduce && !document.hidden) {
        cam.cx += dt * 0.00035;
        cam.cy += dt * 0.00014;
        if (now >= nextAct) {
          act(now);
          nextAct = now + 520 + Math.random() * 580;
        }
        draw(now);
      }
      raf = requestAnimationFrame(frame);
    };

    cam.cx = 0.5;
    cam.cy = 0.5;
    for (let i = 0; i < 8; i++) act(performance.now() - 2000);
    draw(performance.now());
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full opacity-90" />
    </div>
  );
}
