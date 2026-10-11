import { Eye, Hand, Music, SlidersHorizontal, Sparkles, Volume2, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { sfx } from "../game/audio";
import { loadSave, patchSave, subscribeSave } from "../game/storage";
import { cn } from "../utils/cn";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

const LONG_PRESS_OPTIONS = [
  { label: "Fast (260ms)", ms: 260 },
  { label: "Normal (350ms)", ms: 350 },
  { label: "Slow (480ms)", ms: 480 },
] as const;

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="focus-ring flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#26334d] bg-[#0f172a]/70 px-3.5 py-3 text-left transition hover:border-[#3d527a]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-accent" aria-hidden="true">
          {icon}
        </span>
        <div>
          <div className="text-[14px] font-semibold text-ink">{title}</div>
          <div className="text-[12px] text-muted">{description}</div>
        </div>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-accent bg-accent/85" : "border-[#334155] bg-[#1e293b]",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

export function SettingsModal({ onClose }: Props) {
  const save = useSyncExternalStore(subscribeSave, loadSave);

  const setMusic = (val: number) => {
    sfx.unlock();
    sfx.setMusicVolume(val);
    patchSave({ musicVolume: val, muted: val === 0 && save.sfxVolume === 0 ? true : false });
    if (val > 0 && sfx.muted) sfx.muted = false;
  };

  const setSfxVol = (val: number) => {
    sfx.unlock();
    sfx.setSfxVolume(val);
    patchSave({ sfxVolume: val, muted: val === 0 && save.musicVolume === 0 ? true : false });
    if (val > 0 && sfx.muted) sfx.muted = false;
  };

  return (
    <Modal onClose={onClose} labelledBy="settings-title" className="max-w-md">
      <div className="flex items-center justify-between border-b border-[#26334d] bg-[#151e30] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={20} className="text-accent" aria-hidden="true" />
          <h1 id="settings-title" className="text-lg font-bold tracking-tight">
            Settings
          </h1>
        </div>
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => {
            sfx.click();
            onClose();
          }}
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
      </div>

      <div className="thin-scroll max-h-[65dvh] space-y-4 overflow-y-auto p-5">
        {/* Audio Sliders */}
        <div className="space-y-3 rounded-xl border border-[#26334d] bg-[#0f172a]/70 p-3.5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <label htmlFor="music-vol" className="flex items-center gap-2 font-semibold text-ink">
                <Music size={15} className="text-accent" aria-hidden="true" /> Music &amp; Ambience
              </label>
              <span className="font-mono text-[12px] text-muted tabular-nums">
                {save.muted ? "Muted" : `${Math.round(save.musicVolume * 100)}%`}
              </span>
            </div>
            <input
              id="music-vol"
              type="range"
              min={0}
              max={100}
              value={save.muted ? 0 : Math.round(save.musicVolume * 100)}
              onChange={(e) => setMusic(Number(e.target.value) / 100)}
              className="focus-ring h-6 w-full cursor-pointer accent-sky-400"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <label htmlFor="sfx-vol" className="flex items-center gap-2 font-semibold text-ink">
                <Volume2 size={15} className="text-mint" aria-hidden="true" /> Sound Effects
              </label>
              <span className="font-mono text-[12px] text-muted tabular-nums">
                {save.muted ? "Muted" : `${Math.round(save.sfxVolume * 100)}%`}
              </span>
            </div>
            <input
              id="sfx-vol"
              type="range"
              min={0}
              max={100}
              value={save.muted ? 0 : Math.round(save.sfxVolume * 100)}
              onChange={(e) => setSfxVol(Number(e.target.value) / 100)}
              onPointerUp={() => sfx.click()}
              className="focus-ring h-6 w-full cursor-pointer accent-emerald-400"
            />
          </div>
        </div>

        {/* Toggles */}
        <ToggleRow
          icon={<Eye size={17} />}
          title="High-contrast tiles"
          description="Sharper tile edges and brighter numbers"
          checked={save.highContrast}
          onToggle={() => {
            sfx.click();
            patchSave({ highContrast: !save.highContrast });
          }}
        />

        <ToggleRow
          icon={<Sparkles size={17} />}
          title="Reduce motion &amp; shake"
          description="Disable camera shake, particles, and pulses"
          checked={save.reduceMotion}
          onToggle={() => {
            sfx.click();
            patchSave({ reduceMotion: !save.reduceMotion });
          }}
        />

        <ToggleRow
          icon={<Hand size={17} />}
          title="Touch haptics"
          description="Vibrate on flag placement and mines (Android)"
          checked={save.haptics}
          onToggle={() => {
            sfx.click();
            patchSave({ haptics: !save.haptics });
          }}
        />

        {/* Long-press timing */}
        <div className="rounded-xl border border-[#26334d] bg-[#0f172a]/70 p-3.5">
          <div className="mb-2 text-[13px] font-semibold text-ink">Touch long-press to flag</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Long press duration">
            {LONG_PRESS_OPTIONS.map((opt) => {
              const active = save.longPressMs === opt.ms;
              return (
                <button
                  key={opt.ms}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    sfx.click();
                    patchSave({ longPressMs: opt.ms });
                  }}
                  className={cn(
                    "focus-ring min-h-[44px] cursor-pointer rounded-lg border px-2 py-2 text-[12px] font-semibold transition",
                    active
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-[#26334d] bg-[#161f33] text-muted hover:text-ink",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-[#26334d] bg-[#111827] px-5 py-3.5">
        <button
          data-autofocus
          type="button"
          className="btn btn-primary"
          onClick={() => {
            sfx.click();
            onClose();
          }}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
