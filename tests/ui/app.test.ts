// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { testConfig } from '../core/helpers';

const cfg = testConfig();

function buttons(root: HTMLElement): HTMLButtonElement[] {
  return [...root.querySelectorAll('button')];
}

function findButton(root: HTMLElement, text: string): HTMLButtonElement {
  const found = buttons(root).find(
    (b) => b.textContent?.includes(text) || b.getAttribute('aria-label')?.includes(text),
  );
  if (!found) throw new Error(`button « ${text} » not found in:\n${root.textContent}`);
  return found;
}

function click(root: HTMLElement, text: string, times = 1): void {
  for (let i = 0; i < times; i++) findButton(root, text).click();
}

describe('App (full flow in French)', () => {
  let root: HTMLElement;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<main id="ui"></main>';
    root = document.getElementById('ui') as HTMLElement;
    app = new App(root, cfg);
    app.start();
  });

  it('starts on the home screen and picks a game length', () => {
    expect(root.textContent).toContain('Ma Super Limonade !');
    click(root, 'Nouvelle partie');
    expect(root.textContent).toContain("Combien de jours d'été ?");
    click(root, '30 jours');
    click(root, "C'est parti");
    expect(app.store.get().game?.totalDays).toBe(30);
    expect(root.textContent).toContain('La météo de demain');
    expect(root.textContent).toContain('Jour 1 / 30');
  });

  it('plays a whole day: shop, recipe, open, skip, report, next day', () => {
    click(root, 'Nouvelle partie');
    click(root, "C'est parti");
    click(root, 'Au magasin');
    expect(root.textContent).toContain('Le magasin');

    // Nothing in the cart yet: buying is disabled.
    expect(findButton(root, 'Acheter').disabled).toBe(true);

    click(root, 'Citrons (paquets) : plus');
    click(root, 'Sucre (paquets) : plus');
    click(root, 'Glaçons (paquets) : plus');
    click(root, 'Gobelets (paquets) : plus');
    const cashBefore = app.store.get().game?.cash ?? 0;
    click(root, 'Acheter');
    const game = app.store.get().game;
    expect(game?.cash).toBeLessThan(cashBefore);
    expect(root.textContent).toContain('Achat réussi');
    expect(root.querySelector('.stock [data-supply="lemons"] .stock__nombre')?.textContent).toBe(
      '6',
    );

    click(root, 'Ma recette');
    expect(root.textContent).toContain('Ta recette');
    expect(root.textContent).toContain('Un verre te coûte environ');
    click(root, 'Ouvrir le stand');
    expect(app.store.get().game?.phase).toBe('JOURNEE');
    expect(root.textContent).toContain('Verres vendus');

    click(root, 'Passer');
    expect(app.store.get().game?.phase).toBe('BILAN');
    expect(root.textContent).toContain('Bénéfice du jour');
    expect(root.textContent).toContain('Variation de caisse');
    expect(root.textContent).toContain('Prévu');

    click(root, 'Historique');
    expect(root.textContent).toContain('Ta caisse');
    click(root, 'Retour au jeu');
    expect(root.textContent).toContain('Bénéfice du jour');

    click(root, 'Jour suivant');
    expect(app.store.get().game?.day).toBe(2);
    expect(root.textContent).toContain('Jour 2 / 14');
  });

  it('prevents buying more than the cash allows', () => {
    click(root, 'Nouvelle partie');
    click(root, "C'est parti");
    click(root, 'Au magasin');
    const plus = () => findButton(root, 'Citrons (paquets) : plus');
    let guard = 0;
    while (!plus().disabled && guard++ < 50) plus().click();
    const game = app.store.get().game;
    const lemonsCost = (app.store.get().cart.lemons ?? 0) * (game?.prices.lemons ?? 0);
    expect(lemonsCost).toBeLessThanOrEqual(game?.cash ?? 0);
    expect(findButton(root, 'Acheter').disabled).toBe(false);
  });

  it('refuses to open without ingredients and explains why', () => {
    click(root, 'Nouvelle partie');
    click(root, "C'est parti");
    click(root, 'Au magasin');
    click(root, 'Ma recette');
    expect(findButton(root, 'Ouvrir le stand').disabled).toBe(true);
    expect(root.textContent).toContain('Il en manque');
  });

  it('keeps keyboard focus on a stepper button after it re-renders', () => {
    click(root, 'Nouvelle partie');
    click(root, "C'est parti");
    click(root, 'Au magasin');
    const plus = findButton(root, 'Sucre (paquets) : plus');
    plus.focus();
    plus.click();
    expect((document.activeElement as HTMLElement | null)?.dataset['focus']).toBe(
      'achat-sugar-plus',
    );
  });
});
