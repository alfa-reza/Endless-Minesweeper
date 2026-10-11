import {
  ChevronDown,
  Dices,
  Heart,
  HelpCircle,
  History,
  Play,
  SlidersHorizontal,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { sfx } from "../game/audio";
import { DIFFICULTIES, getDifficulty, type DifficultyId } from "../game/config";
import { randomSeedLabel } from "../game/seed";
import { loadSave, patchSave, subscribeSave } from "../game/storage";
import { HelpModal } from "./HelpModal";
import { HistoryModal } from "./HistoryModal";
import { MineIcon } from "./Logo";
import { MenuBackdrop } from "./MenuBackdrop";
import { SettingsModal } from "./SettingsModal";

interface Props {
  onPlay: (difficulty: DifficultyId, seedLabel: string) => void;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function StartMenu({ onPlay }: Props) {
  const save = useSyncExternalStore(subscribeSave, loadSave);
  const [difficulty, setDifficulty] = useState<DifficultyId>(save.difficulty);
  const [seedText, setSeedText] = useState("");
  const [modal, setModal] = useState<"none" | "help" | "settings" | "history">("none");
  const playRef = useRef<HTMLButtonElement>(null);

  const selected = getDifficulty(difficulty);
  const bestScore = save.best[difficulty] ?? 0;
  const bestCleared = save.bestCleared[difficulty] ?? 0;

  const start = () => {
    sfx.unlock();
    sfx.click();
    patchSave({ difficulty });
    onPlay(difficulty, seedText.trim() || randomSeedLabel());
  };

  const pick = (id: DifficultyId) => {
    sfx.unlock();
    sfx.click();
    setDifficulty(id);
    patchSave({ difficulty: id });
  };

  const toggleMute = () => {
    sfx.unlock();
    const next = !save.muted;
    sfx.muted = next;
    patchSave({ muted: next });
    if (!next) sfx.click();
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-night">
      <MenuBackdrop reduceMotion={save.reduceMotion} highContrast={save.highContrast} />
      <div className="pointer-events-none absolute inset-0 bg-[#111317]/45" />

      {/* Top utility bar (Mute & Settings only — no duplicate Help icon) */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-10 flex gap-2">
        <button
          type="button"
          className="btn btn-icon surface"
          onClick={toggleMute}
          aria-label={save.muted ? "Unmute sound" : "Mute sound"}
          title={save.muted ? "Unmute" : "Mute"}
        >
          {save.muted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="btn btn-icon surface"
          onClick={() => {
            sfx.unlock();
            sfx.click();
            setModal("settings");
          }}
          aria-label="Settings"
          title="Settings"
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="thin-scroll absolute inset-0 overflow-y-auto">
        <main className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center gap-4 pt-[max(4rem,calc(env(safe-area-inset-top)+3.25rem))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.25rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
          {/* Title */}
          <header className="animate-rise flex flex-col items-center text-center">
            <div className="mb-1.5 flex items-center gap-2">
              <MineIcon className="h-8 w-8" />
              <span className="text-[12px] font-bold tracking-[0.34em] text-mint uppercase">
                Endless
              </span>
            </div>
            <h1 className="text-4xl leading-none font-bold tracking-tight text-ink sm:text-5xl">
              Minesweeper
            </h1>
            <p className="mt-2 max-w-xs text-[13.5px] leading-snug text-muted sm:max-w-sm">
              Infinite procedural board. Clear safe pockets and push your score.
            </p>
          </header>

          {/* Compact setup card */}
          <section
            className="animate-rise surface w-full rounded-md p-4 sm:p-5"
            aria-label="Game setup"
          >
            {/* Difficulty dropdown */}
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="difficulty-select"
                className="text-[12px] font-bold tracking-wider text-muted uppercase"
              >
                Difficulty
              </label>
              <span className="text-[12.5px] font-medium text-ink">{selected.tagline}</span>
            </div>

            <div className="relative mt-1.5">
              <select
                id="difficulty-select"
                value={difficulty}
                onChange={(e) => pick(e.target.value as DifficultyId)}
                className="focus-ring lcd-well min-h-[44px] w-full cursor-pointer appearance-none rounded-[5px] pr-10 pl-3.5 text-[15px] font-semibold text-ink"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {Math.round(d.density * 100)}% mines · {d.lives}{" "}
                    {d.lives === 1 ? "life" : "lives"} · ×{d.multiplier}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
              />
            </div>

            {/* Compact LCD stats row for chosen difficulty */}
            <div className="lcd-well mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-[5px] px-3 py-2 text-[12.5px]">
              <span className="flex items-center gap-1.5 text-ink">
                <span className="flex items-center gap-0.5 text-danger" aria-label={`${selected.lives} lives`}>
                  {Array.from({ length: selected.lives }).map((_, i) => (
                    <Heart key={i} size={13} fill="currentColor" aria-hidden="true" />
                  ))}
                </span>
                <span className="font-mono text-muted">×{selected.multiplier} pts</span>
              </span>
              <span className="flex items-center gap-1 font-mono font-bold text-flag">
                <Trophy size={13} aria-hidden="true" />
                {bestScore > 0 ? `${fmt(bestScore)} (${fmt(bestCleared)})` : "0000"}
              </span>
            </div>

            {/* World seed */}
            <label
              htmlFor="world-seed-input"
              className="mt-4 mb-1.5 block text-[12px] font-bold tracking-wider text-muted uppercase"
            >
              World seed
            </label>
            <div className="flex gap-2">
              <input
                id="world-seed-input"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value.slice(0, 32))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start();
                }}
                placeholder="Random or custom seed"
                spellCheck={false}
                autoComplete="off"
                className="focus-ring lcd-well min-h-[44px] min-w-0 flex-1 rounded-[5px] px-3 py-2 font-mono text-[16px] tracking-wide text-mint uppercase placeholder:text-[14px] placeholder:tracking-normal placeholder:text-muted placeholder:normal-case"
              />
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => {
                  sfx.unlock();
                  sfx.click();
                  setSeedText(randomSeedLabel());
                }}
                title="Roll a random seed"
                aria-label="Roll a random seed"
              >
                <Dices size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                ref={playRef}
                type="button"
                autoFocus
                onClick={start}
                className="btn btn-primary flex-1 py-2.5 text-[15px]"
              >
                <Play size={17} fill="currentColor" aria-hidden="true" /> Play
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.unlock();
                  sfx.click();
                  setModal("help");
                }}
                className="btn py-2.5 sm:w-36"
              >
                <HelpCircle size={17} aria-hidden="true" /> Guide
              </button>
            </div>
          </section>

          <footer className="animate-rise flex items-center justify-center gap-3 text-center text-[12.5px] text-muted">
            <span>
              Runs played: <b className="font-mono text-ink">{fmt(save.games)}</b>
            </span>
            <button
              type="button"
              onClick={() => {
                sfx.unlock();
                sfx.click();
                setModal("history");
              }}
              className="btn min-h-[36px] px-2.5 py-1 text-[12px]"
            >
              <History size={14} aria-hidden="true" /> History
            </button>
          </footer>
        </main>
      </div>

      {modal === "help" && <HelpModal onClose={() => setModal("none")} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal("none")} />}
      {modal === "history" && <HistoryModal onClose={() => setModal("none")} />}
    </div>
  );
}
