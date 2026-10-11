import {
  CalendarDays,
  Dices,
  Heart,
  HelpCircle,
  Play,
  SlidersHorizontal,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { sfx } from "../game/audio";
import { DIFFICULTIES, getDifficulty, type DifficultyId } from "../game/config";
import { dailySeedLabel, randomSeedLabel } from "../game/seed";
import { loadSave, patchSave, subscribeSave } from "../game/storage";
import { cn } from "../utils/cn";
import { HelpModal } from "./HelpModal";
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
  const [modal, setModal] = useState<"none" | "help" | "settings">("none");
  const playRef = useRef<HTMLButtonElement>(null);

  const selected = getDifficulty(difficulty);

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
    playRef.current?.focus({ preventScroll: true });
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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(9,13,22,0.58)_0%,rgba(9,13,22,0.92)_78%)]" />

      {/* Top utility bar with safe-area insets */}
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
        <button
          type="button"
          className="btn btn-icon surface"
          onClick={() => {
            sfx.unlock();
            sfx.click();
            setModal("help");
          }}
          aria-label="How to play"
          title="How to play"
        >
          <HelpCircle size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="thin-scroll absolute inset-0 overflow-y-auto">
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-5 pt-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]">
          {/* Title */}
          <header className="animate-rise flex flex-col items-center text-center">
            <div className="mb-2 flex items-center gap-2.5">
              <MineIcon className="h-9 w-9 sm:h-11 sm:w-11" />
              <span className="text-[12px] font-bold tracking-[0.38em] text-accent uppercase sm:text-[13px]">
                Endless
              </span>
            </div>
            <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-ink sm:text-6xl">
              Minesweeper
            </h1>
            <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-muted sm:text-[15px]">
              An infinite board with no edges. Clear safe pockets, mark mines, and push as far as your nerve holds.
            </p>
          </header>

          {/* Setup card */}
          <section
            className="animate-rise surface w-full rounded-2xl p-4 sm:p-5"
            aria-label="Game setup"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-bold tracking-[0.16em] text-muted uppercase">Difficulty</h2>
              <span className="text-[13px] font-medium text-ink/90">{selected.tagline}</span>
            </div>

            <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => {
                const active = d.id === difficulty;
                const best = save.best[d.id] ?? 0;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => pick(d.id)}
                    className={cn(
                      "chip group relative flex min-h-[44px] cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors duration-150",
                      active
                        ? "bg-[#1a2640]"
                        : "border-[#26334d] bg-[#0f172a]/70 hover:border-[#3d527a] hover:bg-[#141f35]",
                    )}
                    style={
                      active
                        ? { borderColor: d.accent, boxShadow: `inset 0 0 0 1px ${d.accent}55` }
                        : undefined
                    }
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-[15px] font-bold" style={{ color: active ? d.accent : undefined }}>
                        {d.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: d.accent, opacity: active ? 1 : 0.45 }}
                      />
                    </span>
                    <span className="font-mono text-[12px] text-muted">{Math.round(d.density * 100)}% mines</span>
                    <span className="flex items-center gap-0.5 text-danger" aria-label={`${d.lives} lives, ${d.multiplier}x score`}>
                      {Array.from({ length: d.lives }).map((_, i) => (
                        <Heart key={i} size={13} fill="currentColor" aria-hidden="true" />
                      ))}
                      <span className="ml-1.5 font-mono text-[12px] text-muted">×{d.multiplier}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[12px] font-semibold text-flag">
                      <Trophy size={12} aria-hidden="true" /> {best > 0 ? fmt(best) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            <label
              htmlFor="world-seed-input"
              className="mt-4 mb-2 block text-[12px] font-bold tracking-[0.16em] text-muted uppercase"
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
                placeholder="Random — or enter seed"
                spellCheck={false}
                autoComplete="off"
                className="focus-ring min-h-[44px] min-w-0 flex-1 rounded-xl border border-[#2c3b59] bg-[#090d16] px-3.5 py-2 font-mono text-[16px] tracking-wide text-ink uppercase placeholder:text-[14px] placeholder:tracking-normal placeholder:text-muted placeholder:normal-case"
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
              <button
                type="button"
                className="btn btn-icon"
                onClick={() => {
                  sfx.unlock();
                  sfx.click();
                  setSeedText(dailySeedLabel());
                }}
                title="Today's daily seed"
                aria-label="Use today's daily seed"
              >
                <CalendarDays size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Same seed and difficulty always generate the exact same world.
            </p>

            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                ref={playRef}
                type="button"
                autoFocus
                onClick={start}
                className="btn btn-primary flex-1 py-3 text-[16px] tracking-wide"
              >
                <Play size={18} fill="currentColor" aria-hidden="true" /> Play
              </button>
              <button
                type="button"
                onClick={() => {
                  sfx.unlock();
                  sfx.click();
                  setModal("help");
                }}
                className="btn py-3 sm:w-44"
              >
                <HelpCircle size={17} aria-hidden="true" /> How to play
              </button>
            </div>
          </section>

          <footer className="animate-rise flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px] text-muted">
            <span>
              Runs played: <b className="font-mono text-ink">{fmt(save.games)}</b>
            </span>
            <span className="hidden sm:inline" aria-hidden="true">
              ·
            </span>
            <span>
              Best cleared ({selected.name}):{" "}
              <b className="font-mono text-ink">{fmt(save.bestCleared[difficulty] ?? 0)}</b> tiles
            </span>
          </footer>
        </main>
      </div>

      {modal === "help" && <HelpModal onClose={() => setModal("none")} />}
      {modal === "settings" && <SettingsModal onClose={() => setModal("none")} />}
    </div>
  );
}
