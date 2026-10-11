/** Tiny synthesized sound effects (no assets needed). */

class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  unlock() {
    this.ensure();
  }

  click() {
    this.tone(700, 520, 0.05, "triangle", 0.05);
  }

  reveal(cells: number) {
    if (cells > 12) {
      this.tone(260, 900, 0.28, "sine", 0.07);
      this.tone(390, 1300, 0.28, "triangle", 0.03, 0.03);
    } else if (cells > 1) {
      this.tone(420, 760, 0.12, "triangle", 0.06);
    } else {
      this.tone(520 + Math.random() * 60, 460, 0.07, "triangle", 0.06);
    }
  }

  flag() {
    this.tone(880, 660, 0.08, "square", 0.025);
  }

  unflag() {
    this.tone(440, 330, 0.07, "square", 0.02);
  }

  chord() {
    this.tone(360, 680, 0.1, "triangle", 0.06);
  }

  boom() {
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t);
    this.tone(120, 35, 0.5, "sine", 0.3);
  }

  gameOver() {
    this.tone(392, 330, 0.25, "triangle", 0.07, 0.35);
    this.tone(294, 247, 0.3, "triangle", 0.07, 0.6);
    this.tone(196, 130, 0.5, "triangle", 0.08, 0.9);
  }

  record() {
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, f, 0.16, "triangle", 0.06, i * 0.1),
    );
  }
}

export const sfx = new Sfx();
