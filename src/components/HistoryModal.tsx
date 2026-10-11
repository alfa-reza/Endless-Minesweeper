import { History, Trash2, Trophy, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { sfx } from "../game/audio";
import { DIFFICULTIES, getDifficulty } from "../game/config";
import { clearRuns, listRuns, type RunRecord } from "../game/db";
import { loadSave, subscribeSave } from "../game/storage";
import { fmtNum, fmtTime } from "../utils/format";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function HistoryModal({ onClose }: Props) {
  const save = useSyncExternalStore(subscribeSave, loadSave);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void listRuns(50).then((items) => {
      if (!alive) return;
      setRuns(items);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleClear = async () => {
    sfx.click();
    await clearRuns();
    setRuns([]);
  };

  return (
    <Modal onClose={onClose} labelledBy="history-title" className="max-w-lg">
      <div className="flex items-center justify-between border-b-2 border-[#16191f] bg-[#20242b] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <History size={19} className="text-mint" aria-hidden="true" />
          <h1 id="history-title" className="text-lg font-bold tracking-tight">
            High Scores &amp; History
          </h1>
        </div>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => {
            sfx.click();
            onClose();
          }}
          aria-label="Close history"
        >
          <X size={18} />
        </button>
      </div>

      <div className="thin-scroll max-h-[68dvh] space-y-4 overflow-y-auto p-4">
        {/* Best per difficulty */}
        <div>
          <h2 className="mb-2 text-[11.5px] font-bold tracking-wider text-muted uppercase">
            Personal Bests
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DIFFICULTIES.map((d) => {
              const best = save.best[d.id] ?? 0;
              const cleared = save.bestCleared[d.id] ?? 0;
              return (
                <div key={d.id} className="lcd-well rounded-[5px] px-2.5 py-2">
                  <div className="text-[11.5px] font-bold" style={{ color: d.accent }}>
                    {d.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 font-mono text-[14px] font-bold text-flag tabular-nums">
                    <Trophy size={12} aria-hidden="true" />
                    {best > 0 ? fmtNum(best) : "—"}
                  </div>
                  <div className="font-mono text-[11px] text-muted tabular-nums">
                    {cleared > 0 ? `${fmtNum(cleared)} tiles` : "0 tiles"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent runs */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11.5px] font-bold tracking-wider text-muted uppercase">
              Recent Runs ({runs.length})
            </h2>
            {runs.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="focus-ring inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded px-2 text-[12px] font-semibold text-danger hover:bg-white/5"
              >
                <Trash2 size={13} aria-hidden="true" /> Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="lcd-well rounded-[5px] p-4 text-center text-[13px] text-muted">
              Loading local database…
            </div>
          ) : runs.length === 0 ? (
            <div className="lcd-well rounded-[5px] p-4 text-center text-[13px] text-muted">
              No completed runs recorded yet. Play a game to save history locally!
            </div>
          ) : (
            <div className="space-y-1.5">
              {runs.map((r, idx) => {
                const diff = getDifficulty(r.difficulty);
                return (
                  <div
                    key={r.id ?? idx}
                    className="lcd-well flex items-center justify-between gap-2 rounded-[5px] px-3 py-2 text-[12.5px]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: diff.accent }}>
                          {diff.name}
                        </span>
                        <span className="font-mono font-bold text-mint tabular-nums">
                          {fmtNum(r.score)} pts
                        </span>
                        {r.record && (
                          <span className="rounded bg-mint/20 px-1 py-0.5 text-[10px] font-bold text-mint">
                            PB
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                        {fmtNum(r.cleared)} tiles · {fmtTime(r.durationMs)} · {r.seed}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px] text-muted">
                      {fmtDate(r.playedAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t-2 border-[#16191f] bg-[#20242b] px-4 py-3">
        <button
          data-autofocus
          type="button"
          className="btn btn-primary"
          onClick={() => {
            sfx.click();
            onClose();
          }}
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
