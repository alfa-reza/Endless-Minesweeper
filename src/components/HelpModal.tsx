import { Flag, Gamepad2, Hand, Heart, Keyboard, Move, MousePointerClick, Sparkles, ZoomIn } from "lucide-react";
import type { ReactNode } from "react";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
}

function Item({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#2a3270]/60 bg-white/[0.03] p-3 transition hover:border-[#4655c4]/70 hover:bg-white/[0.05]">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#3a45a8]/50 bg-linear-to-b from-accent/20 to-accent/5 text-accent">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-[13.5px] font-bold text-ink">{title}</h4>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted/90">{children}</p>
      </div>
    </div>
  );
}

export function HelpModal({ onClose }: Props) {
  return (
    <Modal onClose={onClose} labelledBy="help-title" className="max-w-3xl">
      <div className="relative border-b border-[#2a3270]/60 bg-[radial-gradient(600px_100px_at_50%_0%,rgba(124,160,255,0.18),transparent_70%)] px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <Gamepad2 size={22} className="text-accent" />
          <h2 id="help-title" className="text-lg font-bold tracking-tight">
            How to play
          </h2>
          <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-0.5 text-[11px] font-semibold text-mint">
            Quick reference
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted/90">
          The board never ends. Numbers tell you how many of the 8 surrounding tiles hide a mine. Open
          safe tiles, flag the dangerous ones and see how far you can get — your first click is always
          safe.
        </p>
      </div>

      <div className="thin-scroll grid max-h-[68vh] gap-3 overflow-y-auto p-5 sm:grid-cols-2">
        <Item icon={<MousePointerClick size={16} />} title="Dig a tile">
          <span className="kbd">Left click</span> a hidden tile. Empty areas open up automatically.
        </Item>
        <Item icon={<Flag size={16} />} title="Place / remove a flag">
          <span className="kbd">Right click</span> or press <span className="kbd">F</span> over a tile.
        </Item>
        <Item icon={<Sparkles size={16} />} title="Chord">
          <span className="kbd">Left click</span> a number whose flag count matches it to open every
          other neighbour at once. A wrong flag will cost you!
        </Item>
        <Item icon={<ZoomIn size={16} />} title="Zoom">
          <span className="kbd">Wheel</span>, trackpad pinch, or <span className="kbd">+</span>
          <span className="kbd">−</span>.
        </Item>
        <Item icon={<Move size={16} />} title="Pan the map">
          <span className="kbd">Drag</span> with the mouse, hold <span className="kbd">Space</span> or
          the middle button, or use <span className="kbd">W A S D</span> / arrows (
          <span className="kbd">Shift</span> = fast).
        </Item>
        <Item icon={<Hand size={16} />} title="Touch screens">
          Tap to dig, <b>long-press</b> to flag, drag to pan and pinch to zoom. Use the Dig / Flag
          switch at the bottom to swap what a tap does.
        </Item>
        <Item icon={<Keyboard size={16} />} title="Shortcuts">
          <span className="kbd">Esc</span> pause · <span className="kbd">C</span> re-centre ·{" "}
          <span className="kbd">F</span> flag under cursor.
        </Item>
        <Item icon={<Heart size={16} fill="currentColor" />} title="Lives & score">
          Easy and Normal give you extra lives. Every tile you open scores points (bigger numbers are
          worth more), multiplied by the difficulty. Your best score is saved.
        </Item>
      </div>

      <div className="flex justify-end gap-2 border-t border-[#2a3270]/60 bg-white/[0.02] px-5 py-3.5">
        <button data-autofocus className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
