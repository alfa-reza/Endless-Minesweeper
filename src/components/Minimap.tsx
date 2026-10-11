import { Map as MapIcon, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { sfx } from "../game/audio";
import type { Camera } from "../game/camera";
import { getBoardPalette } from "../game/config";
import type { Game } from "../game/game";
import { MINIMAP_CHUNK_PX, renderMinimap } from "../game/renderer";
import { CHUNK_SIZE } from "../game/world";

const DESKTOP_SIZE = 144;
const MOBILE_SIZE = 128;

interface Props {
  game: Game;
  camera: Camera;
  highContrast: boolean;
}

function useCompactViewport() {
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 639px), (max-height: 499px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px), (max-height: 499px)");
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return compact;
}

/** Event-driven explored-chunks overview. Collapsible on narrow/mobile viewports; supports tap & drag jump. */
export function Minimap({ game, camera, highContrast }: Props) {
  const compact = useCompactViewport();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [openCompact, setOpenCompact] = useState(false);
  const dragging = useRef(false);
  const size = compact ? MOBILE_SIZE : DESKTOP_SIZE;
  const visible = !compact || openCompact;

  useEffect(() => {
    if (!visible) return;
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
  }, [game, camera, highContrast, size, visible]);

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

  if (compact && !openCompact) {
    return (
      <button
        type="button"
        className="btn btn-icon surface"
        onClick={() => {
          sfx.click();
          setOpenCompact(true);
        }}
        aria-label="Open minimap"
        title="Minimap"
      >
        <MapIcon size={18} aria-hidden="true" />
      </button>
    );
  }

  return (
    <div className="relative">
      <div
        className={
          compact
            ? "surface absolute right-0 bottom-0 z-20 overflow-hidden rounded-md p-1"
            : "surface relative overflow-hidden rounded-md p-1"
        }
      >
        {compact && (
          <button
            type="button"
            onClick={() => {
              sfx.click();
              setOpenCompact(false);
            }}
            aria-label="Collapse minimap"
            className="focus-ring absolute top-1.5 right-1.5 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-md border border-[#353b47] bg-[#191c22]/95 text-ink"
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
          className="block cursor-pointer touch-none rounded-lg"
          style={{ width: size, height: size }}
        />
      </div>
    </div>
  );
}
