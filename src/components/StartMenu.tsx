import { CalendarDays, Dices, Heart, HelpCircle, Play, Trophy, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { sfx } from "../game/audio";
import { DIFFICULTIES, getDifficulty, type DifficultyId } from "../game/config";
import { dailySeedLabel, randomSeedLabel } from "../game/seed";
import { loadSave, patchSave } from "../game/storage";
import { cn } from "../utils/cn";
import { HelpModal } from "./HelpModal";
import { MineIcon } from "./Logo";
import { MenuBackdrop } from "./MenuBackdrop";

interface Props {
  onPlay: (difficulty: DifficultyId, seedLabel: string) => void;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function StartMenu({ onPlay }: Props) {
  const [save, setSave] = useState(loadSave);
  const [difficulty, setDifficulty] = useState<DifficultyId>(save.difficulty);
  const [seedText, setSeedText] = useState("");
  const [help, setHelp] = useState(false);
  const [muted, setMuted] = useState(save.muted);
  const playRef = useRef<HTMLButtonElement>(null);

  const selected = getDifficulty(difficulty);

  const start = () => {
    sfx.unlock();
    sfx.click();
    patchSave({ difficulty });
    onPlay(difficulty, seedText.trim() || randomSeedLabel());
  };

  const pick = (id: DifficultyId) => {
    sfx.click();
    setDifficulty(id);
    setSave(patchSave({ difficulty: id }));
    playRef.current?.focus({ preventScroll: true });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sfx.muted = next;
    setSave(patchSave({ muted: next }));
    if (!next) sfx.click();
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-night">
      <MenuBackdrop />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,10,28,0.5)_0%,rgba(8,10,28,0.9)_78%)]" />
      <div className="fog-fx">
        <i />
      </div>

      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <button
          className="btn btn-icon glass"
          onClick={toggleMute}
          aria-label={muted ? "Unmute sound" : "Mute sound"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>
        <button className="btn btn-icon glass" onClick={() => setHelp(true)} aria-label="How to play" title="How to play">
          <HelpCircle size={17} />
        </button>
      </div>

      <div className="thin-scroll absolute inset-0 overflow-y-auto">
        <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-10">
          {/* Title */}
          <header className="animate-rise flex flex-col items-center text-center">
            <MineIcon className="animate-floaty mb-2 h-14 w-14 drop-shadow-[0_0_24px_rgba(255,107,107,0.55)]" />
            <span className="text-[12px] font-bold tracking-[0.55em] text-accent/90 uppercase sm:text-sm">
              Endless
            </span>
            <h1 className="title-gradient text-5xl leading-[1.05] font-bold tracking-tight sm:text-7xl">
              Minesweeper
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted/80 sm:text-[15px]">
              An infinite board with no edges. Open tiles, read the numbers and see how far you can
              explore before the next mine.
            </p>
          </header>

          {/* Setup card */}
          <section
            className="animate-rise glass w-full rounded-3xl p-4 sm:p-5"
            style={{ animationDelay: "90ms" }}
            aria-label="Game setup"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-bold tracking-[0.2em] text-muted/70 uppercase">Difficulty</h2>
              <span className="text-[12px] text-muted/70">{selected.tagline}</span>
            </div>

            <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {DIFFICULTIES.map((d) => {
                const active = d.id === difficulty;
                const best = save.best[d.id] ?? 0;
                return (
                  <button
                    key={d.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => pick(d.id)}
                    className={cn(
                      "chip group relative flex cursor-pointer flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all duration-200",
                      active
                        ? "-translate-y-0.5 bg-white/[0.07]"
                        : "border-[#2a3270]/70 bg-white/[0.025] hover:border-[#4655c4] hover:bg-white/[0.05]",
                    )}
                    style={
                      active
                        ? { borderColor: d.accent, boxShadow: `0 8px 30px ${d.accent}33, inset 0 0 0 1px ${d.accent}55` }
                        : undefined
                    }
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-[15px] font-bold" style={{ color: active ? d.accent : undefined }}>
                        {d.name}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: d.accent, opacity: active ? 1 : 0.4 }}
                      />
                    </span>
                    <span className="font-mono text-[11px] text-muted/80">{Math.round(d.density * 100)}% mines</span>
                    <span className="flex items-center gap-0.5 text-danger/90" aria-label={`${d.lives} lives`}>
                      {Array.from({ length: d.lives }).map((_, i) => (
                        <Heart key={i} size={12} fill="currentColor" />
                      ))}
                      <span className="ml-1.5 font-mono text-[11px] text-muted/70">×{d.multiplier}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-flag/90">
                      <Trophy size={11} /> {best > 0 ? fmt(best) : "—"}
                    </span>
                  </button>
                );
              })}
            </div>

            <h2 className="mt-4 mb-2 text-[11px] font-bold tracking-[0.2em] text-muted/70 uppercase">World seed</h2>
            <div className="flex gap-2">
              <input
                value={seedText}
                onChange={(e) => setSeedText(e.target.value.slice(0, 32))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start();
                }}
                placeholder="Random every time — or type your own"
                spellCheck={false}
                autoComplete="off"
                aria-label="World seed"
                className="min-w-0 flex-1 rounded-xl border border-[#2a3270] bg-black/30 px-3.5 py-2.5 font-mono text-[13px] tracking-wide text-ink uppercase placeholder:text-[12px] placeholder:tracking-normal placeholder:text-muted/40 placeholder:normal-case focus:border-accent focus:outline-none"
              />
              <button
                className="btn btn-icon"
                onClick={() => setSeedText(randomSeedLabel())}
                title="Roll a random seed"
                aria-label="Roll a random seed"
              >
                <Dices size={17} />
              </button>
              <button
                className="btn btn-icon"
                onClick={() => setSeedText(dailySeedLabel())}
                title="Today's daily seed"
                aria-label="Use today's daily seed"
              >
                <CalendarDays size={17} />
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted/55">
              The same seed and difficulty always create the same world — share it with a friend.
            </p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <button
                ref={playRef}
                autoFocus
                onClick={start}
                className="btn btn-primary animate-ring flex-1 py-3.5 text-[16px] tracking-wide"
              >
                <Play size={18} fill="currentColor" /> Play
              </button>
              <button onClick={() => setHelp(true)} className="btn py-3.5 sm:w-44">
                <HelpCircle size={17} /> How to play
              </button>
            </div>
          </section>

          <footer
            className="animate-rise flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-muted/55"
            style={{ animationDelay: "180ms" }}
          >
            <span>
              Runs played: <b className="font-mono text-muted/80">{fmt(save.games)}</b>
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              Best cleared ({selected.name}):{" "}
              <b className="font-mono text-muted/80">{fmt(save.bestCleared[difficulty] ?? 0)}</b> tiles
            </span>
          </footer>
        </main>
      </div>

      {help && <HelpModal onClose={() => setHelp(false)} />}
    </div>
  );
}
