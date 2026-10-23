import { describe, expect, it } from 'vitest';
import { DayPlayer } from '../../src/app/DayPlayer';
import type { DayEvent } from '../../src/core/types';

const events: DayEvent[] = [
  { t: 0.1, type: 'visitor', id: 0, outcome: 'buy' },
  { t: 0.25, type: 'rain_start' },
  { t: 0.5, type: 'visitor', id: 1, outcome: 'decline', reason: 'TROP_CHER' },
  { t: 0.9, type: 'visitor', id: 2, outcome: 'buy' },
];

describe('DayPlayer', () => {
  it('releases events in order as time passes', () => {
    const player = new DayPlayer(events, 1000);
    const seen: number[] = [];
    player.onEvent((e) => seen.push(e.t));
    player.advance(300);
    expect(seen).toEqual([0.1, 0.25]);
    player.advance(300);
    expect(seen).toEqual([0.1, 0.25, 0.5]);
  });

  it('plays faster at double speed and ends once', () => {
    const player = new DayPlayer(events, 1000);
    const ends: boolean[] = [];
    player.onEnd(({ skipped }) => ends.push(skipped));
    player.setSpeed(2);
    player.advance(500);
    expect(player.progress).toBe(1);
    player.advance(500);
    expect(ends).toEqual([false]);
  });

  it('skips to the end without replaying the remaining events', () => {
    const player = new DayPlayer(events, 1000);
    const seen: DayEvent[] = [];
    const ends: boolean[] = [];
    player.onEvent((e) => seen.push(e));
    player.onEnd(({ skipped }) => ends.push(skipped));
    player.advance(150);
    player.skip();
    expect(seen).toHaveLength(1);
    expect(ends).toEqual([true]);
    expect(player.isFinished).toBe(true);
  });
});
