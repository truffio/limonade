import { setPlan } from '../../core/actions';
import { checkPreparation, type Ingredient } from '../../core/preparation';
import type { DayPlan } from '../../core/types';
import { fr } from '../../i18n/fr';
import { stepper } from '../components';
import { pitcherPreview } from '../components/pitcher';
import { h } from '../dom';
import type { ScreenContext } from '../screens/types';
import { pane, tutorialHint } from './common';

const INGREDIENTS: Record<Ingredient, { label: string; short: string; icon: string }> = {
  lemons: {
    label: fr.recette.citrons,
    short: fr.fournitures.lemons.nom,
    icon: fr.fournitures.lemons.icone,
  },
  sugar: {
    label: fr.recette.sucre,
    short: fr.fournitures.sugar.nom,
    icon: fr.fournitures.sugar.icone,
  },
  ice: { label: fr.recette.glacons, short: fr.fournitures.ice.nom, icon: fr.fournitures.ice.icone },
};

export function updatePlan(ctx: ScreenContext, patch: Partial<DayPlan>): void {
  ctx.act((g) => setPlan(g, ctx.cfg, { ...g.plan, ...patch }));
}

/** Recipe per pitcher and number of pitchers, first pane of the bottom row. */
export function recipePane(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const r = ctx.cfg.recipe;
  const plan = game.plan;
  const check = checkPreparation(game.inventory, plan, ctx.cfg);
  const ranges: Record<Ingredient, { min: number; max: number }> = {
    lemons: r.lemons_per_pitcher,
    sugar: r.sugar_per_pitcher,
    ice: r.ice_per_pitcher,
  };
  const ingredients = Object.keys(INGREDIENTS) as Ingredient[];

  // « Il te faut : 8 🍋✅ 8 🍬✅ 12 🧊❌ 16 🥤✅ », the needs of the planned pitchers.
  const item = (label: string, icon: string, need: number, have: number) => {
    const short = need > have;
    return h(
      'span',
      {
        class: short ? 'manque' : '',
        'aria-label': `${label} : ${need} (${fr.recette.tuAs} ${have})`,
      },
      `${need} ${icon}${short ? '❌' : '✅'}`,
    );
  };
  const needs = h(
    'p',
    { class: 'recette__besoins' },
    h('span', null, fr.recette.besoinCourt),
    ingredients.map((i) =>
      item(INGREDIENTS[i].label, INGREDIENTS[i].icon, check.needs[i], check.available[i]),
    ),
    item(fr.fournitures.cups.nom, fr.fournitures.cups.icone, check.servings, check.cupsAvailable),
  );

  return pane(
    'recette',
    {
      text: fr.volets.recette,
      extra: h(
        'div',
        { class: 'recette__pichet' },
        pitcherPreview(plan.recipe, r.lemons_per_pitcher.max, r.ice_per_pitcher.max),
      ),
    },
    tutorialHint(ctx, 3, fr.tutoriel.recette),
    h(
      'div',
      { class: 'recette__reglages' },
      ingredients.map((i) =>
        stepper({
          id: `recette-${i}`,
          label: INGREDIENTS[i].label,
          shortLabel: INGREDIENTS[i].short,
          icon: INGREDIENTS[i].icon,
          value: plan.recipe[i],
          min: ranges[i].min,
          max: ranges[i].max,
          compact: true,
          onChange: (n) => updatePlan(ctx, { recipe: { ...plan.recipe, [i]: n } }),
        }),
      ),
      stepper({
        id: 'pichets',
        label: fr.recette.pichets,
        shortLabel: fr.recette.pichetsCourt,
        icon: '🫗',
        value: plan.pitchers,
        min: 0,
        max: r.max_pitchers_per_day,
        hint: `${fr.recette.verresParPichet(r.servings_per_pitcher)} · max ${check.maxPitchers}`,
        compact: true,
        onChange: (n) => updatePlan(ctx, { pitchers: n }),
      }),
    ),
    needs,
  );
}
