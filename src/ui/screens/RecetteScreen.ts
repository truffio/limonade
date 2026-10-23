import { costPerCup } from '../../core/accounting';
import { openStand, setPlan } from '../../core/actions';
import { checkPreparation, type Ingredient } from '../../core/preparation';
import type { DayPlan } from '../../core/types';
import { money } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { actions, button, mascot, screenTitle, stepper, tutorialTip } from '../components';
import { pitcherPreview } from '../components/pitcher';
import { h } from '../dom';
import type { Screen } from './types';

const QUICK_PRICES = [50, 100, 150, 200];

const INGREDIENT_LABELS: Record<Ingredient, { label: string; icon: string }> = {
  lemons: { label: fr.recette.citrons, icon: fr.fournitures.lemons.icone },
  sugar: { label: fr.recette.sucre, icon: fr.fournitures.sugar.icone },
  ice: { label: fr.recette.glacons, icon: fr.fournitures.ice.icone },
};

export const RecetteScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    const cfg = ctx.cfg;
    const r = cfg.recipe;
    const plan = game.plan;
    const check = checkPreparation(game.inventory, plan, cfg);
    const cost = costPerCup(plan.recipe, game.prices, cfg);
    const margin = plan.pricePerCup - cost;

    const update = (patch: Partial<DayPlan>) => {
      ctx.act((g) => setPlan(g, cfg, { ...g.plan, ...patch }));
    };
    const ranges: Record<Ingredient, { min: number; max: number }> = {
      lemons: r.lemons_per_pitcher,
      sugar: r.sugar_per_pitcher,
      ice: r.ice_per_pitcher,
    };

    const ingredientSteppers = (Object.keys(INGREDIENT_LABELS) as Ingredient[]).map((ingredient) =>
      stepper({
        id: `recette-${ingredient}`,
        label: INGREDIENT_LABELS[ingredient].label,
        icon: INGREDIENT_LABELS[ingredient].icon,
        value: plan.recipe[ingredient],
        min: ranges[ingredient].min,
        max: ranges[ingredient].max,
        onChange: (n) => update({ recipe: { ...plan.recipe, [ingredient]: n } }),
      }),
    );

    const checklist = h(
      'table',
      { class: 'liste-courses' },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          h('th', null, ''),
          h('th', null, fr.recette.besoin),
          h('th', null, fr.recette.tuAs),
        ),
      ),
      h(
        'tbody',
        null,
        (Object.keys(INGREDIENT_LABELS) as Ingredient[]).map((ingredient) => {
          const short = check.shortages.includes(ingredient);
          return h(
            'tr',
            { class: short ? 'manque' : '' },
            h(
              'th',
              { scope: 'row' },
              `${INGREDIENT_LABELS[ingredient].icon} ${fr.fournitures[ingredient].nom}`,
            ),
            h('td', null, String(check.needs[ingredient])),
            h('td', null, `${check.available[ingredient]} ${short ? '❌' : '✅'}`),
          );
        }),
      ),
    );

    const blocked = check.shortages.length > 0 || check.servings === 0;
    const blockReason =
      check.shortages.length > 0
        ? fr.recette.manque
        : check.servings === 0
          ? fr.erreurs.actions.AUCUN_PICHET
          : null;

    const p = r.selling_price_per_cup;
    return h(
      'section',
      { class: 'panneau' },
      screenTitle(fr.ecrans.recette),
      tutorialTip(ctx, 3, fr.tutoriel.recette),
      h(
        'div',
        { class: 'recette' },
        h(
          'div',
          { class: 'recette__pichet' },
          pitcherPreview(plan.recipe, r.lemons_per_pitcher.max, r.ice_per_pitcher.max),
        ),
        h(
          'div',
          { class: 'recette__ingredients' },
          h('h2', null, fr.recette.parPichet),
          ingredientSteppers,
        ),
      ),
      stepper({
        id: 'pichets',
        label: fr.recette.pichets,
        icon: '🫗',
        value: plan.pitchers,
        min: 0,
        max: r.max_pitchers_per_day,
        hint: h(
          'span',
          null,
          fr.recette.verresParPichet(r.servings_per_pitcher),
          ' · ',
          fr.recette.pichetsMax(check.maxPitchers),
        ),
        onChange: (n) => update({ pitchers: n }),
      }),
      checklist,
      h('p', { class: 'recette__verres' }, fr.recette.verresPrets(check.servings)),
      check.cupsLimitSales
        ? h('p', { class: 'avertissement' }, fr.recette.gobeletsLimite(check.cupsAvailable))
        : null,
      h(
        'div',
        { class: 'prix' },
        stepper({
          id: 'prix',
          label: fr.recette.prix,
          icon: '🏷️',
          value: plan.pricePerCup,
          min: p.min,
          max: p.max,
          step: p.step,
          format: (c) => money(c),
          onChange: (c) => update({ pricePerCup: c }),
        }),
        h(
          'div',
          { class: 'prix__rapides' },
          QUICK_PRICES.filter((c) => c >= p.min && c <= p.max && c % p.step === 0).map((c) =>
            button(money(c), () => update({ pricePerCup: c }), {
              variant: c === plan.pricePerCup ? 'primary' : 'secondary',
              focusKey: `prix-${c}`,
            }),
          ),
        ),
        h('p', null, fr.recette.coutVerre(money(cost))),
        h(
          'p',
          { class: margin >= 0 ? 'ton--bon' : 'ton--mauvais' },
          margin >= 0 ? fr.recette.gainVerre(money(margin)) : fr.recette.perteVerre(money(-margin)),
        ),
      ),
      mascot(fr.recette.conseil),
      blockReason ? h('p', { class: 'avertissement', role: 'status' }, blockReason) : null,
      actions(
        button(fr.recette.retourMagasin, () => ctx.goTo('magasin'), {
          variant: 'secondary',
          focusKey: 'vers-magasin',
        }),
        button(
          fr.recette.ouvrir,
          () => {
            if (ctx.act((g) => openStand(g, cfg))) ctx.events.emit('stand_open', { day: game.day });
          },
          { large: true, disabled: blocked, focusKey: 'ouvrir' },
        ),
      ),
    );
  },
};
