// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import {
  clearSave,
  fingerprint,
  loadGame,
  loadPreferences,
  saveGame,
  savePreferences,
} from '../../src/app/persistence';
import { newGame } from '../../src/core/game';
import { testConfig } from '../core/helpers';

const cfg = testConfig();

function findButton(root: HTMLElement, text: string): HTMLButtonElement {
  const found = [...root.querySelectorAll('button')].find(
    (b) => b.textContent?.includes(text) || b.getAttribute('aria-label')?.includes(text),
  );
  if (!found) throw new Error(`button « ${text} » not found in:\n${root.textContent}`);
  return found;
}

beforeEach(() => {
  localStorage.clear();
});

describe('save file', () => {
  it('round-trips a game', () => {
    const game = newGame(cfg, { seed: 5 });
    saveGame(game, 'abc');
    expect(loadGame('abc')).toEqual(game);
  });

  it('ignores saves from another config, another version or a finished game', () => {
    const game = newGame(cfg, { seed: 5 });
    saveGame(game, 'abc');
    expect(loadGame('other')).toBeNull();

    saveGame({ ...game, phase: 'FIN' }, 'abc');
    expect(loadGame('abc')).toBeNull();

    localStorage.setItem(
      'limonade.save.v1',
      JSON.stringify({ version: 99, configFingerprint: 'abc', game }),
    );
    expect(loadGame('abc')).toBeNull();
  });

  it('survives corrupted or missing data', () => {
    localStorage.setItem('limonade.save.v1', '{not json');
    expect(loadGame('abc')).toBeNull();
    localStorage.setItem(
      'limonade.save.v1',
      JSON.stringify({ version: 1, configFingerprint: 'abc', game: { day: 'x' } }),
    );
    expect(loadGame('abc')).toBeNull();
    clearSave();
    expect(loadGame('abc')).toBeNull();
  });

  it('keeps playing when storage throws (private mode, full disk)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveGame(newGame(cfg, { seed: 1 }), 'abc')).not.toThrow();
    expect(() =>
      savePreferences({ conseils: false, son: true, musique: false, volume: 3 }),
    ).not.toThrow();
    spy.mockRestore();
  });

  it('remembers preferences, with tips on by default', () => {
    expect(loadPreferences()).toEqual({ conseils: true, son: true, musique: false, volume: 3 });
    savePreferences({ conseils: false, son: false, musique: true, volume: 5 });
    expect(loadPreferences()).toEqual({ conseils: false, son: false, musique: true, volume: 5 });
    localStorage.setItem('limonade.preferences.v1', JSON.stringify({ volume: 99, son: 'oui' }));
    expect(loadPreferences()).toEqual({ conseils: true, son: true, musique: false, volume: 3 });
  });

  it('fingerprints configs stably', () => {
    expect(fingerprint({ a: 1 })).toBe(fingerprint({ a: 1 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
});

describe('App: continue a saved game', () => {
  function start(): { root: HTMLElement; app: App } {
    document.body.innerHTML = '<main id="ui"></main>';
    const root = document.getElementById('ui') as HTMLElement;
    const app = new App(root, cfg, { configFingerprint: 'test' });
    app.start();
    return { root, app };
  }

  it('saves automatically and offers to continue after going home', () => {
    const { root, app } = start();
    findButton(root, 'Nouvelle partie').click();
    findButton(root, "C'est parti").click();
    findButton(root, 'Citrons (paquets) : plus').click();
    findButton(root, 'Acheter').click();
    const cash = app.store.get().game?.cash;

    findButton(root, 'Retour à l’accueil').click();
    expect(app.store.get().game).toBeNull();
    expect(root.textContent).toContain('Continuer la partie (jour 1 / 14)');

    // A fresh page load finds the save too.
    const reloaded = start();
    findButton(reloaded.root, 'Continuer la partie').click();
    expect(reloaded.app.store.get().game?.cash).toBe(cash);
    expect(reloaded.root.textContent).toContain('Le magasin');
  });

  it('resumes a day interrupted during the replay on its report', () => {
    const { root, app } = start();
    findButton(root, 'Nouvelle partie').click();
    findButton(root, "C'est parti").click();
    for (const s of ['Citrons', 'Sucre', 'Glaçons', 'Gobelets']) {
      findButton(root, `${s} (paquets) : plus`).click();
    }
    findButton(root, 'Acheter').click();
    findButton(root, 'Ouvrir le stand').click();
    expect(app.store.get().game?.phase).toBe('JOURNEE');

    const reloaded = start();
    findButton(reloaded.root, 'Continuer la partie').click();
    expect(reloaded.app.store.get().game?.phase).toBe('BILAN');
    expect(reloaded.root.textContent).toContain('Bénéfice du jour');
  });
});

describe('App: first-day tutorial', () => {
  it('shows numbered tips on day 1 and can be turned off', () => {
    document.body.innerHTML = '<main id="ui"></main>';
    const root = document.getElementById('ui') as HTMLElement;
    const app = new App(root, cfg, { configFingerprint: 'test' });
    app.start();

    findButton(root, 'Nouvelle partie').click();
    findButton(root, "C'est parti").click();
    // Each pane of the dashboard carries its step on day 1.
    for (const n of [1, 2, 3, 4]) expect(root.textContent).toContain(`Étape ${n} sur 5`);
    expect(root.textContent).toContain('Pour 2 pichets : 8 🍋');

    findButton(root, 'Retour à l’accueil').click();
    findButton(root, 'Conseils de Citronnelle : oui').click();
    expect(root.textContent).toContain('Conseils de Citronnelle : non');
    expect(loadPreferences().conseils).toBe(false);

    findButton(root, 'Continuer la partie').click();
    expect(root.textContent).not.toContain('Étape 2 sur 5');
  });
});
