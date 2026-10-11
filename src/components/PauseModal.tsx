import { Check, Copy, Home, HelpCircle, Play, RefreshCw, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import type { Game } from "../game/game";
import { Modal } from "./Modal";

interface Props {
  game: Game;
  muted: boolean;
  onToggleMute: () => void;
  onResume: () => void;
  onHelp: () => void;
  onNewRound: () => void;
  onRetrySeed: () => void;
  onMenu: () => void;
}

export function PauseModal({ game, muted, onToggleMute, onResume, onHelp, onNewRound, onRetrySeed, onMenu }: Props) {
  const [copied, setCopied] = useState(false);
  const d = game.difficulty;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(game.seedLabel);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Modal onClose={onResume} labelledBy="pause-title" className="max-w-md">
      <div className="border-b border-[#2a3270]/60 bg-[radial-gradient(500px_100px_at_50%_0%,rgba(124,160,255,0.16),transparent_70%)] px-5 pt-5 pb-4 text-center">
        <h2 id="pause-title" className="text-2xl font-bold tracking-tight">
          Paused
        </h2>
        <p className="mt-1 text-[13px] text-muted/80">Take a breath — the timer is stopped.</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#2a3270]/70 bg-black/25 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.18em] text-muted/55 uppercase">World seed</div>
            <div className="mt-0.5 truncate font-mono text-[15px] font-bold tracking-wider text-ink">{game.seedLabel}</div>
            <div className="mt-0.5 text-[11.5px]" style={{ color: d.accent }}>
              {d.name} · {Math.round(d.density * 100)}% mines
            </div>
          </div>
          <button className="btn shrink-0" onClick={copy} aria-label="Copy seed">
            {copied ? <Check size={16} className="text-mint" /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button data-autofocus className="btn btn-primary w-full py-3 text-[15px]" onClick={onResume}>
          <Play size={17} fill="currentColor" /> Resume
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button className="btn" onClick={onNewRound}>
            <RefreshCw size={15} /> New world
          </button>
          <button className="btn" onClick={onRetrySeed}>
            <RotateCcw size={15} /> Same seed
          </button>
          <button className="btn" onClick={onHelp}>
            <HelpCircle size={15} /> How to play
          </button>
          <button className="btn" onClick={onToggleMute}>
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />} Sound {muted ? "off" : "on"}
          </button>
        </div>

        <button className="btn btn-danger w-full" onClick={onMenu}>
          <Home size={15} /> Quit to main menu
        </button>
      </div>
    </Modal>
  );
}
