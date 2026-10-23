// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { buySupplies } from '../../src/core/actions';
import { newGame } from '../../src/core/game';
import { addUnits, closeInventory } from '../../src/core/inventory';
import type { GameState } from '../../src/core/types';
import { focusShiftX } from '../../src/scene/SceneDirector';
import { PITCHERS_FOR_FULL_BAR, stockGauges } from '../../src/ui/hud/stockGauges';
import { testConfig, unwrap } from '../core/helpers';

const cfg = testConfig(); // default recipe: 4 lemons, 4 sugar, 6 ice; 8 servings per pitcher

const gauge = (game: GameState, supply: string) => {
  const g = stockGauges(game, cfg).find((x) => x.supply === supply);
  if (!g) throw new Error(supply);
  return g;
};

describe('stock gauges', () => {
  it('fills the bar with enough for a typical day of the current recipe', () => {
    const game = unwrap(buySupplies(newGame(cfg, { seed: 1 }), cfg, { lemons: 1, cups: 1 }));
    expect(PITCHERS_FOR_FULL_BAR).toBe(3);
    expect(gauge(game, 'lemons')).toMatchObject({ count: 6, full: 12, fraction: 0.5, low: false });
    expect(gauge(game, 'cups')).toMatchObject({ count: 25, full: 24, fraction: 1, low: false });
  });

  it('warns when there is not enough for one pitcher', () => {
    const game = newGame(cfg, { seed: 1 });
    expect(gauge(game, 'lemons')).toMatchObject({ count: 0, fraction: 0, low: true });
    const threeLemons = { ...game, inventory: addUnits(game.inventory, 'lemons', 3, 150) };
    expect(gauge(threeLemons, 'lemons').low).toBe(true);
    const fourLemons = { ...game, inventory: addUnits(game.inventory, 'lemons', 4, 200) };
    expect(gauge(fourLemons, 'lemons').low).toBe(false);
  });

  it('never warns for an ingredient the recipe does not use, and still has a scale', () => {
    const game = newGame(cfg, { seed: 1 });
    const noIce: GameState = {
      ...game,
      plan: { ...game.plan, recipe: { ...game.plan.recipe, ice: 0 } },
    };
    expect(gauge(noIce, 'ice')).toMatchObject({
      low: false,
      full: cfg.supplies.ice.package_quantity,
    });
  });

  it('flags lemons that spoil tonight', () => {
    const game = newGame(cfg, { seed: 1 });
    let inventory = addUnits(game.inventory, 'lemons', 6, 300);
    inventory = closeInventory(inventory, cfg).inventory;
    inventory = closeInventory(inventory, cfg).inventory; // 2 days old: spoils at the 3rd closing
    expect(gauge({ ...game, inventory }, 'lemons').expiring).toBe(6);
  });
});

describe('3D view shift with the stock column', () => {
  it('centres the stand between the stock column and the right panel on wide screens', () => {
    expect(focusShiftX('magasin', 1280)).toBeCloseTo((672 - 238) / 1280, 6);
    expect(focusShiftX('historique', 1280)).toBeCloseTo(672 / 1280, 6); // no stock column there
    expect(focusShiftX('magasin', 1024)).toBeCloseTo(672 / 1024, 6); // stock is a strip on top
    expect(focusShiftX('magasin', 800)).toBe(0);
    expect(focusShiftX('journee', 1280)).toBe(0);
  });
});

describe('stock panel in the app', () => {
  beforeEach(() => localStorage.clear());

  function click(root: HTMLElement, text: string): void {
    const b = [...root.querySelectorAll('button')].find(
      (x) => x.textContent?.includes(text) || x.getAttribute('aria-label')?.includes(text),
    );
    if (!b) throw new Error(`button « ${text} » not found`);
    b.click();
  }

  const stockLine = (root: HTMLElement, supply: string) =>
    root.querySelector<HTMLElement>(`.stock [data-supply="${supply}"]`);

  it('shows the stock on the left during planning and the report, updated after buying', () => {
    document.body.innerHTML = '<main id="ui"></main>';
    const root = document.getElementById('ui') as HTMLElement;
    const app = new App(root, cfg, { configFingerprint: 'test' });
    app.start();

    click(root, 'Nouvelle partie');
    click(root, "C'est parti");
    expect(root.querySelector('.stock')).not.toBeNull();
    expect(root.querySelector('.barre__stock')).toBeNull(); // no longer in the top bar
    expect(stockLine(root, 'lemons')?.textContent).toContain('Pas assez pour 1 pichet');

    click(root, 'Au magasin');
    click(root, 'Citrons (paquets) : plus');
    click(root, 'Acheter');
    const lemons = stockLine(root, 'lemons');
    expect(lemons?.querySelector('.stock__nombre')?.textContent).toBe('6');
    expect(lemons?.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')).toBe('6');
    expect(lemons?.textContent).not.toContain('Pas assez');

    for (const s of ['Sucre', 'Glaçons', 'Gobelets']) click(root, `${s} (paquets) : plus`);
    click(root, 'Acheter');
    click(root, 'Ma recette');
    expect(root.querySelector('.stock')).not.toBeNull();
    click(root, 'Ouvrir le stand');

    // During the day the stock is live: each sale takes a cup and a glass of lemonade.
    const number = (supply: string) =>
      stockLine(root, supply)?.querySelector('.stock__nombre')?.textContent;
    expect(root.querySelector('.ecran--journee .stock')).not.toBeNull();
    expect(number('lemonade')).toBe('8'); // 1 pitcher × 8 servings
    expect(number('cups')).toBe('25');
    expect(number('lemons')).toBe('2'); // 4 used for the pitcher
    const sale = () =>
      app.events.emit('day_event', {
        event: { t: 0.1, type: 'visitor', id: 0, outcome: 'buy' },
      });
    sale();
    sale();
    expect(number('lemonade')).toBe('6');
    expect(number('cups')).toBe('23');
    app.events.emit('day_event', {
      event: { t: 0.2, type: 'visitor', id: 1, outcome: 'decline', reason: 'TROP_CHER' },
    });
    expect(number('cups')).toBe('23'); // no sale, no change
    for (let i = 0; i < 6; i++) sale();
    expect(number('lemonade')).toBe('0');
    expect(stockLine(root, 'lemonade')?.textContent).toContain('Plus de limonade');

    click(root, 'Passer');
    expect(root.querySelector('.stock')).not.toBeNull();
    expect(stockLine(root, 'ice')?.querySelector('.stock__nombre')?.textContent).toBe('0'); // melted
  });
});
