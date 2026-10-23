import { burst, midi, note } from './synth';

/** Every sound effect in the game (docs/epics/EPIC-son.md, "Sound map"). */
export type SoundId =
  | 'pop'
  | 'tickUp'
  | 'tickDown'
  | 'purchase'
  | 'bonk'
  | 'open'
  | 'ding'
  | 'hmm'
  | 'ohh'
  | 'happy'
  | 'sad'
  | 'celebration';

type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number, detune: number) => void;

/** Soft, cheerful sounds only: no harsh buzzers for a 10-year-old. */
export const SOUNDS: Record<SoundId, Recipe> = {
  pop: (ctx, out, t) =>
    note(ctx, out, t, { freq: 520, slideTo: 880, duration: 0.08, type: 'triangle', gain: 0.18 }),

  tickUp: (ctx, out, t) =>
    note(ctx, out, t, { freq: midi(84), duration: 0.06, type: 'triangle', gain: 0.15 }),

  tickDown: (ctx, out, t) =>
    note(ctx, out, t, { freq: midi(77), duration: 0.06, type: 'triangle', gain: 0.15 }),

  purchase: (ctx, out, t) => {
    burst(ctx, out, t, { duration: 0.18, frequency: 1200, gain: 0.25 });
    note(ctx, out, t, { at: 0.12, freq: midi(88), duration: 0.12, gain: 0.2 });
    note(ctx, out, t, { at: 0.2, freq: midi(93), duration: 0.25, gain: 0.2 });
  },

  bonk: (ctx, out, t) =>
    note(ctx, out, t, { freq: 220, slideTo: 140, duration: 0.22, type: 'sine', gain: 0.3 }),

  open: (ctx, out, t) => {
    [72, 76, 79, 84].forEach((m, i) =>
      note(ctx, out, t, {
        at: i * 0.09,
        freq: midi(m),
        duration: 0.22,
        type: 'triangle',
        gain: 0.22,
      }),
    );
  },

  // Cash register: two bright bells and a little coin shimmer.
  ding: (ctx, out, t, detune) => {
    note(ctx, out, t, { freq: midi(96), duration: 0.35, gain: 0.16, detune });
    note(ctx, out, t, { at: 0.05, freq: midi(100), duration: 0.4, gain: 0.12, detune });
    burst(ctx, out, t, { duration: 0.12, filter: 'highpass', frequency: 6000, gain: 0.08 });
  },

  hmm: (ctx, out, t) =>
    note(ctx, out, t, { freq: 180, slideTo: 150, duration: 0.35, type: 'triangle', gain: 0.18 }),

  ohh: (ctx, out, t) =>
    note(ctx, out, t, {
      freq: 440,
      slideTo: 260,
      duration: 0.45,
      type: 'sine',
      gain: 0.2,
      attack: 0.05,
    }),

  happy: (ctx, out, t) => {
    [72, 76, 79, 84, 88].forEach((m, i) =>
      note(ctx, out, t, {
        at: i * 0.08,
        freq: midi(m),
        duration: 0.3,
        type: 'triangle',
        gain: 0.2,
      }),
    );
  },

  sad: (ctx, out, t) => {
    [67, 63].forEach((m, i) =>
      note(ctx, out, t, { at: i * 0.25, freq: midi(m), duration: 0.45, type: 'sine', gain: 0.2 }),
    );
  },

  celebration: (ctx, out, t) => {
    const melody = [72, 76, 79, 84, 79, 84, 88];
    melody.forEach((m, i) =>
      note(ctx, out, t, {
        at: i * 0.12,
        freq: midi(m),
        duration: 0.28,
        type: 'triangle',
        gain: 0.22,
      }),
    );
    note(ctx, out, t, { at: melody.length * 0.12, freq: midi(96), duration: 0.8, gain: 0.18 });
  },
};

/** Sounds long enough to deserve quieter music while they play. */
export const JINGLES: ReadonlySet<SoundId> = new Set(['open', 'happy', 'sad', 'celebration']);
