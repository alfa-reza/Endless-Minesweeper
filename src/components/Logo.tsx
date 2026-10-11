import { cn } from "../utils/cn";

/** Geometric Endless Minesweeper emblem (flat vector, no gradients). */
export function MineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-10 w-10", className)} aria-hidden="true">
      {/* Tile frame */}
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#1e232b" stroke="#353b47" strokeWidth="3" />
      {/* Subtle 2x2 grid lines */}
      <path d="M32 10v44M10 32h44" stroke="#2a303b" strokeWidth="2" />
      {/* Spikes */}
      <g stroke="#f43f5e" strokeWidth="4.5" strokeLinecap="round">
        <path d="M32 12v8M32 44v8M12 32h8M44 32h8M18 18l6 6M40 40l6 6M46 18l-6 6M24 40l-6 6" />
      </g>
      {/* Core */}
      <circle cx="32" cy="32" r="11" fill="#f43f5e" />
      <circle cx="32" cy="32" r="4.5" fill="#111317" />
      {/* Corner safe-tile accent */}
      <rect x="42" y="12" width="10" height="10" rx="2.5" fill="#34d399" />
    </svg>
  );
}
