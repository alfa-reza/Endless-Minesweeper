import { Check, Copy, HelpCircle, Home, Play, RefreshCw, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { sfx } from "../game/audio";
import type { Game } from "../game/game";
import { cn } from "../utils/cn";
import { Modal } from "./Modal";
import { SettingsPanel } from "./SettingsModal";

interface Props {
  game: Game;
  onResume: () => void;
  onHelp: () => void;
  onNewRound: () => void;
  onRetrySeed: () => void;
  onMenu: () => void;
}

export function PauseModal({
  game,
  onResume,
  onHelp,
  onNewRound,
  onRetrySeed,
  onMenu,
}: Props) {
  const [tab, setTab] = useState<"game" | "settings">("game");
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
      <div className="flex items-center justify-between border-b-2 border-[#16191f] bg-[#20242b] px-4 py-3">
        <div>
          <h1 id="pause-title" className="text-lg font-bold tracking-tight">
            Paused
          </h1>
          <p className="text-[12.5px] text-muted">Timer is stopped</p>
        </div>

        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Pause sections" className="lcd-well flex rounded-[5px] p-0.5">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "game"}
              onClick={() => {
                sfx.click();
                setTab("game");
              }}
              className={cn(
                "focus-ring min-h-[36px] cursor-pointer rounded-[3px] px-3 text-[13px] font-bold transition-colors",
                tab === "game" ? "bg-[#363c46] text-ink" : "text-muted hover:text-ink",
              )}
            >
              Game
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "settings"}
              onClick={() => {
                sfx.click();
                setTab("settings");
              }}
              className={cn(
                "focus-ring flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-bold transition-colors",
                tab === "settings" ? "bg-[#363c46] text-ink" : "text-muted hover:text-ink",
              )}
            >
              <SlidersHorizontal size={14} aria-hidden="true" /> Settings
            </button>
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
      </div>

      <div className="thin-scroll max-h-[68dvh] overflow-y-auto p-4">
        {tab === "game" ? (
          <div className="space-y-3">
            <div className="lcd-well flex items-center justify-between gap-3 rounded-[5px] px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[11.5px] font-semibold tracking-wider text-muted uppercase">
                  World seed
                </div>
                <div className="mt-0.5 truncate font-mono text-[15px] font-bold tracking-wider text-mint">
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
              className="btn btn-primary w-full py-2.5 text-[15px]"
              onClick={() => {
                sfx.click();
                onResume();
              }}
            >
              <Play size={17} fill="currentColor" aria-hidden="true" /> Resume
            </button>

            <div className="grid grid-cols-2 gap-2">
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
        ) : (
          <SettingsPanel />
        )}
      </div>
    </Modal>
  );
}
