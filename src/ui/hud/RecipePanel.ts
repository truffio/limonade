import { money, signedMoney } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { button } from '../components';
import { h } from '../dom';
import type { ScreenContext, ScreenId } from '../screens/types';
import { recipeSummary } from './recipeSummary';

/** Screens with the always-visible recipe pane next to the stock (#50). */
export const RECIPE_SCREENS: ReadonlySet<ScreenId> = new Set([
  'meteo',
  'magasin',
  'recette',
  'bilan',
]);

/**
 * Read-only summary of the plan: recipe per pitcher, pitchers and glasses,
 * price, what a cup costs to make and the margin, and what is still missing.
 * Editing stays on « Ta recette ».
 */
export function renderRecipePanel(ctx: ScreenContext): HTMLElement {
  const s = recipeSummary(ctx.game(), ctx.cfg);
  const t = fr.hud.recette;
  const f = fr.fournitures;
  const losing = s.margin < 0;

  const row = (label: string, value: string, cls = '') =>
    h('div', { class: `recap__ligne ${cls}` }, h('span', null, label), h('strong', null, value));

  return h(
    'aside',
    { class: 'recap carte-cote', 'aria-labelledby': 'recap-titre' },
    h(
      'div',
      { class: 'recap__entete' },
      h('h2', { class: 'recap__titre', id: 'recap-titre' }, `📝 ${t.titre}`),
      ctx.state.screen === 'recette'
        ? null
        : button('✏️', () => ctx.goTo('recette'), {
            variant: 'ghost',
            label: t.modifier,
            focusKey: 'recap-modifier',
          }),
    ),
    h(
      'div',
      { class: 'recap__lignes' },
      h(
        'div',
        { class: 'recap__ligne recap__recette', 'aria-label': t.parPichetLong(s.recipe) },
        h(
          'strong',
          { 'aria-hidden': 'true' },
          `${f.lemons.icone} ${s.recipe.lemons}  ${f.sugar.icone} ${s.recipe.sugar}  ${f.ice.icone} ${s.recipe.ice}`,
        ),
        h('small', { 'aria-hidden': 'true' }, t.parPichet),
      ),
      row('🫗', t.pichets(s.pitchers, s.servings)),
      row(t.prix, money(s.pricePerCup)),
      row(t.cout, money(s.costPerCup)),
      row(
        losing ? t.perte : t.gain,
        signedMoney(s.margin),
        losing ? 'ton--mauvais recap__marge' : 'ton--bon recap__marge',
      ),
    ),
    s.shortages.length === 0
      ? h('p', { class: 'recap__manques ton--bon' }, t.pret)
      : h(
          'p',
          {
            class: 'recap__manques avertissement',
            'aria-label': s.shortages.map((x) => t.manque(x.supply, x.missing)).join(', '),
          },
          `${t.manqueTitre} `,
          s.shortages.map((x) => `${x.missing} ${f[x.supply].icone}`).join(', '),
        ),
  );
}
