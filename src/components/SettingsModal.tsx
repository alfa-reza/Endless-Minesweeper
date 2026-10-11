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
      className="focus-ring flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2e333d] bg-[#111317]/80 px-3.5 py-2.5 text-left transition-colors hover:border-[#464e5e]"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-mint" aria-hidden="true">
          {icon}
        </span>
        <div>
          <div className="text-[13.5px] font-semibold text-ink">{title}</div>
          <div className="text-[12px] text-muted">{description}</div>
        </div>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-mint bg-mint" : "border-[#3b4252] bg-[#232730]",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-[#111317] shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

/** Shared settings panel used inside both StartMenu SettingsModal and PauseModal's Settings tab. */
export function SettingsPanel() {
  const save = useSyncExternalStore(subscribeSave, loadSave);

  const setMusic = (val: number) => {
    sfx.unlock();
    sfx.setMusicVolume(val);
    patchSave({ musicVolume: val, muted: val === 0 && save.sfxVolume === 0 });
    if (val > 0 && sfx.muted) sfx.muted = false;
  };

  const setSfxVol = (val: number) => {
    sfx.unlock();
    sfx.setSfxVolume(val);
    patchSave({ sfxVolume: val, muted: val === 0 && save.musicVolume === 0 });
    if (val > 0 && sfx.muted) sfx.muted = false;
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-lg border border-[#2e333d] bg-[#111317]/80 p-3.5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <label htmlFor="music-vol" className="flex items-center gap-2 font-semibold text-ink">
              <Music size={15} className="text-mint" aria-hidden="true" /> Music &amp; Ambience
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
            className="focus-ring h-6 w-full cursor-pointer accent-emerald-400"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-[13px]">
            <label htmlFor="sfx-vol" className="flex items-center gap-2 font-semibold text-ink">
              <Volume2 size={15} className="text-accent" aria-hidden="true" /> Sound Effects
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
            className="focus-ring h-6 w-full cursor-pointer accent-sky-400"
          />
        </div>
      </div>

      <ToggleRow
        icon={<Eye size={16} />}
        title="High-contrast tiles"
        description="Sharper edges and brighter numbers"
        checked={save.highContrast}
        onToggle={() => {
          sfx.click();
          patchSave({ highContrast: !save.highContrast });
        }}
      />

      <ToggleRow
        icon={<Sparkles size={16} />}
        title="Reduce motion &amp; shake"
        description="Disable camera shake, particles, and pulses"
        checked={save.reduceMotion}
        onToggle={() => {
          sfx.click();
          patchSave({ reduceMotion: !save.reduceMotion });
        }}
      />

      <ToggleRow
        icon={<Hand size={16} />}
        title="Touch haptics"
        description="Vibrate on flags and mines (Android)"
        checked={save.haptics}
        onToggle={() => {
          sfx.click();
          patchSave({ haptics: !save.haptics });
        }}
      />

      <div className="rounded-lg border border-[#2e333d] bg-[#111317]/80 p-3">
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
                  "focus-ring min-h-[44px] cursor-pointer rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "border-mint bg-mint/15 text-mint"
                    : "border-[#2e333d] bg-[#232730] text-muted hover:text-ink",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ onClose }: Props) {
  return (
    <Modal onClose={onClose} labelledBy="settings-title" className="max-w-md">
      <div className="flex items-center justify-between border-b border-[#2e333d] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal size={19} className="text-mint" aria-hidden="true" />
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

      <div className="thin-scroll max-h-[65dvh] overflow-y-auto p-4">
        <SettingsPanel />
      </div>

      <div className="flex justify-end border-t border-[#2e333d] px-4 py-3">
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
