// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { costPerCup } from '../../src/core/accounting';
import { buySupplies, setPlan } from '../../src/core/actions';
import { newGame } from '../../src/core/game';
import { recipeSummary } from '../../src/ui/hud/recipeSummary';
import { testConfig, unwrap } from '../core/helpers';

const cfg = testConfig(); // default recipe 4 lemons, 4 sugar, 6 ice, 1 pitcher, 1,00 $

const plain = (s: string | null | undefined) => (s ?? '').replace(/\s/g, ' ');

describe('recipe summary', () => {
  it('matches the recipe screen: cost per cup at today’s prices and the margin', () => {
    const game = newGame(cfg, { seed: 1 });
    const s = recipeSummary(game, cfg);
    expect(s.recipe).toEqual({ lemons: 4, sugar: 4, ice: 6 });
    expect(s).toMatchObject({ pitchers: 1, servings: 8, pricePerCup: 100 });
    expect(s.costPerCup).toBeCloseTo(costPerCup(game.plan.recipe, game.prices, cfg), 9);
    expect(s.margin).toBeCloseTo(100 - s.costPerCup, 9);
  });

  it('lists what the plan still needs, including cups that would limit sales', () => {
    const game = newGame(cfg, { seed: 1 });
    expect(recipeSummary(game, cfg).shortages).toEqual([
      { supply: 'lemons', missing: 4 },
      { supply: 'sugar', missing: 4 },
      { supply: 'ice', missing: 6 },
      { supply: 'cups', missing: 8 },
    ]);
    const stocked = unwrap(buySupplies(game, cfg, { lemons: 1, sugar: 1, ice: 1, cups: 1 }));
    expect(recipeSummary(stocked, cfg).shortages).toEqual([]);
    const twoPitchers = unwrap(setPlan(stocked, cfg, { ...stocked.plan, pitchers: 2 }));
    expect(recipeSummary(twoPitchers, cfg).shortages).toEqual([{ supply: 'lemons', missing: 2 }]);
  });

  it('shows a loss when the price is below the cost', () => {
    const game = newGame(cfg, { seed: 1 });
    const cheap = unwrap(setPlan(game, cfg, { ...game.plan, pricePerCup: 10 }));
    expect(recipeSummary(cheap, cfg).margin).toBeLessThan(0);
  });
});

describe('recipe pane in the app', () => {
  beforeEach(() => localStorage.clear());

  function click(root: HTMLElement, text: string): void {
    const b = [...root.querySelectorAll('button')].find(
      (x) => plain(x.textContent).includes(text) || x.getAttribute('aria-label')?.includes(text),
    );
    if (!b) throw new Error(`button « ${text} » not found`);
    b.click();
  }

  it('stays visible next to the stock while planning and follows every change', () => {
    document.body.innerHTML = '<main id="ui"></main>';
    const root = document.getElementById('ui') as HTMLElement;
    new App(root, cfg, { configFingerprint: 'test' }).start();
    const pane = () => root.querySelector('.cote .recap');

    click(root, 'Nouvelle partie');
    click(root, "C'est parti");
    expect(root.querySelector('.cote .stock')).not.toBeNull();
    expect(plain(pane()?.textContent)).toContain('1 pichet = 8 verres');
    const missing = () => pane()?.querySelector('.recap__manques');
    expect(missing()?.getAttribute('aria-label')).toContain('Il manque 4 citrons');
    expect(plain(missing()?.textContent)).toBe('⚠️ Il manque : 4 🍋, 4 🍬, 6 🧊, 8 🥤');

    // In the shop, the recipe pane sits beside the shop, which has no recipe controls.
    click(root, 'Au magasin');
    expect(pane()).not.toBeNull();
    expect(root.querySelector('.panneau [aria-label^="Citrons : plus"]')).toBeNull();
    click(root, 'Citrons (paquets) : plus');
    click(root, 'Acheter');
    expect(missing()?.getAttribute('aria-label')).not.toContain('citrons');
    for (const s of ['Sucre', 'Glaçons', 'Gobelets']) click(root, `${s} (paquets) : plus`);
    click(root, 'Acheter');
    expect(pane()?.textContent).toContain('Tout est prêt');

    // The ✏️ button leads to the recipe screen, where changes show up immediately.
    click(root, 'Modifier la recette');
    expect(root.textContent).toContain('Ta recette');
    click(root, 'Nombre de pichets : plus');
    expect(plain(pane()?.textContent)).toContain('2 pichets = 16 verres');
    click(root, '1,50 $');
    expect(plain(pane()?.textContent)).toContain('1,50 $');
    expect(plain(pane()?.textContent)).toContain('Gain par verre');

    expect(missing()?.getAttribute('aria-label')).toBe('Il manque 2 citrons'); // 8 needed, 6 owned

    click(root, 'Nombre de pichets : moins');
    click(root, 'Ouvrir le stand');
    expect(pane()).toBeNull(); // the day shows the live stock only
    click(root, 'Passer');
    expect(pane()).not.toBeNull();
  });
});
