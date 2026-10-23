/**
 * Tiny Web Audio synthesizer: every game sound is built from oscillators and
 * filtered noise, so the game ships no audio files (docs/epics/EPIC-son.md).
 */

export interface Note {
  freq: number;
  /** Seconds after the sound's start time. */
  at?: number;
  duration: number;
  type?: OscillatorType;
  /** Peak volume, 0..1. */
  gain?: number;
  attack?: number;
  /** Glide to this frequency by the end of the note. */
  slideTo?: number;
  /** Pitch shift in cents, for small variations between repeats. */
  detune?: number;
}

const SILENT = 0.0001;

export function note(ctx: BaseAudioContext, out: AudioNode, start: number, n: Note): void {
  const t = start + (n.at ?? 0);
  const end = t + n.duration;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = n.type ?? 'sine';
  osc.frequency.setValueAtTime(n.freq, t);
  if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, end);
  osc.detune.value = n.detune ?? 0;
  const peak = n.gain ?? 0.3;
  const attack = Math.min(n.attack ?? 0.01, n.duration / 2);
  amp.gain.setValueAtTime(SILENT, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + attack);
  amp.gain.exponentialRampToValueAtTime(SILENT, end);
  osc.connect(amp).connect(out);
  osc.start(t);
  osc.stop(end + 0.05);
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/** One second of white noise, made once per audio context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

export interface NoiseBurst {
  at?: number;
  duration: number;
  gain?: number;
  filter?: BiquadFilterType;
  frequency?: number;
}

/** A short burst of filtered noise: rustles, coins, footsteps. */
export function burst(ctx: BaseAudioContext, out: AudioNode, start: number, b: NoiseBurst): void {
  const t = start + (b.at ?? 0);
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = b.filter ?? 'bandpass';
  filter.frequency.value = b.frequency ?? 2000;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(b.gain ?? 0.2, t);
  amp.gain.exponentialRampToValueAtTime(SILENT, t + b.duration);
  source.connect(filter).connect(amp).connect(out);
  source.start(t);
  source.stop(t + b.duration + 0.05);
}

/** Note frequency from a MIDI number (60 = middle C). */
export function midi(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}
