import { Flag, Minus, Pickaxe, Plus } from "lucide-react";
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type { Camera } from "../game/camera";
import { DEFAULT_CELL } from "../game/config";
import { cn } from "../utils/cn";
import type { Cell, Tool } from "./GameCanvas";

/** Dig / Flag segmented switch – decides what a tap or left-click does. */
export function ToolSwitch({ tool, onChange }: { tool: Tool; onChange: (t: Tool) => void }) {
  const opt = (id: Tool, label: string, icon: ReactNode, active: string) => (
    <button
      role="radio"
      aria-checked={tool === id}
      onClick={() => onChange(id)}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all duration-150 select-none",
        tool === id ? active : "text-muted/70 hover:bg-white/5 hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Tap action" className="glass flex gap-1 rounded-2xl p-1">
      {opt("dig", "Dig", <Pickaxe size={16} />, "bg-accent/90 text-[#0b0e22] shadow-[0_4px_18px_rgba(122,162,255,0.45)]")}
      {opt("flag", "Flag", <Flag size={16} />, "bg-flag text-[#2a1a00] shadow-[0_4px_18px_rgba(255,175,56,0.4)]")}
    </div>
  );
}

/** Cursor / centre coordinates and zoom buttons. */
export function ViewReadout({
  camera,
  hoverRef,
}: {
  camera: Camera;
  hoverRef: MutableRefObject<Cell | null>;
}) {
  const [text, setText] = useState("");
  const last = useRef("");

  useEffect(() => {
    const tick = () => {
      const c = hoverRef.current ?? {
        x: Math.floor(camera.cx),
        y: Math.floor(camera.cy),
      };
      const zoom = Math.round((camera.size / DEFAULT_CELL) * 100);
      const next = `${c.x}, ${c.y}  ·  ${zoom}%`;
      if (next !== last.current) {
        last.current = next;
        setText(next);
      }
    };
    tick();
    const id = window.setInterval(tick, 90);
    return () => window.clearInterval(id);
  }, [camera, hoverRef]);

  const zoom = (f: number) => camera.zoomAt(camera.viewW / 2, camera.viewH / 2, f);

  return (
    <div className="glass flex items-center gap-1 rounded-2xl p-1">
      <button className="btn btn-icon !h-9 !w-9" onClick={() => zoom(1 / 1.3)} aria-label="Zoom out" title="Zoom out (−)">
        <Minus size={16} />
      </button>
      <div className="min-w-[116px] px-2 text-center font-mono text-[12px] whitespace-pre text-muted/85 tabular-nums">
        {text}
      </div>
      <button className="btn btn-icon !h-9 !w-9" onClick={() => zoom(1.3)} aria-label="Zoom in" title="Zoom in (+)">
        <Plus size={16} />
      </button>
    </div>
  );
}
