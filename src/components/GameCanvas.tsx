import { memo, useEffect, useRef, type MutableRefObject } from "react";
import { sfx } from "../game/audio";
import type { Camera } from "../game/camera";
import { defaultCellSize, minCellSize } from "../game/config";
import type { Game } from "../game/game";
import { EffectsPool, renderWorld, type PressIndicator } from "../game/renderer";
import { REVEALED } from "../game/world";

export type Tool = "dig" | "flag";
export type Cell = { x: number; y: number };

interface Props {
  game: Game;
  camera: Camera;
  tool: Tool;
  inputEnabled: boolean;
  coarse: boolean;
  longPressMs: number;
  haptics: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  hoverRef: MutableRefObject<Cell | null>;
  effects: EffectsPool;
  onHoverChange: () => void;
  onPauseRequest: () => void;
}

type Mode = "idle" | "press" | "pan" | "pinch";

const MOUSE_DRAG_THRESHOLD = 5;
const TOUCH_DRAG_THRESHOLD = 10;

function GameCanvasImpl({
  game,
  camera,
  tool,
  inputEnabled,
  coarse,
  longPressMs,
  haptics,
  highContrast,
  reduceMotion,
  hoverRef,
  effects,
  onHoverChange,
  onPauseRequest,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const live = useRef({
    tool,
    inputEnabled,
    coarse,
    longPressMs,
    haptics,
    highContrast,
    reduceMotion,
    onHoverChange,
    onPauseRequest,
  });
  live.current = {
    tool,
    inputEnabled,
    coarse,
    longPressMs,
    haptics,
    highContrast,
    reduceMotion,
    onHoverChange,
    onPauseRequest,
  };

  useEffect(() => {
    camera.size = camera.target = defaultCellSize(coarse);
    camera.setMinSize(minCellSize(coarse));
  }, [camera, coarse]);

  useEffect(() => {
    camera.dirty = true;
  }, [camera, highContrast, reduceMotion]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    let dpr = 1;
    let raf = 0;
    let disposed = false;

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
    let cursor: Cell | null = null;
    let activePress: { x: number; y: number; startAt: number; isTouch: boolean } | null = null;
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

    // Gamepad state
    let lastGpMove = 0;
    let prevGpButtons: boolean[] = [];

    const setCursorStyle = () => {
      if (!live.current.inputEnabled) canvas.style.cursor = "default";
      else if (mode === "pan") canvas.style.cursor = "grabbing";
      else if (spaceDown) canvas.style.cursor = "grab";
      else canvas.style.cursor = "crosshair";
    };
    setCursorStyle();

    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const doFlag = (x: number, y: number) => game.toggleFlag(x, y);
    const doDig = (x: number, y: number) => game.reveal(x, y);

    /** Primary action for tap / left click. */
    const primary = (sx: number, sy: number) => {
      const c = camera.screenToCell(sx, sy);
      if (live.current.tool === "flag" && game.world.getState(c.x, c.y) !== REVEALED) {
        doFlag(c.x, c.y);
      } else {
        doDig(c.x, c.y);
      }
    };

    /** Secondary action: right-click always toggles flag; touch long-press toggles flag safely (never digs in Flag mode!). */
    const secondary = (sx: number, sy: number) => {
      const c = camera.screenToCell(sx, sy);
      doFlag(c.x, c.y);
    };

    const clearLong = () => {
      if (longTimer) window.clearTimeout(longTimer);
      longTimer = 0;
      if (activePress) {
        activePress = null;
        camera.dirty = true;
      }
    };

    const moveTileCursor = (dx: number, dy: number) => {
      if (!cursor) {
        cursor = { x: Math.floor(camera.cx), y: Math.floor(camera.cy) };
      } else {
        cursor = { x: cursor.x + dx, y: cursor.y + dy };
      }
      camera.ensureCellVisible(cursor.x, cursor.y, 2);
      camera.dirty = true;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!live.current.inputEnabled) return;
      sfx.unlock();
      cursor = null;
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
        const cell = camera.screenToCell(p.x, p.y);
        const isTouch = e.pointerType !== "mouse";
        activePress = { x: cell.x, y: cell.y, startAt: performance.now(), isTouch };
        camera.dirty = true;

        if (isTouch) {
          longTimer = window.setTimeout(() => {
            if (mode !== "press") return;
            longFired = true;
            activePress = null;
            if (live.current.haptics) navigator.vibrate?.(18);
            secondary(startX, startY);
            camera.dirty = true;
          }, live.current.longPressMs);
        }
      }
      setCursorStyle();
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = local(e);
      if (e.pointerType === "mouse") {
        mouse.x = p.x;
        mouse.y = p.y;
        mouse.inside = true;
        if (cursor) {
          cursor = null;
          camera.dirty = true;
        }
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
          setCursorStyle();
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
        setCursorStyle();
        return;
      }

      clearLong();
      if (mode === "press" && !longFired && live.current.inputEnabled) {
        if (button === 2) secondary(p.x, p.y);
        else if (button === 0) primary(p.x, p.y);
      }
      mode = "idle";
      setCursorStyle();
    };

    const onPointerCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      clearLong();
      mode = pointers.size > 0 ? "pan" : "idle";
      setCursorStyle();
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
      // Fix: never hijack Space or keys when a modal/overlay is open!
      if (!live.current.inputEnabled || typing(e.target)) return;
      sfx.unlock();

      fast = e.shiftKey;
      if (e.code === "Space") {
        e.preventDefault();
        if (!spaceDown) {
          spaceDown = true;
          setCursorStyle();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) {
        e.preventDefault();
        if (e.shiftKey) {
          keys.add(k);
        } else {
          // Tile-by-tile cursor navigation for keyboard-only play
          if (k === "arrowleft" || k === "a") moveTileCursor(-1, 0);
          else if (k === "arrowright" || k === "d") moveTileCursor(1, 0);
          else if (k === "arrowup" || k === "w") moveTileCursor(0, -1);
          else if (k === "arrowdown" || k === "s") moveTileCursor(0, 1);
        }
      } else if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        const target = cursor ?? (mouse.inside ? camera.screenToCell(mouse.x, mouse.y) : { x: Math.floor(camera.cx), y: Math.floor(camera.cy) });
        cursor = target;
        if (live.current.tool === "flag" && game.world.getState(target.x, target.y) !== REVEALED) {
          doFlag(target.x, target.y);
        } else {
          doDig(target.x, target.y);
        }
      } else if (k === "+" || k === "=") {
        camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1.3);
      } else if (k === "-" || k === "_") {
        camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1 / 1.3);
      } else if (k === "f" && !e.repeat) {
        const target = cursor ?? (mouse.inside ? camera.screenToCell(mouse.x, mouse.y) : null);
        if (target) doFlag(target.x, target.y);
      } else if (k === "c" && !e.repeat) {
        cursor = { x: 0, y: 0 };
        camera.flyTo(0.5, 0.5, defaultCellSize(live.current.coarse));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      fast = e.shiftKey;
      if (e.code === "Space") {
        if (live.current.inputEnabled) e.preventDefault();
        spaceDown = false;
        setCursorStyle();
      }
      keys.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      keys.clear();
      spaceDown = false;
      clearLong();
      setCursorStyle();
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

    const pollGamepad = (now: number, dt: number) => {
      const pads = navigator.getGamepads?.();
      if (!pads) return;
      const gp = pads.find((p): p is Gamepad => !!p && p.connected);
      if (!gp) return;

      const pressed = (idx: number) => !!gp.buttons[idx]?.pressed;
      const edge = (idx: number) => pressed(idx) && !prevGpButtons[idx];

      if (edge(9)) live.current.onPauseRequest();

      if (live.current.inputEnabled) {
        // Right stick pans camera
        const rx = Math.abs(gp.axes[2] ?? 0) > 0.2 ? gp.axes[2] : 0;
        const ry = Math.abs(gp.axes[3] ?? 0) > 0.2 ? gp.axes[3] : 0;
        if (rx || ry) camera.panBy(-rx * 650 * (dt / 1000), -ry * 650 * (dt / 1000));

        // D-pad / Left stick moves tile cursor
        let mx = 0;
        let my = 0;
        if (pressed(14) || (gp.axes[0] ?? 0) < -0.5) mx = -1;
        else if (pressed(15) || (gp.axes[0] ?? 0) > 0.5) mx = 1;
        if (pressed(12) || (gp.axes[1] ?? 0) < -0.5) my = -1;
        else if (pressed(13) || (gp.axes[1] ?? 0) > 0.5) my = 1;
        if ((mx !== 0 || my !== 0) && now - lastGpMove > 145) {
          lastGpMove = now;
          moveTileCursor(mx, my);
        }

        if (edge(0)) {
          sfx.unlock();
          const target = cursor ?? { x: Math.floor(camera.cx), y: Math.floor(camera.cy) };
          cursor = target;
          doDig(target.x, target.y);
        }
        if (edge(2) || edge(1)) {
          sfx.unlock();
          const target = cursor ?? { x: Math.floor(camera.cx), y: Math.floor(camera.cy) };
          cursor = target;
          doFlag(target.x, target.y);
        }
        if (edge(4)) camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1 / 1.25);
        if (edge(5)) camera.zoomAt(camera.viewW / 2, camera.viewH / 2, 1.25);
      }

      prevGpButtons = gp.buttons.map((b) => b.pressed);
    };

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(64, now - lastTime);
      lastTime = now;

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

      pollGamepad(now, dt);
      camera.update(now, live.current.reduceMotion);

      if (lastInput !== live.current.inputEnabled) {
        lastInput = live.current.inputEnabled;
        setCursorStyle();
        camera.dirty = true;
      }

      const hover = hoverRef.current;
      let nextHover: Cell | null = null;
      if (mouse.inside && live.current.inputEnabled && !game.isOver()) {
        nextHover = camera.screenToCell(mouse.x, mouse.y);
      }
      if (nextHover?.x !== hover?.x || nextHover?.y !== hover?.y) {
        hoverRef.current = nextHover;
        live.current.onHoverChange();
        camera.dirty = true;
      }

      let press: PressIndicator | null = null;
      if (activePress) {
        press = {
          x: activePress.x,
          y: activePress.y,
          progress: Math.min(1, (now - activePress.startAt) / live.current.longPressMs),
          isTouch: activePress.isTouch,
        };
      }

      if (camera.dirty || animating || press || game.version !== lastVersion) {
        camera.dirty = false;
        lastVersion = game.version;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        animating = renderWorld(ctx, game.world, camera, {
          now,
          hover: hoverRef.current,
          cursor: live.current.inputEnabled ? cursor : null,
          press,
          gameOver: game.isOver(),
          explodedAt: game.explodedAt,
          highContrast: live.current.highContrast,
          reduceMotion: live.current.reduceMotion,
          effects,
          showStartBeacon: game.status === "ready",
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
  }, [game, camera, hoverRef, effects]);

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      <canvas ref={canvasRef} className="block h-full w-full touch-none select-none" />
    </div>
  );
}

export const GameCanvas = memo(GameCanvasImpl);
