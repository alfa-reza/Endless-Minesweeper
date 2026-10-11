import { Bomb, Eye, Home, RefreshCw, RotateCcw, Trophy } from "lucide-react";
import type { ReactNode } from "react";
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

function Cell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2a3270]/60 bg-white/[0.03] px-3 py-2.5">
      <div className="text-[10px] font-bold tracking-[0.16em] text-muted/55 uppercase">{label}</div>
      <div className="mt-1 font-mono text-[17px] font-bold text-ink tabular-nums">{value}</div>
    </div>
  );
}

export function GameOverModal({ game, snap, onNewRound, onRetrySeed, onSpectate, onMenu }: Props) {
  const d = game.difficulty;
  return (
    <Modal onClose={onSpectate} dismissOnBackdrop={false} labelledBy="over-title" className="max-w-md">
      <div className="relative border-b border-[#2a3270]/60 bg-[radial-gradient(500px_140px_at_50%_0%,rgba(255,107,107,0.22),transparent_70%)] px-5 pt-6 pb-5 text-center">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-danger/40 bg-danger/15 text-danger shadow-[0_0_34px_rgba(255,107,107,0.35)]"
          aria-hidden="true"
        >
          <Bomb size={28} />
        </div>
        <h2 id="over-title" className="mt-1 text-2xl font-bold tracking-tight text-danger">
          You hit a mine
        </h2>
        <p className="mt-1 text-[13px] text-muted/80">
          {snap.revealed > 0
            ? `You cleared ${fmtNum(snap.revealed)} tiles on ${d.name}.`
            : "That was a rough start."}
        </p>

        <div className="mt-4 inline-flex flex-col items-center">
          <span className="text-[10px] font-bold tracking-[0.2em] text-muted/55 uppercase">Final score</span>
          <span className="font-mono text-5xl font-bold text-ink tabular-nums">{fmtNum(snap.score)}</span>
          {snap.record ? (
            <span className="animate-ring mt-2 inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint/10 px-3 py-1 text-[12px] font-bold text-mint">
              <Trophy size={13} /> New personal best!
            </span>
          ) : (
            <span className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-flag/90">
              <Trophy size={13} /> Best: {fmtNum(snap.best)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-2.5">
          <Cell label="Time survived" value={fmtTime(game.elapsed())} />
          <Cell label="Tiles cleared" value={fmtNum(snap.revealed)} />
          <Cell label="Farthest from start" value={`${fmtNum(snap.maxDist)} tiles`} />
          <Cell label="Flags placed" value={fmtNum(snap.flags)} />
        </div>

        <button data-autofocus className="btn btn-primary w-full py-3 text-[15px]" onClick={onNewRound}>
          <RefreshCw size={16} /> Play again
        </button>
        <div className="grid grid-cols-3 gap-2.5">
          <button className="btn" onClick={onRetrySeed} title="Replay the same world">
            <RotateCcw size={15} /> Same seed
          </button>
          <button className="btn" onClick={onSpectate} title="Look around the board">
            <Eye size={15} /> Spectate
          </button>
          <button className="btn" onClick={onMenu}>
            <Home size={15} /> Menu
          </button>
        </div>
        <p className="text-center font-mono text-[11px] text-muted/45">Seed {game.seedLabel}</p>
      </div>
    </Modal>
  );
}
