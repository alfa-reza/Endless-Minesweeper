import { memo, useEffect, useRef, type MutableRefObject } from "react";
import { sfx } from "../game/audio";
import type { Camera } from "../game/camera";
import { DEFAULT_CELL } from "../game/config";
import type { Game } from "../game/game";
import { renderWorld } from "../game/renderer";
import { REVEALED } from "../game/world";

export type Tool = "dig" | "flag";
export type Cell = { x: number; y: number };

interface Props {
  game: Game;
  camera: Camera;
  tool: Tool;
  inputEnabled: boolean;
  hoverRef: MutableRefObject<Cell | null>;
}

type Mode = "idle" | "press" | "pan" | "pinch";

const MOUSE_DRAG_THRESHOLD = 5;
const TOUCH_DRAG_THRESHOLD = 9;
const LONG_PRESS_MS = 420;

function GameCanvasImpl({ game, camera, tool, inputEnabled, hoverRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Latest props for event handlers living inside effects.
  const live = useRef({ tool, inputEnabled });
  live.current = { tool, inputEnabled };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    let dpr = 1;
    let raf = 0;
    let disposed = false;

    // ---------- sizing ----------
    const resize = () => {
      const w = Math.max(1, wrap.clientWidth);
      const h = Math.max(1, wrap.clientHeight);
      dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      camera.resize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Redraw once the numeric font is available.
    document.fonts
      ?.load('700 16px "JetBrains Mono"')
      .then(() => {
        camera.dirty = true;
      })
      .catch(() => undefined);

    // ---------- input state ----------
    const pointers = new Map<number, { x: number; y: number }>();
    const mouse = { x: 0, y: 0, inside: false };
    const keys = new Set<string>();
    let spaceDown = false;
    let fast = false;
    let mode: Mode = "idle";
    let button = 0;
    let pointerType = "mouse";
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let longTimer = 0;
    let longFired = false;
    let pinchDist = 1;
    let pinchMidX = 0;
    let pinchMidY = 0;

    const setCursor = () => {
      if (!live.current.inputEnabled) canvas.style.cursor = "default";
      else if (mode === "pan") canvas.style.cursor = "grabbing";
      else if (spaceDown) canvas.style.cursor = "grab";
      else canvas.style.cursor = "crosshair";
    };
    setCursor();

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const doFlag = (x: number, y: number) => game.toggleFlag(x, y);
    const doDig = (x: number, y: number) => game.reveal(x, y);

    /** Primary action for a tap / left click. */
    const primary = (sx: number, sy: number) => {
      const c = camera.screenToCell(sx, sy);
      if (live.current.tool === "flag" && game.world.getState(c.x, c.y) !== REVEALED) {
        doFlag(c.x, c.y);
      } else {
        doDig(c.x, c.y);
      }
    };
    /** Secondary action: right click / long press. */
    const secondary = (sx: number, sy: number) => {
      const c = camera.screenToCell(sx, sy);
      if (pointerType !== "mouse" && live.current.tool === "flag") doDig(c.x, c.y);
      else doFlag(c.x, c.y);
    };

    const clearLong = () => {
      if (longTimer) window.clearTimeout(longTimer);
      longTimer = 0;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!live.current.inputEnabled) return;
      sfx.unlock();
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);

      if (pointers.size === 2) {
        clearLong();
        const [a, b] = [...pointers.values()];
        pinchDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        pinchMidX = (a.x + b.x) / 2;
        pinchMidY = (a.y + b.y) / 2;
        mode = "pinch";
        return;
      }
      if (pointers.size > 2) return;

      pointerType = e.pointerType;
      button = e.button;
      startX = lastX = p.x;
      startY = lastY = p.y;
      longFired = false;

      if (e.pointerType === "mouse" && (e.button === 1 || (e.button === 0 && spaceDown))) {
        e.preventDefault();
        mode = "pan";
        camera.cancelFlight();
      } else {
        mode = "press";
        if (e.pointerType !== "mouse") {
          longTimer = window.setTimeout(() => {
            if (mode !== "press") return;
            longFired = true;
            navigator.vibrate?.(18);
            secondary(startX, startY);
          }, LONG_PRESS_MS);
        }
      }
      setCursor();
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = local(e);
      if (e.pointerType === "mouse") {
        mouse.x = p.x;
        mouse.y = p.y;
        mouse.inside = true;
      }
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, p);

      if (mode === "pinch" && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        camera.zoomAt(mx, my, dist / pinchDist, true);
        camera.panBy(mx - pinchMidX, my - pinchMidY);
        pinchDist = dist;
        pinchMidX = mx;
        pinchMidY = my;
        return;
      }

      if (mode === "press" && button !== 2) {
        const th = pointerType === "mouse" ? MOUSE_DRAG_THRESHOLD : TOUCH_DRAG_THRESHOLD;
        if (Math.hypot(p.x - startX, p.y - startY) > th) {
          clearLong();
          mode = "pan";
          camera.cancelFlight();
          setCursor();
        }
      }
      if (mode === "pan") {
        camera.panBy(p.x - lastX, p.y - lastY);
        lastX = p.x;
        lastY = p.y;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const had = pointers.delete(e.pointerId);
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      if (!had) return;
      const p = local(e);

      if (mode === "pinch") {
        if (pointers.size === 1) {
          const [rest] = [...pointers.values()];
          lastX = rest.x;
          lastY = rest.y;
          mode = "pan";
        } else if (pointers.size === 0) {
          mode = "idle";
        }
        setCursor();
        return;
      }

      clearLong();
      if (mode === "press" && !longFired && live.current.inputEnabled) {
        if (button === 2) secondary(p.x, p.y);
        else if (button === 0) primary(p.x, p.y);
      }
      mode = "idle";
      setCursor();
    };

    const onPointerCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      clearLong();
      mode = pointers.size > 0 ? "pan" : "idle";
      setCursor();
    };

    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") mouse.inside = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!live.current.inputEnabled) return;
      const p = local(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
      const factor = e.ctrlKey ? Math.pow(1.012, -dy) : Math.pow(1.0016, -dy);
      camera.zoomAt(p.x, p.y, factor);
    };

    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      fast = e.shiftKey;
      if (e.code === "Space") {
        e.preventDefault();
        if (!spaceDown) {
          spaceDown = true;
          setCursor();
        }
        return;
      }
      if (!live.current.inputEnabled || e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        e.preventDefault();
        keys.add(k);
      } else if (k === "+" || k === "=") {
        camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1.3);
      } else if (k === "-" || k === "_") {
        camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1 / 1.3);
      } else if (k === "f" && mouse.inside && !e.repeat) {
        const c = camera.screenToCell(mouse.x, mouse.y);
        doFlag(c.x, c.y);
      } else if (k === "c" && !e.repeat) {
        camera.flyTo(0.5, 0.5, DEFAULT_CELL);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      fast = e.shiftKey;
      if (e.code === "Space") {
        e.preventDefault();
        spaceDown = false;
        setCursor();
      }
      keys.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      keys.clear();
      spaceDown = false;
      setCursor();
    };

    const noMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", noMenu);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    // ---------- render loop ----------
    let lastVersion = -1;
    let lastTime = performance.now();
    let animating = false;
    let lastInput = live.current.inputEnabled;

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(64, now - lastTime);
      lastTime = now;

      // keyboard panning
      if (keys.size > 0 && live.current.inputEnabled) {
        const speed = (fast ? 1100 : 620) * (dt / 1000);
        let dx = 0;
        let dy = 0;
        if (keys.has("arrowleft") || keys.has("a")) dx += speed;
        if (keys.has("arrowright") || keys.has("d")) dx -= speed;
        if (keys.has("arrowup") || keys.has("w")) dy += speed;
        if (keys.has("arrowdown") || keys.has("s")) dy -= speed;
        if (dx || dy) camera.panBy(dx, dy);
      }

      camera.update(now);

      if (lastInput !== live.current.inputEnabled) {
        lastInput = live.current.inputEnabled;
        setCursor();
        camera.dirty = true;
      }

      // hover cell tracking (mouse only)
      const hover = hoverRef.current;
      let nextHover: Cell | null = null;
      if (mouse.inside && live.current.inputEnabled && !game.isOver()) {
        nextHover = camera.screenToCell(mouse.x, mouse.y);
      }
      if (nextHover?.x !== hover?.x || nextHover?.y !== hover?.y) {
        hoverRef.current = nextHover;
        camera.dirty = true;
      }

      if (camera.dirty || animating || game.version !== lastVersion) {
        camera.dirty = false;
        lastVersion = game.version;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        animating = renderWorld(ctx, game.world, camera, {
          now,
          hover: hoverRef.current,
          gameOver: game.isOver(),
          explodedAt: game.explodedAt,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearLong();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", noMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [game, camera, hoverRef]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" />
    </div>
  );
}

export const GameCanvas = memo(GameCanvasImpl);
