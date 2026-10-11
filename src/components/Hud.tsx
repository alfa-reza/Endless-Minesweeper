import { Flag, Grid3x3, Heart, Locate, Pause, Timer, Trophy, Volume2, VolumeX, HelpCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Game, Snapshot } from "../game/game";
import { cn } from "../utils/cn";
import { fmtNum, fmtTime } from "../utils/format";
import { MineIcon } from "./Logo";

function useElapsed(game: Game) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    setMs(game.elapsed());
    const id = window.setInterval(() => setMs(game.elapsed()), 250);
    return () => window.clearInterval(id);
  }, [game]);
  return ms;
}

function Stat({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)} title={label}>
      <span className="text-muted/70">{icon}</span>
      <div className="leading-none">
        <div className="hidden text-[9.5px] font-bold tracking-[0.16em] text-muted/55 uppercase sm:block">
          {label}
        </div>
        <div className="font-mono text-[14px] font-bold text-ink tabular-nums sm:mt-1">{value}</div>
      </div>
    </div>
  );
}

const Divider = ({ className }: { className?: string }) => (
  <div className={cn("h-7 w-px shrink-0 bg-[#2a3162]", className)} />
);

export function StatsBar({ game, snap }: { game: Game; snap: Snapshot }) {
  const ms = useElapsed(game);
  const beating = snap.score > 0 && snap.score >= snap.best;
  return (
    <div className="glass flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 sm:gap-4 sm:px-4">
      <MineIcon className="hidden h-7 w-7 shrink-0 sm:block" />
      <div className="flex items-center gap-0.5" aria-label={`${snap.lives} of ${snap.maxLives} lives left`}>
        {Array.from({ length: snap.maxLives }).map((_, i) => {
          const alive = i < snap.lives;
          return (
            <Heart
              key={i}
              size={17}
              fill={alive ? "#ff6b6b" : "transparent"}
              className={cn(
                alive ? "text-danger" : "text-muted/30",
                alive && snap.lives === 1 && snap.maxLives > 1 && "animate-heartbeat",
              )}
            />
          );
        })}
      </div>
      <Divider />
      <Stat icon={<Trophy size={15} />} label="Score" value={fmtNum(snap.score)} />
      <Stat
        icon={<Trophy size={15} className={beating ? "text-mint" : ""} />}
        label="Best"
        value={<span className={beating ? "text-mint" : ""}>{fmtNum(snap.best)}</span>}
        className="hidden md:flex"
      />
      <Divider />
      <Stat icon={<Timer size={15} />} label="Time" value={fmtTime(ms)} />
      <Stat icon={<Grid3x3 size={15} />} label="Cleared" value={fmtNum(snap.revealed)} className="hidden sm:flex" />
      <Stat icon={<Flag size={15} className="text-flag" />} label="Flags" value={snap.flags} className="hidden sm:flex" />
    </div>
  );
}

interface ButtonsProps {
  muted: boolean;
  onToggleMute: () => void;
  onCenter: () => void;
  onHelp: () => void;
  onPause: () => void;
  disablePause?: boolean;
}

export function HudButtons({ muted, onToggleMute, onCenter, onHelp, onPause, disablePause }: ButtonsProps) {
  return (
    <div className="flex shrink-0 gap-2">
      <button className="btn btn-icon glass" onClick={onCenter} title="Re-centre on the start (C)" aria-label="Re-centre view">
        <Locate size={17} />
      </button>
      <button
        className="btn btn-icon glass hidden sm:inline-flex"
        onClick={onToggleMute}
        title={muted ? "Unmute" : "Mute"}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
      <button className="btn btn-icon glass hidden sm:inline-flex" onClick={onHelp} title="How to play" aria-label="How to play">
        <HelpCircle size={17} />
      </button>
      <button
        className="btn btn-icon glass"
        onClick={onPause}
        disabled={disablePause}
        title="Pause (Esc)"
        aria-label="Pause"
      >
        <Pause size={17} />
      </button>
    </div>
  );
}
