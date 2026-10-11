import {
  Flag,
  Grid3x3,
  Heart,
  Locate,
  Pause,
  Timer,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Game, Snapshot } from "../game/game";
import { cn } from "../utils/cn";
import { fmtNum, fmtTime } from "../utils/format";
import { MineIcon } from "./Logo";

function useElapsed(game: Game, running: boolean, status: Snapshot["status"]) {
  const [ms, setMs] = useState(() => game.elapsed());
  useEffect(() => {
    setMs(game.elapsed());
    if (!running) return;
    const id = window.setInterval(() => setMs(game.elapsed()), 250);
    return () => window.clearInterval(id);
  }, [game, running, status]);
  return ms;
}

function Stat({
  icon,
  label,
  value,
  badge,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5 sm:gap-2", className)} title={label}>
      <span className="text-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="leading-none">
        <div className="hidden items-center gap-1 text-[11px] font-semibold tracking-wider text-muted uppercase sm:flex">
          <span>{label}</span>
          {badge && (
            <span className="rounded bg-mint/20 px-1 py-0.5 text-[10px] font-bold text-mint">
              {badge}
            </span>
          )}
        </div>
        <div className="font-mono text-[13px] font-bold text-ink tabular-nums sm:mt-0.5 sm:text-[14px]">
          {value}
        </div>
      </div>
    </div>
  );
}

const Divider = ({ className }: { className?: string }) => (
  <div className={cn("h-5 w-px shrink-0 bg-[#2e333d] sm:h-6", className)} aria-hidden="true" />
);

export function StatsBar({ game, snap }: { game: Game; snap: Snapshot }) {
  const ms = useElapsed(game, snap.running, snap.status);
  const beating = snap.score > 0 && snap.score >= snap.best;
  return (
    <div className="surface flex items-center gap-2 rounded-xl px-2.5 py-2 sm:gap-3.5 sm:px-3.5">
      <MineIcon className="hidden h-6 w-6 shrink-0 sm:block" />
      <div
        className="flex shrink-0 items-center gap-0.5"
        aria-label={`${snap.lives} of ${snap.maxLives} lives left`}
      >
        {snap.maxLives > 3 && (
          <span
            className={cn(
              "flex items-center gap-1 font-mono text-[13px] font-bold sm:hidden",
              snap.lives === 1 ? "text-danger" : "text-ink",
            )}
          >
            <Heart
              size={15}
              fill="#f43f5e"
              aria-hidden="true"
              className={cn("text-danger", snap.lives === 1 && "animate-heartbeat")}
            />
            {snap.lives}
          </span>
        )}
        <div className={cn("items-center gap-0.5", snap.maxLives > 3 ? "hidden sm:flex" : "flex")}>
          {Array.from({ length: snap.maxLives }).map((_, i) => {
            const alive = i < snap.lives;
            return (
              <Heart
                key={i}
                size={15}
                fill={alive ? "#f43f5e" : "transparent"}
                aria-hidden="true"
                className={cn(
                  alive ? "text-danger" : "text-muted/35",
                  alive && snap.lives === 1 && snap.maxLives > 1 && "animate-heartbeat",
                )}
              />
            );
          })}
        </div>
      </div>
      <Divider />
      <Stat
        icon={<Trophy size={14} className={beating ? "text-mint" : undefined} />}
        label="Score"
        value={<span className={beating ? "text-mint" : undefined}>{fmtNum(snap.score)}</span>}
        badge={beating ? "PB" : undefined}
      />
      <Stat
        icon={<Trophy size={14} className={beating ? "text-mint" : undefined} />}
        label="Best"
        value={<span className={beating ? "text-mint" : undefined}>{fmtNum(snap.best)}</span>}
        className="hidden md:flex"
      />
      <Divider />
      <Stat icon={<Timer size={14} />} label="Time" value={fmtTime(ms)} />
      <Stat
        icon={<Grid3x3 size={14} />}
        label="Cleared"
        value={fmtNum(snap.revealed)}
        className="hidden sm:flex"
      />
      <Stat
        icon={<Flag size={14} className="text-flag" />}
        label="Flags"
        value={snap.flags}
        className="hidden sm:flex"
      />
    </div>
  );
}

interface ButtonsProps {
  muted: boolean;
  onToggleMute: () => void;
  onCenter: () => void;
  onPause: () => void;
  disablePause?: boolean;
}

export function HudButtons({
  muted,
  onToggleMute,
  onCenter,
  onPause,
  disablePause,
}: ButtonsProps) {
  return (
    <div className="flex shrink-0 gap-1.5 sm:gap-2">
      <button
        type="button"
        className="btn btn-icon surface"
        onClick={onCenter}
        title="Re-centre on the start (C)"
        aria-label="Re-centre view"
      >
        <Locate size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-icon surface"
        onClick={onToggleMute}
        title={muted ? "Unmute" : "Mute"}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
      >
        {muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="btn btn-icon surface"
        onClick={onPause}
        disabled={disablePause}
        title="Pause & Settings (Esc)"
        aria-label="Pause"
      >
        <Pause size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
