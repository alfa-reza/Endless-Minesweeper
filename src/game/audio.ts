import { loadSave } from "./storage";

export type MusicMode = "menu" | "playing" | "over";

/**
 * Procedural Web Audio engine:
 * - Master bus with DynamicsCompressorNode so sounds stay loud, clean, and clip-free.
 * - Separate Music (with MusicDuck), Ambience, and SFX buses with squared slider-to-gain mapping.
 * - Adaptive background music (ambient Dorian chords + marimba pulse + low-life tension layer).
 * - Reliable iOS/Android/desktop unlock + visibilitychange resume handling.
 */

const BPM = 88;
const STEP_SEC = 60 / BPM / 2; // eighth-note grid (~0.341s)

// D Dorian / A minor pentatonic voicings (Hz)
const CHORDS: ReadonlyArray<readonly [number, number, number, number]> = [
  [146.83, 220.0, 261.63, 329.63], // Dm9
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
  [110.0, 164.81, 220.0, 261.63],  // Am7
];

const ARP_POOL: ReadonlyArray<readonly number[]> = [
  [293.66, 329.63, 440.0, 523.25, 587.33, 659.25],
  [349.23, 440.0, 523.25, 659.25, 698.46, 880.0],
  [261.63, 329.63, 392.0, 493.88, 523.25, 659.25],
  [220.0, 261.63, 329.63, 392.0, 440.0, 523.25],
];

