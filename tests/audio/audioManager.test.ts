// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { AudioManager } from '../../src/audio/AudioManager';
import type { SoundId } from '../../src/audio/sounds';
import type { SoundPlayer } from '../../src/audio/WebAudioPlayer';
import { newGame } from '../../src/core/game';
import type { DayRecord } from '../../src/core/types';
import { testConfig } from '../core/helpers';

const cfg = testConfig();

class FakePlayer implements SoundPlayer {
  unlocked = false;
  played: { id: SoundId; detune: number }[] = [];
  rain: boolean[] = [];
  music: boolean[] = [];
  levels: [number, boolean][] = [];
  suspended = 0;
  unlock() {
    this.unlocked = true;
  }
  play(id: SoundId, detune = 0) {
    this.played.push({ id, detune });
  }
  setRain(on: boolean) {
    this.rain.push(on);
  }
  setMusic(on: boolean) {
    this.music.push(on);
  }
  setLevels(volume: number, effects: boolean) {
    this.levels.push([volume, effects]);
  }
  suspend() {
    this.suspended++;
  }
  resume() {}
  ids() {
    return this.played.map((p) => p.id);
  }
}

function setup() {
  document.body.innerHTML = '<main id="ui"></main>';
  const root = document.getElementById('ui') as HTMLElement;
  const app = new App(root, cfg, { configFingerprint: 'test' });
  const player = new FakePlayer();
  let clock = 0;
  const manager = new AudioManager(
    app,
    player,
    () => clock,
    () => 1,
  );
  return {
    app,
    root,
    player,
    manager,
    tick: (ms: number) => (clock += ms),
    unlock: () => {
      manager.installUnlock(document);
      document.dispatchEvent(new Event('pointerdown'));
    },
  };
}

beforeEach(() => localStorage.clear());

describe('AudioManager', () => {
  it('stays silent until the first tap or key, then unlocks the engine', () => {
    const { app, player, unlock } = setup();
    app.events.emit('purchase_confirmed', { cost: 100 });
    expect(player.played).toEqual([]);
    unlock();
    expect(player.unlocked).toBe(true);
    app.events.emit('purchase_confirmed', { cost: 100 });
    expect(player.ids()).toEqual(['purchase']);
  });

  it('plays the sound map for game events', () => {
    const { app, player, unlock, tick } = setup();
    unlock();
    app.events.emit('action_refused', { error: 'ARGENT_INSUFFISANT' });
    app.events.emit('stand_open', { day: 1 });
    app.events.emit('day_event', { event: { t: 0.1, type: 'visitor', id: 0, outcome: 'buy' } });
    tick(500);
    app.events.emit('day_event', {
      event: { t: 0.2, type: 'visitor', id: 1, outcome: 'decline', reason: 'TROP_CHER' },
    });
    app.events.emit('day_event', {
      event: { t: 0.3, type: 'visitor', id: 2, outcome: 'decline', reason: 'PAS_SOIF' },
    });
    app.events.emit('day_event', {
      event: { t: 0.4, type: 'visitor', id: 3, outcome: 'missed', reason: 'MANQUE_LIMONADE' },
    });
    expect(player.ids()).toEqual(['bonk', 'open', 'ding', 'hmm', 'ohh']);
  });

  it('fades rain in and out with the weather, and stops it when the day ends', () => {
    const { app, player, unlock } = setup();
    unlock();
    app.events.emit('day_event', { event: { t: 0.25, type: 'rain_start' } });
    app.events.emit('day_event', { event: { t: 0.5, type: 'rain_stop' } });
    app.events.emit('day_event', { event: { t: 0.75, type: 'rain_start' } });
    app.events.emit('day_end', { skipped: true, profit: 0 });
    expect(player.rain).toEqual([true, false, true, false]);
  });

  it('limits a busy stand to one cash register sound every 120 ms, with pitch variation', () => {
    const { app, player, unlock, tick } = setup();
    unlock();
    const buy = () =>
      app.events.emit('day_event', { event: { t: 0.5, type: 'visitor', id: 0, outcome: 'buy' } });
    buy();
    tick(50);
    buy();
    tick(100);
    buy();
    expect(player.ids()).toEqual(['ding', 'ding']);
    expect(Math.abs(player.played[0]?.detune ?? 0)).toBeGreaterThan(0);
  });

  it('plays one jingle per report (happy or sad) and a fanfare at the end', () => {
    const { app, player, unlock } = setup();
    unlock();
    const game = newGame(cfg, { seed: 1 });
    const record = { day: 1, profit: -50 } as DayRecord;
    app.store.set({ ...app.store.get(), game: { ...game, phase: 'BILAN', history: [record] } });
    app.events.emit('screen_change', { from: 'journee', to: 'bilan' });
    app.events.emit('screen_change', { from: 'historique', to: 'bilan' });
    app.events.emit('screen_change', { from: 'bilan', to: 'fin' });
    expect(player.ids()).toEqual(['sad', 'celebration']);
  });

  it('follows the sound settings: mute, volume and music', () => {
    const { app, player, unlock } = setup();
    unlock();
    const ui = () => app.store.get().ui;
    const setUi = (patch: object) =>
      app.store.set({ ...app.store.get(), ui: { ...ui(), ...patch } });

    expect(player.levels.at(-1)?.[1]).toBe(true);
    expect(player.music.at(-1)).toBe(false); // music off by default

    setUi({ musique: true });
    expect(player.music.at(-1)).toBe(true);

    setUi({ volume: 5 });
    const loud = player.levels.at(-1)?.[0] ?? 0;
    setUi({ volume: 1 });
    expect(player.levels.at(-1)?.[0]).toBeLessThan(loud);

    setUi({ son: false });
    expect(player.levels.at(-1)).toEqual([0, false]);
    expect(player.music.at(-1)).toBe(false); // muting also stops the music
  });

  it('ticks for stepper buttons and pops for the others', () => {
    const { root, player, manager, unlock } = setup();
    unlock();
    manager.installClicks(root);
    root.innerHTML = `
      <button aria-label="Citrons (paquets) : plus">+</button>
      <button aria-label="Citrons (paquets) : moins">−</button>
      <button>Acheter</button>
      <button disabled>Ouvrir</button>`;
    root.querySelectorAll('button').forEach((b) => b.click());
    expect(player.ids()).toEqual(['tickUp', 'tickDown', 'pop']);
  });

  it('suspends audio while the tab is hidden', () => {
    const { manager, player } = setup();
    let state: DocumentVisibilityState = 'visible';
    const listeners: (() => void)[] = [];
    manager.installVisibility({
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      get visibilityState() {
        return state;
      },
    } as unknown as Document);
    state = 'hidden';
    listeners.forEach((fn) => fn());
    expect(player.suspended).toBe(1);
  });
});
