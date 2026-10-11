import { Map as MapIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { sfx } from "../game/audio";
import type { Camera } from "../game/camera";
import { getBoardPalette } from "../game/config";
import type { Game } from "../game/game";
import { MINIMAP_CHUNK_PX, renderMinimap } from "../game/renderer";
import { CHUNK_SIZE } from "../game/world";

const DESKTOP_SIZE = 148;
const MOBILE_SIZE = 120;

interface Props {
  game: Game;
  camera: Camera;
  highContrast: boolean;
  coarse: boolean;
}

/** Event-driven explored-chunks overview. Collapsible on mobile; supports tap & drag jump. */
export function Minimap({ game, camera, highContrast, coarse }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const dragging = useRef(false);
  const size = coarse ? MOBILE_SIZE : DESKTOP_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const palette = getBoardPalette(highContrast);

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderMinimap(ctx, game.world, camera, size, size, palette);
    };
    draw();
    const unsubGame = game.subscribe(draw);
    const unsubCam = camera.subscribe(draw);
    return () => {
      unsubGame();
      unsubCam();
    };
  }, [game, camera, highContrast, size, openOnMobile]);

  const jumpAt = (e: ReactPointerEvent<HTMLCanvasElement>, immediate: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * size;
    const my = ((e.clientY - r.top) / r.height) * size;
    const wx = camera.cx + ((mx - size / 2) / MINIMAP_CHUNK_PX) * CHUNK_SIZE;
    const wy = camera.cy + ((my - size / 2) / MINIMAP_CHUNK_PX) * CHUNK_SIZE;
    if (immediate) {
      camera.cx = wx;
      camera.cy = wy;
      camera.cancelFlight();
      camera.dirty = true;
    } else {
      camera.flyTo(wx, wy, camera.size, 420);
    }
  };

  if (coarse && !openOnMobile) {
    return (
      <button
        type="button"
        className="btn btn-icon surface"
        onClick={() => {
          sfx.click();
          setOpenOnMobile(true);
        }}
        aria-label="Open minimap"
        title="Minimap"
      >
        <MapIcon size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="surface relative overflow-hidden rounded-2xl p-1">
      {coarse && (
        <button
          type="button"
          onClick={() => {
            sfx.click();
            setOpenOnMobile(false);
          }}
          aria-label="Collapse minimap"
          className="focus-ring absolute top-1.5 right-1.5 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-[#2c3b59] bg-[#0f172a]/90 text-ink"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = true;
          sfx.click();
          jumpAt(e, false);
        }}
        onPointerMove={(e) => {
          if (dragging.current) jumpAt(e, true);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        title="Minimap — tap or drag to travel"
        aria-label="Minimap of explored area"
        className="block cursor-pointer touch-none rounded-xl"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