const ARP_PATTERN = [0, 2, 4, 3, 1, 4, 5, 2];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private delaySend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambienceSrc: AudioBufferSourceNode | null = null;

  private _muted: boolean;
  private _musicVol: number;
  private _sfxVol: number;
  private _mode: MusicMode = "menu";
  private _tension = 0; // 0 calm, 1 heightened, 2 critical

  private schedulerId = 0;
  private nextStepAt = 0;
  private stepIndex = 0;
  private unlocked = false;
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
    const ambience = ctx.createGain();
    const sfxBus = ctx.createGain();

    // Warm stereo-ish feedback delay for music arps
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = STEP_SEC; // dotted-eighth / eighth echo
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 1800;
    const send = ctx.createGain();
    send.gain.value = 0.32;

    send.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(fb);
    fb.connect(delay);
    delayFilter.connect(music);

    music.connect(duck);
    ambience.connect(duck);
    duck.connect(master);
    sfxBus.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);

    this.masterGain = master;
    this.duckGain = duck;
    this.musicGain = music;
    this.ambienceGain = ambience;
    this.sfxGain = sfxBus;
    this.delaySend = send;

    // Pre-build 2s soft noise buffer for percussive transients & ambience
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.96 * b0 + 0.04 * white;
      data[i] = b0 * 1.8;
    }
    this.noiseBuf = buf;

    this.startAmbienceBed(ctx);
    this.syncBusGains();
  }

  private startAmbienceBed(ctx: AudioContext) {
    if (this.ambienceSrc || !this.noiseBuf || !this.ambienceGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 260;
    filter.Q.value = 0.7;
    src.connect(filter).connect(this.ambienceGain);
    src.start();
    this.ambienceSrc = src;
  }

  private syncBusGains() {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.ambienceGain || !this.sfxGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const m = this._muted ? 0 : this._musicVol * this._musicVol;
    const s = this._muted ? 0 : this._sfxVol * this._sfxVol;
    const modeScale = this._mode === "menu" ? 0.75 : this._mode === "over" ? 0.55 : 1.0;

    this.masterGain.gain.setTargetAtTime(this._muted ? 0 : 0.95, now, 0.02);
    this.musicGain.gain.setTargetAtTime(m * 0.48 * modeScale, now, 0.08);
    this.ambienceGain.gain.setTargetAtTime(m * 0.14 * modeScale, now, 0.12);
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

  /** Must be called on user gesture (pointerdown/keydown/click) to satisfy iOS/Android autoplay rules. */
  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.unlocked = true;

    if (ctx.state !== "running") {
      // 1-sample silent buffer wakes iOS Safari audio hardware reliably inside gesture
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
    } else if (!this._muted && this._musicVol > 0 && !this.schedulerId) {
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
    } else {
      void ctx
        .resume()
        .then(() => {
          this.syncBusGains();
          if (!this._muted && ctx.state === "running") fn(ctx, bus);
        })
        .catch(() => undefined);
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

    // 1) Warm ambient chord pad at start of each 2-bar (16 eighth-notes) phrase
    if (stepInBar === 0) {
      const padDur = STEP_SEC * 16.5;
      for (let i = 0; i < chord.length; i++) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(chord[i], t);
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(this._mode === "playing" ? 680 : 480, t);

        const peak = i === 0 ? 0.16 : 0.08;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.9);
        g.gain.setValueAtTime(peak * 0.85, t + padDur - 1.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + padDur);

        osc.connect(filter).connect(g).connect(this.musicGain);
        osc.start(t);
        osc.stop(t + padDur + 0.05);
      }
    }

    // 2) Gentle marimba/pluck pulse in playing mode (sparse & musical)
    if (this._mode === "playing" && (stepInBar % 2 === 0 || (this._tension >= 1 && stepInBar % 4 === 3))) {
      const pool = ARP_POOL[bar];
      const idx = ARP_PATTERN[(stepInBar + bar * 3) % ARP_PATTERN.length];
      const freq = pool[idx];
      this.schedulePluck(ctx, freq, t, 0.28, 0.14);
    }

    // 3) Tension heartbeat bass pulse when low on lives / Hard+
    if (this._mode === "playing" && this._tension >= 1 && stepInBar % 4 === 0) {
      const root = chord[0] * 0.5;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(root, t);
      const amp = this._tension >= 2 ? 0.22 : 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.38);
    }
  }

  private schedulePluck(ctx: AudioContext, freq: number, t: number, dur: number, amp: number) {
    if (!this.musicGain) return;
    const osc = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(freq * 2, t);

    const overGain = ctx.createGain();
    overGain.gain.setValueAtTime(0.22, t);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.01);
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
    this.duckGain.gain.setTargetAtTime(0.22, now, 0.02);
    this.duckGain.gain.setTargetAtTime(1.0, now + holdSec, 0.25);
  }

  // ---- SFX Helpers ----
  private tone(
    ctx: AudioContext,
    bus: GainNode,
    freq: number,
    endFreq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private transient(
    ctx: AudioContext,
    bus: GainNode,
    centerHz: number,
    dur: number,
    gain: number,
    delay = 0,
  ) {
    if (!this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(centerHz, t);
    filter.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  // ---- Public SFX Events ----
  click() {
    this.withSfx((ctx, bus) => {
      this.tone(ctx, bus, 760, 520, 0.055, "triangle", 0.2);
      this.transient(ctx, bus, 1800, 0.025, 0.12);
    });
  }

  reveal(cells: number) {
    this.withSfx((ctx, bus) => {
      if (cells > 12) {
        // Lush pentatonic cascade for big flood clears
        const notes = [440, 523.25, 659.25, 880];
        notes.forEach((f, i) => {
          this.tone(ctx, bus, f, f * 1.02, 0.18, "triangle", 0.19, i * 0.042);
        });
        this.transient(ctx, bus, 1400, 0.14, 0.16);
      } else if (cells > 1) {
        this.tone(ctx, bus, 440, 587.33, 0.11, "triangle", 0.22);
        this.tone(ctx, bus, 659.25, 783.99, 0.11, "sine", 0.16, 0.035);
      } else {
        // Anti-"machine gun": cycle & slightly pitch-jitter single-tile taps
        const variants = [460, 510, 550, 490];
        this.lastRevealVariant = (this.lastRevealVariant + 1) % variants.length;
        const base = variants[this.lastRevealVariant] * (0.97 + Math.random() * 0.06);
        this.tone(ctx, bus, base, base * 0.88, 0.08, "triangle", 0.22);
        this.transient(ctx, bus, 1500, 0.025, 0.14);
      }
    });
  }

  chord() {
    this.withSfx((ctx, bus) => {
      this.tone(ctx, bus, 440, 660, 0.09, "triangle", 0.22);
      this.tone(ctx, bus, 660, 880, 0.1, "sine", 0.18, 0.03);
      this.transient(ctx, bus, 2000, 0.03, 0.15);
    });
  }

  flag() {
    this.withSfx((ctx, bus) => {
      this.tone(ctx, bus, 520, 920, 0.085, "triangle", 0.25);
      this.tone(ctx, bus, 1040, 1180, 0.06, "sine", 0.14, 0.02);
      this.transient(ctx, bus, 2400, 0.03, 0.14);
    });
  }

  unflag() {
    this.withSfx((ctx, bus) => {
      this.tone(ctx, bus, 680, 400, 0.08, "triangle", 0.21);
      this.transient(ctx, bus, 1400, 0.025, 0.1);
    });
  }

  boom() {
    this.duckMusic(0.55);
    this.withSfx((ctx, bus) => {
      const t = ctx.currentTime;
      // Mid-range crack + rumble so mobile phone speakers hear full punch
      const len = Math.floor(ctx.sampleRate * 0.65);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.4);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(140, t + 0.58);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.65, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.64);
      src.connect(lp).connect(g).connect(bus);
      src.start(t);

      // Punchy mid-low body (audible down to ~95Hz) + sub thump
      this.tone(ctx, bus, 220, 68, 0.35, "sawtooth", 0.28);
      this.tone(ctx, bus, 140, 42, 0.5, "sine", 0.42);
    });
  }

  gameOver() {
    this.duckMusic(1.1);
    this.withSfx((ctx, bus) => {
      this.tone(ctx, bus, 392, 349.23, 0.28, "triangle", 0.24, 0.28);
      this.tone(ctx, bus, 329.63, 293.66, 0.32, "triangle", 0.24, 0.55);
      this.tone(ctx, bus, 261.63, 196.0, 0.55, "triangle", 0.28, 0.85);
    });
  }

  record() {
    this.withSfx((ctx, bus) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        this.tone(ctx, bus, f, f, 0.22, "triangle", 0.24, i * 0.095),
      );
    });
  }
}

export const sfx = new AudioEngine();
export const audio = sfx;
