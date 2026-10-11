import { loadSave } from "./storage";

export type MusicMode = "menu" | "playing" | "over";

/**
 * Clean procedural Web Audio engine:
 * - Master bus with DynamicsCompressorNode for clip-free loudness.
 * - Separate Music (with MusicDuck) and SFX buses with squared slider-to-gain mapping.
 * - Calm lo-fi felt-pad + sparse bell-piano BGM (76 BPM) with tension bass layer.
 * - Crisp, steady-pitch tactile SFX (no harsh sci-fi sweeps or static hum).
 */

const BPM = 76;
const STEP_SEC = 60 / BPM / 2; // eighth-note grid (~0.395s)

const CHORDS: ReadonlyArray<readonly [number, number, number, number]> = [
  [146.83, 220.0, 261.63, 329.63], // Dm9
  [116.54, 174.61, 220.0, 293.66], // Bbmaj7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [110.0, 164.81, 220.0, 261.63],  // Am7
];

const MELODY_POOL: ReadonlyArray<readonly number[]> = [
  [440.0, 523.25, 587.33, 659.25],
  [440.0, 523.25, 587.33, 698.46],
  [392.0, 440.0, 523.25, 659.25],
  [329.63, 392.0, 440.0, 523.25],
];

// Sparse rhythmic hits across a 16-step phrase (leaves natural breathing room)
const MELODY_STEPS = new Set([0, 3, 6, 10, 12]);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private _muted: boolean;
  private _musicVol: number;
  private _sfxVol: number;
  private _mode: MusicMode = "menu";
  private _tension = 0;

  private schedulerId = 0;
  private nextStepAt = 0;
  private stepIndex = 0;
  private unlocked = false;
  private resumePromise: Promise<void> | null = null;
  private lastRevealVariant = -1;

  constructor() {
    const save = loadSave();
    this._muted = save.muted;
    this._musicVol = save.musicVolume;
    this._sfxVol = save.sfxVolume;

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.stopScheduler();
          if (this.ctx && this.ctx.state === "running") {
            void this.ctx.suspend().catch(() => undefined);
          }
        } else if (!this._muted && this.unlocked) {
          void this.resumeAndStart();
        }
      });
    }
  }

  get muted() {
    return this._muted;
  }

  set muted(v: boolean) {
    this._muted = v;
    this.syncBusGains();
    if (v) {
      this.stopScheduler();
    } else if (this.unlocked) {
      void this.resumeAndStart();
    }
  }

  get musicVolume() {
    return this._musicVol;
  }

  setMusicVolume(v: number) {
    this._musicVol = Math.min(1, Math.max(0, v));
    this.syncBusGains();
    if (this._musicVol <= 0) {
      this.stopScheduler();
    } else if (!this._muted && this.unlocked && !this.schedulerId) {
      void this.resumeAndStart();
    }
  }

  get sfxVolume() {
    return this._sfxVol;
  }

  setSfxVolume(v: number) {
    this._sfxVol = Math.min(1, Math.max(0, v));
    this.syncBusGains();
  }

  setMusicMode(mode: MusicMode) {
    this._mode = mode;
    this.syncBusGains();
  }

  setTension(level: number) {
    this._tension = Math.min(2, Math.max(0, level));
  }

  private createGraph(ctx: AudioContext) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    const master = ctx.createGain();
    const duck = ctx.createGain();
    const music = ctx.createGain();
    const sfxBus = ctx.createGain();

    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = STEP_SEC;
    const fb = ctx.createGain();
    fb.gain.value = 0.24;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 1400;
    const send = ctx.createGain();
    send.gain.value = 0.28;

    send.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(fb);
    fb.connect(delay);
    delayFilter.connect(music);

    music.connect(duck);
    duck.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    this.masterGain = master;
    this.duckGain = duck;
    this.musicGain = music;
    this.sfxGain = sfxBus;
    this.delaySend = send;

    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    this.syncBusGains();
  }

  private syncBusGains() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const m = this._muted ? 0 : this._musicVol * this._musicVol;
    const s = this._muted ? 0 : this._sfxVol * this._sfxVol;
    const modeScale = this._mode === "menu" ? 0.72 : this._mode === "over" ? 0.5 : 1.0;

    this.masterGain.gain.setTargetAtTime(this._muted ? 0 : 0.95, now, 0.02);
    this.musicGain.gain.setTargetAtTime(m * 0.45 * modeScale, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(s * 0.95, now, 0.015);
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.createGraph(this.ctx);
    }
    return this.ctx;
  }

  unlock() {
    this.unlocked = true;
    if (this._muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (ctx.state !== "running") {
      try {
        const silent = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        /* ignore */
      }
      void this.resumeAndStart();
    } else if (this._musicVol > 0 && !this.schedulerId) {
      this.startScheduler();
    }
  }

  private async resumeAndStart() {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      return;
    }
    this.syncBusGains();
    if (!this._muted && this._musicVol > 0 && !document.hidden) {
      this.startScheduler();
    }
  }

  private withSfx(fn: (ctx: AudioContext, bus: GainNode) => void) {
    if (this._muted || this._sfxVol <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const bus = this.sfxGain;
    if (ctx.state === "running") {
      fn(ctx, bus);
      return;
    }
    if (!this.resumePromise) {
      this.resumePromise = ctx
        .resume()
        .then(() => {
          this.syncBusGains();
          if (!this._muted && ctx.state === "running") fn(ctx, bus);
        })
        .catch(() => undefined)
        .finally(() => {
          this.resumePromise = null;
        });
    }
  }

  // ---- Adaptive Music Scheduler ----
  private startScheduler() {
    if (this.schedulerId || !this.ctx || this._muted || this._musicVol <= 0) return;
    this.nextStepAt = this.ctx.currentTime + 0.06;
    this.schedulerId = window.setInterval(() => this.tickMusic(), 120);
  }

  private stopScheduler() {
    if (this.schedulerId) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = 0;
    }
  }

  private tickMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this._muted || this._musicVol <= 0) return;
    const horizon = ctx.currentTime + 0.28;
    while (this.nextStepAt < horizon) {
      this.scheduleStep(ctx, this.stepIndex, this.nextStepAt);
      this.nextStepAt += STEP_SEC;
      this.stepIndex++;
    }
  }

  private scheduleStep(ctx: AudioContext, step: number, t: number) {
    if (!this.musicGain) return;
    const bar = Math.floor(step / 16) % CHORDS.length;
    const stepInBar = step % 16;
    const chord = CHORDS[bar];

    // 1) Warm felt-piano / pad chord at phrase start
    if (stepInBar === 0) {
      const padDur = STEP_SEC * 16.2;
      for (let i = 0; i < chord.length; i++) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(chord[i], t);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(950, t);
        filter.frequency.exponentialRampToValueAtTime(340, t + padDur);

        const peak = i === 0 ? 0.14 : 0.065;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, t + padDur);

        osc.connect(filter).connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + padDur + 0.04);
      }
    }

    // 2) Sparse bell-piano melody in playing mode (breathes naturally)
    if (this._mode === "playing" && MELODY_STEPS.has(stepInBar)) {
      const pool = MELODY_POOL[bar];
      const idx = (bar + stepInBar) % pool.length;
      this.scheduleBellNote(ctx, pool[idx], t, 0.55, 0.12);
    }

    // 3) Subtle warm bass pulse only when tension >= 1
    if (this._mode === "playing" && this._tension >= 1 && stepInBar % 4 === 0) {
      const root = chord[0] * 0.5;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(root, t);
      const amp = this._tension >= 2 ? 0.2 : 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(g).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.48);
    }
  }

  private scheduleBellNote(ctx: AudioContext, freq: number, t: number, dur: number, amp: number) {
    if (!this.musicGain) return;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const overGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(freq * 2, t);
    overGain.gain.setValueAtTime(0.15, t);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(520, t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filter);
    overtone.connect(overGain).connect(filter);
    filter.connect(g).connect(this.musicGain);
    if (this.delaySend) g.connect(this.delaySend);

    osc.start(t);
    overtone.start(t);
    osc.stop(t + dur + 0.04);
    overtone.stop(t + dur + 0.04);
  }

  private duckMusic(holdSec: number) {
    if (!this.ctx || !this.duckGain) return;
    const now = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setTargetAtTime(0.25, now, 0.02);
    this.duckGain.gain.setTargetAtTime(1.0, now + holdSec, 0.25);
  }

  // ---- Clean Tactile SFX Helpers ----
  private chime(
    ctx: AudioContext,
    bus: GainNode,
    freq: number,
    dur: number,
    gain: number,
    delay = 0,
    type: OscillatorType = "sine",
  ) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private microClick(ctx: AudioContext, bus: GainNode, centerHz: number, gain: number, dur = 0.016) {
    if (!this.noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(centerHz, t);
    filter.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(bus);
    src.start(t, Math.random() * 0.4, dur + 0.02);
  }

  // ---- Public SFX Events ----
  click() {
    this.withSfx((ctx, bus) => {
      this.chime(ctx, bus, 340, 0.035, 0.16, 0, "sine");
      this.microClick(ctx, bus, 1900, 0.12, 0.012);
    });
  }

  reveal(cells: number) {
    this.withSfx((ctx, bus) => {
      if (cells > 12) {
        [587.33, 739.99, 880.0, 1318.51].forEach((f, i) => {
          this.chime(ctx, bus, f, 0.22, 0.16, i * 0.045, "sine");
        });
      } else if (cells > 1) {
        this.chime(ctx, bus, 587.33, 0.12, 0.18, 0, "sine");
        this.chime(ctx, bus, 880.0, 0.14, 0.15, 0.038, "sine");
      } else {
        const notes = [293.66, 329.63, 392.0, 440.0];
        this.lastRevealVariant = (this.lastRevealVariant + 1) % notes.length;
        this.chime(ctx, bus, notes[this.lastRevealVariant], 0.065, 0.2, 0, "triangle");
        this.microClick(ctx, bus, 1500, 0.11, 0.014);
      }
    });
  }

  chord() {
    this.withSfx((ctx, bus) => {
      this.chime(ctx, bus, 440.0, 0.08, 0.18, 0, "triangle");
      this.chime(ctx, bus, 659.25, 0.1, 0.16, 0.028, "sine");
      this.microClick(ctx, bus, 2100, 0.1, 0.015);
    });
  }

  flag() {
    this.withSfx((ctx, bus) => {
      this.chime(ctx, bus, 880.0, 0.065, 0.18, 0, "sine");
      this.microClick(ctx, bus, 2400, 0.14, 0.014);
    });
  }

  unflag() {
    this.withSfx((ctx, bus) => {
      this.chime(ctx, bus, 587.33, 0.05, 0.14, 0, "sine");
      this.microClick(ctx, bus, 1400, 0.09, 0.012);
    });
  }

  boom() {
    this.duckMusic(0.55);
    this.withSfx((ctx, bus) => {
      const t = ctx.currentTime;
      if (this.noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(1400, t);
        lp.frequency.exponentialRampToValueAtTime(110, t + 0.42);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.55, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
        src.connect(lp).connect(g).connect(bus);
        src.start(t, 0, 0.48);
      }

      // Clean deep sub-kick thump (no harsh sawtooth buzz)
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(36, t + 0.35);
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  gameOver() {
    this.duckMusic(1.1);
    this.withSfx((ctx, bus) => {
      this.chime(ctx, bus, 440.0, 0.25, 0.2, 0.25, "sine");
      this.chime(ctx, bus, 349.23, 0.28, 0.2, 0.5, "sine");
      this.chime(ctx, bus, 293.66, 0.48, 0.22, 0.78, "triangle");
    });
  }

  record() {
    this.withSfx((ctx, bus) => {
      [587.33, 739.99, 880.0, 1174.66].forEach((f, i) =>
        this.chime(ctx, bus, f, 0.22, 0.2, i * 0.095, "sine"),
      );
    });
  }
}

export const sfx = new AudioEngine();
