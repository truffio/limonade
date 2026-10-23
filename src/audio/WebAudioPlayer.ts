import { JINGLES, SOUNDS, type SoundId } from './sounds';
import { midi, noiseBuffer, note } from './synth';

/** What the audio manager needs from a sound engine; tests use a fake one. */
export interface SoundPlayer {
  /** Creates the audio context; must be called from a user gesture (browser autoplay rules). */
  unlock(): void;
  play(id: SoundId, detune?: number): void;
  setRain(on: boolean): void;
  setMusic(on: boolean): void;
  /** `volume` from 0 to 1; `effects` mutes sound effects and rain. */
  setLevels(volume: number, effects: boolean): void;
  suspend(): void;
  resume(): void;
}

const RAIN_FADE = 1.2;
const DUCK_LEVEL = 0.3;
const DUCK_SECONDS = 1.6;

/** Light summer loop: a ukulele-like arpeggio on four chords, scheduled a little ahead. */
const CHORDS = [
  [60, 64, 67, 72],
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [55, 59, 62, 67],
];
const BEAT = 0.3;
const LOOKAHEAD = 0.6;

/** Web Audio implementation (docs/epics/EPIC-son.md, "Technical approach"). */
export class WebAudioPlayer implements SoundPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private effects: GainNode | null = null;
  private music: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  private wantMusic = false;
  private wantRain = false;
  private volume = 0.6;
  private effectsOn = true;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.effects = ctx.createGain();
    this.music = ctx.createGain();
    this.effects.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(ctx.destination);
    void ctx.resume();
    // iOS Safari only starts audio after something plays inside the gesture.
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    silent.connect(ctx.destination);
    silent.start();
    this.applyLevels();
    if (this.wantRain) this.setRain(true);
    if (this.wantMusic) this.startMusic();
  }

  play(id: SoundId, detune = 0): void {
    const { ctx, effects } = this;
    if (!ctx || !effects || !this.effectsOn || ctx.state !== 'running') return;
    SOUNDS[id](ctx, effects, ctx.currentTime + 0.01, detune);
    if (JINGLES.has(id)) this.duck();
  }

  setRain(on: boolean): void {
    this.wantRain = on;
    const { ctx, effects } = this;
    if (!ctx || !effects) return;
    const now = ctx.currentTime;
    if (on && !this.rainSource) {
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(ctx);
      source.loop = true;
      const low = ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + RAIN_FADE);
      source.connect(low).connect(gain).connect(effects);
      source.start();
      this.rainSource = source;
      this.rainGain = gain;
    } else if (!on && this.rainSource && this.rainGain) {
      this.rainGain.gain.cancelScheduledValues(now);
      this.rainGain.gain.setValueAtTime(Math.max(0.0001, this.rainGain.gain.value), now);
      this.rainGain.gain.exponentialRampToValueAtTime(0.0001, now + RAIN_FADE);
      this.rainSource.stop(now + RAIN_FADE + 0.05);
      this.rainSource = null;
      this.rainGain = null;
    }
  }

  setMusic(on: boolean): void {
    this.wantMusic = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  setLevels(volume: number, effects: boolean): void {
    this.volume = volume;
    this.effectsOn = effects;
    this.applyLevels();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private applyLevels(): void {
    if (!this.ctx || !this.master || !this.effects) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.volume, now, 0.05);
    this.effects.gain.setTargetAtTime(this.effectsOn ? 1 : 0, now, 0.05);
  }

  /** Lowers the music while a jingle plays. */
  private duck(): void {
    const { ctx, music } = this;
    if (!ctx || !music || !this.musicTimer) return;
    const now = ctx.currentTime;
    music.gain.cancelScheduledValues(now);
    music.gain.setTargetAtTime(DUCK_LEVEL * 0.25, now, 0.05);
    music.gain.setTargetAtTime(0.25, now + DUCK_SECONDS, 0.3);
  }

  private startMusic(): void {
    const { ctx, music } = this;
    if (!ctx || !music || this.musicTimer) return;
    music.gain.setValueAtTime(0.25, ctx.currentTime);
    this.nextBeat = ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 150);
  }

  private stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx && this.music) this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  private scheduleMusic(): void {
    const { ctx, music } = this;
    if (!ctx || !music) return;
    while (this.nextBeat < ctx.currentTime + LOOKAHEAD) {
      const chord = CHORDS[Math.floor(this.beat / 8) % CHORDS.length] ?? CHORDS[0] ?? [];
      const pitch = chord[[0, 2, 1, 3, 2, 1, 3, 2][this.beat % 8] ?? 0] ?? 60;
      note(ctx, music, this.nextBeat, {
        freq: midi(pitch),
        duration: BEAT * 1.6,
        type: 'triangle',
        gain: 0.18,
      });
      if (this.beat % 4 === 0) {
        note(ctx, music, this.nextBeat, {
          freq: midi((chord[0] ?? 60) - 12),
          duration: BEAT * 3,
          type: 'sine',
          gain: 0.2,
        });
      }
      this.nextBeat += BEAT;
      this.beat++;
    }
  }
}
