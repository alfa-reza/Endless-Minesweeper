import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Camera } from "../game/camera";
import type { Game } from "../game/game";
import { MINIMAP_CHUNK_PX, renderMinimap } from "../game/renderer";
import { CHUNK_SIZE } from "../game/world";

const SIZE = 152;

interface Props {
  game: Game;
  camera: Camera;
}

/** Overview of explored chunks. Click to jump anywhere on it. */
export function Minimap({ game, camera }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderMinimap(ctx, game.world, camera, SIZE, SIZE);
    };
    draw();
    const id = window.setInterval(draw, 100);
    return () => window.clearInterval(id);
  }, [game, camera]);

  const jump = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * SIZE;
    const my = ((e.clientY - r.top) / r.height) * SIZE;
    const wx = camera.cx + ((mx - SIZE / 2) / MINIMAP_CHUNK_PX) * CHUNK_SIZE;
    const wy = camera.cy + ((my - SIZE / 2) / MINIMAP_CHUNK_PX) * CHUNK_SIZE;
    camera.flyTo(wx, wy, camera.size, 450);
  };

  return (
    <div className="glass overflow-hidden rounded-2xl p-1">
      <canvas
        ref={ref}
        onPointerDown={jump}
        title="Minimap — click to travel"
        aria-label="Minimap of explored area"
        className="block h-28 w-28 cursor-pointer rounded-xl sm:h-[152px] sm:w-[152px]"
      />
    </div>
  );
}
