import { Flag, Gamepad2, Hand, Heart, Keyboard, Move, MousePointerClick, Sparkles, X, ZoomIn } from "lucide-react";
import type { ReactNode } from "react";
import { sfx } from "../game/audio";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

function Item({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="lcd-well flex items-start gap-3 rounded-[5px] p-3">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[4px] border border-[#454d5b] bg-[#282d35] text-mint"
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-[14px] font-bold text-ink">{title}</h2>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

export function HelpModal({ onClose }: Props) {
  const close = () => {
    sfx.click();
    onClose();
  };

  return (
    <Modal onClose={onClose} labelledBy="help-title" className="max-w-3xl">
      <div className="border-b-2 border-[#16191f] bg-[#20242b] px-5 pt-4 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Gamepad2 size={21} className="text-mint" aria-hidden="true" />
            <h1 id="help-title" className="text-lg font-bold tracking-tight">
              How to play
            </h1>
          </div>
          <button type="button" className="btn btn-icon" onClick={close} aria-label="Close help">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          The board never ends. Numbers tell you how many of the 8 surrounding tiles hide a mine. Open
          safe tiles, flag mines, and explore — your first click is always safe.
        </p>
      </div>

      <div className="thin-scroll grid max-h-[62dvh] gap-3 overflow-y-auto p-5 sm:grid-cols-2">
        <Item icon={<MousePointerClick size={16} />} title="Dig a tile">
          <span className="kbd">Left click</span> or <span className="kbd">Enter</span> on a hidden tile. Empty areas open automatically.
        </Item>
        <Item icon={<Flag size={16} />} title="Place / remove a flag">
          <span className="kbd">Right click</span> or press <span className="kbd">F</span> on the focused tile.
        </Item>
        <Item icon={<Sparkles size={16} />} title="Chord">
          <span className="kbd">Click</span> or <span className="kbd">Enter</span> on a number whose flag count matches it to open all remaining neighbours.
        </Item>
        <Item icon={<ZoomIn size={16} />} title="Zoom">
          <span className="kbd">Wheel</span>, pinch, <span className="kbd">+</span>/<span className="kbd">−</span>, or the on-screen zoom buttons.
        </Item>
        <Item icon={<Move size={16} />} title="Pan &amp; keyboard cursor">
          <span className="kbd">Drag</span> to pan, or move the tile cursor with <span className="kbd">W A S D</span> / <span className="kbd">Arrows</span>. Hold <span className="kbd">Shift</span> to pan fast.
        </Item>
        <Item icon={<Hand size={16} />} title="Touch screens">
          Tap to dig, <b>long-press</b> (watch the ring) to flag, drag to pan, and pinch to zoom. Switch to Flag mode for safe one-tap flagging.
        </Item>
        <Item icon={<Keyboard size={16} />} title="Shortcuts &amp; Gamepad">
          <span className="kbd">Esc</span> / <span className="kbd">P</span> pause · <span className="kbd">C</span> re-centre. Gamepad D-pad + A/X supported.
        </Item>
        <Item icon={<Heart size={16} fill="currentColor" />} title="Lives &amp; score">
          Easy and Normal grant extra lives. Higher numbers and higher difficulties multiply your score.
        </Item>
      </div>

      <div className="flex justify-end border-t border-[#2e333d] px-5 py-3.5">
        <button data-autofocus type="button" className="btn btn-primary" onClick={close}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
