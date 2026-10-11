import { Check, Copy, HelpCircle, Home, Play, RefreshCw, RotateCcw, SlidersHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useState } from "react";
import { sfx } from "../game/audio";
import type { Game } from "../game/game";
import { Modal } from "./Modal";

interface Props {
  game: Game;
  muted: boolean;
  onToggleMute: () => void;
  onResume: () => void;
  onSettings: () => void;
  onHelp: () => void;
  onNewRound: () => void;
  onRetrySeed: () => void;
  onMenu: () => void;
}

export function PauseModal({
  game,
  muted,
  onToggleMute,
  onResume,
  onSettings,
  onHelp,
  onNewRound,
  onRetrySeed,
  onMenu,
}: Props) {
  const [copied, setCopied] = useState(false);
  const d = game.difficulty;

  const copy = async () => {
    sfx.click();
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
      <div className="flex items-center justify-between border-b border-[#26334d] bg-[#151e30] px-5 py-4">
        <div>
          <h1 id="pause-title" className="text-xl font-bold tracking-tight">
            Paused
          </h1>
          <p className="text-[13px] text-muted">Timer is stopped</p>
        </div>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => {
            sfx.click();
            onResume();
          }}
          aria-label="Resume game"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3.5 p-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#26334d] bg-[#0f172a]/80 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold tracking-wider text-muted uppercase">World seed</div>
            <div className="mt-0.5 truncate font-mono text-[15px] font-bold tracking-wider text-ink">
              {game.seedLabel}
            </div>
            <div className="mt-0.5 text-[12px] font-medium" style={{ color: d.accent }}>
              {d.name} · {Math.round(d.density * 100)}% mines
            </div>
          </div>
          <button type="button" className="btn shrink-0" onClick={copy} aria-label="Copy seed">
            {copied ? <Check size={16} className="text-mint" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          data-autofocus
          type="button"
          className="btn btn-primary w-full py-3 text-[15px]"
          onClick={() => {
            sfx.click();
            onResume();
          }}
        >
          <Play size={17} fill="currentColor" aria-hidden="true" /> Resume
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className="btn"
            onClick={() => {
              sfx.click();
              onNewRound();
            }}
          >
            <RefreshCw size={15} aria-hidden="true" /> New world
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              sfx.click();
              onRetrySeed();
            }}
          >
            <RotateCcw size={15} aria-hidden="true" /> Same seed
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              sfx.click();
              onSettings();
            }}
          >
            <SlidersHorizontal size={15} aria-hidden="true" /> Settings
          </button>
          <button type="button" className="btn" onClick={onToggleMute}>
            {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
            Sound {muted ? "off" : "on"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            className="btn"
            onClick={() => {
              sfx.click();
              onHelp();
            }}
          >
            <HelpCircle size={15} aria-hidden="true" /> How to play
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              sfx.click();
              onMenu();
            }}
          >
            <Home size={15} aria-hidden="true" /> Main menu
          </button>
        </div>
      </div>
    </Modal>
  );
}
