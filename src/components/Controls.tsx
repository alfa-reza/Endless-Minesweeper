import { Flag, Minus, Pickaxe, Plus } from "lucide-react";
import { useEffect, useState, type MutableRefObject, type ReactNode } from "react";
import { sfx } from "../game/audio";
import type { Camera } from "../game/camera";
import { DEFAULT_CELL } from "../game/config";
import { cn } from "../utils/cn";
import type { Cell, Tool } from "./GameCanvas";

/** Dig / Flag segmented switch – decides what a tap or left-click does. */
export function ToolSwitch({ tool, onChange }: { tool: Tool; onChange: (t: Tool) => void }) {
  const opt = (id: Tool, label: string, icon: ReactNode, active: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={tool === id}
      onClick={() => {
        if (tool !== id) {
          sfx.click();
          onChange(id);
        }
      }}
      className={cn(
        "focus-ring flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-[14px] font-bold transition-colors duration-100 select-none touch-manipulation",
        tool === id ? active : "text-muted hover:bg-white/5 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Tap action" className="surface flex gap-1 rounded-xl p-1">
      {opt("dig", "Dig", <Pickaxe size={16} aria-hidden="true" />, "bg-mint text-[#052e16]")}
      {opt("flag", "Flag", <Flag size={16} aria-hidden="true" />, "bg-flag text-[#271800]")}
    </div>
  );
}

/** Compact zoom controls for touch / narrow mobile viewports. */
export function MobileZoomControls({ camera }: { camera: Camera }) {
  const zoom = (f: number) => {
    sfx.click();
    camera.zoomAt(camera.viewW / 2, camera.viewH / 2, f);
  };
  return (
    <div className="surface flex items-center gap-1 rounded-xl p-1 sm:hidden">
      <button
        type="button"
        className="btn btn-icon"
        onClick={() => zoom(1 / 1.25)}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-icon"
        onClick={() => zoom(1.25)}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Cursor / centre coordinates and zoom buttons (event-driven via camera subscription). */
export function ViewReadout({
  camera,
  hoverRef,
  subscribeHover,
}: {
  camera: Camera;
  hoverRef: MutableRefObject<Cell | null>;
  subscribeHover: (fn: () => void) => () => void;
}) {
  const format = () => {
    const c = hoverRef.current ?? {
      x: Math.floor(camera.cx),
      y: Math.floor(camera.cy),
    };
    const zoom = Math.round((camera.size / DEFAULT_CELL) * 100);
    return `${c.x}, ${c.y}  ·  ${zoom}%`;
  };

  const [text, setText] = useState(format);

  useEffect(() => {
    const update = () => setText(format());
    update();
    const unsubCam = camera.subscribe(update);
    const unsubHover = subscribeHover(update);
    return () => {
      unsubCam();
      unsubHover();
    };
  }, [camera, subscribeHover]);

  const zoom = (f: number) => {
    sfx.click();
    camera.zoomAt(camera.viewW / 2, camera.viewH / 2, f);
  };

  return (
    <div className="surface flex items-center gap-1 rounded-xl p-1">
      <button
        type="button"
        className="btn btn-icon"
        onClick={() => zoom(1 / 1.3)}
        aria-label="Zoom out"
        title="Zoom out (−)"
      >
        <Minus size={17} aria-hidden="true" />
      </button>
      <div className="min-w-[116px] px-2 text-center font-mono text-[12.5px] whitespace-pre text-ink/90 tabular-nums">
        {text}
      </div>
      <button
        type="button"
        className="btn btn-icon"
        onClick={() => zoom(1.3)}
        aria-label="Zoom in"
        title="Zoom in (+)"
      >
        <Plus size={17} aria-hidden="true" />
      </button>
    </div>
  );
}
