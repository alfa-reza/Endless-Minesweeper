import { cn } from "../utils/cn";

/** Little spiky mine mark used in the menu and HUD. */
export function MineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-10 w-10", className)} aria-hidden="true">
      <defs>
        <radialGradient id="mineBody" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ff9a9a" />
          <stop offset="55%" stopColor="#ff6b6b" />
          <stop offset="100%" stopColor="#c43c5a" />
        </radialGradient>
      </defs>
      <g stroke="#ff6b6b" strokeWidth="5" strokeLinecap="round">
        <path d="M32 7v10M32 47v10M7 32h10M47 32h10M14.5 14.5l7 7M42.5 42.5l7 7M49.5 14.5l-7 7M21.5 42.5l-7 7" />
      </g>
      <circle cx="32" cy="32" r="15" fill="url(#mineBody)" />
      <circle cx="26" cy="26" r="4.2" fill="rgba(255,255,255,0.7)" />
    </svg>
  );
}
