import { Bomb, Eye, Home, RefreshCw, RotateCcw, Trophy, X } from "lucide-react";
import type { ReactNode } from "react";
import { sfx } from "../game/audio";
import type { Game, Snapshot } from "../game/game";
import { fmtNum, fmtTime } from "../utils/format";
import { Modal } from "./Modal";

interface Props {
  game: Game;
  snap: Snapshot;
  onNewRound: () => void;
  onRetrySeed: () => void;
  onSpectate: () => void;
  onMenu: () => void;
}

function StatCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="lcd-well rounded-[5px] px-3 py-2">
      <div className="text-[12px] font-semibold text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-[17px] font-bold text-mint tabular-nums">{value}</div>
    </div>
  );
}

export function GameOverModal({ game, snap, onNewRound, onRetrySeed, onSpectate, onMenu }: Props) {
  const d = game.difficulty;
  return (
    <Modal onClose={onSpectate} dismissOnBackdrop={false} labelledBy="over-title" className="max-w-md">
      <div className="relative border-b-2 border-[#16191f] bg-[#20242b] px-5 pt-5 pb-5 text-center">
        <button
          type="button"
          className="btn btn-icon absolute top-3 right-3"
          onClick={() => {
            sfx.click();
            onSpectate();
          }}
          aria-label="Spectate board"
        >
          <X size={18} />
        </button>

        <div
          className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-danger/45 bg-danger/15 text-danger"
          aria-hidden="true"
        >
          <Bomb size={24} />
        </div>
        <h1 id="over-title" className="mt-2 text-2xl font-bold tracking-tight text-danger">
          You hit a mine
        </h1>
        <p className="mt-1 text-[13.5px] text-muted">
          {snap.revealed > 0
            ? `You cleared ${fmtNum(snap.revealed)} tiles on ${d.name}.`
            : "That was a rough start."}
        </p>

        <div className="mt-4 inline-flex flex-col items-center">
          <span className="text-[12px] font-semibold tracking-wider text-muted uppercase">Final score</span>
          <span className="font-mono text-4xl font-bold text-ink tabular-nums sm:text-5xl">
            {fmtNum(snap.score)}
          </span>
          {snap.record ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-mint/45 bg-mint/15 px-3 py-1 text-[12.5px] font-bold text-mint">
              <Trophy size={14} aria-hidden="true" /> New personal best!
            </span>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-flag">
              <Trophy size={14} aria-hidden="true" /> Best: {fmtNum(snap.best)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3.5 p-5">
        <div className="grid grid-cols-2 gap-2.5">
          <StatCell label="Time survived" value={fmtTime(game.elapsed())} />
          <StatCell label="Tiles cleared" value={fmtNum(snap.revealed)} />
          <StatCell label="Farthest reach" value={`${fmtNum(snap.maxDist)} tiles`} />
          <StatCell label="Flags placed" value={fmtNum(snap.flags)} />
        </div>

        <button
          data-autofocus
          type="button"
          className="btn btn-primary w-full py-3 text-[15px]"
          onClick={() => {
            sfx.click();
            onNewRound();
          }}
        >
          <RefreshCw size={16} aria-hidden="true" /> Play again
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            className="btn px-2"
            onClick={() => {
              sfx.click();
              onRetrySeed();
            }}
            title="Replay the same world"
          >
            <RotateCcw size={15} aria-hidden="true" /> Retry
          </button>
          <button
            type="button"
            className="btn px-2"
            onClick={() => {
              sfx.click();
              onSpectate();
            }}
            title="Look around the board"
          >
            <Eye size={15} aria-hidden="true" /> Board
          </button>
          <button
            type="button"
            className="btn px-2"
            onClick={() => {
              sfx.click();
              onMenu();
            }}
          >
            <Home size={15} aria-hidden="true" /> Menu
          </button>
        </div>

        <p className="text-center font-mono text-[12px] text-muted">Seed: {game.seedLabel}</p>
      </div>
    </Modal>
  );
}
