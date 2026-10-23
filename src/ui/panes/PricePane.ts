import { costPerCup } from '../../core/accounting';
import { openStand } from '../../core/actions';
import { checkPreparation } from '../../core/preparation';
import type { Cents } from '../../core/types';
import { money, signedMoney } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { button, stepper } from '../components';
import { h } from '../dom';
import type { ScreenContext } from '../screens/types';
import { pane, tutorialHint } from './common';
import { updatePlan } from './RecipePane';

const QUICK_PRICES = [50, 100, 150, 200];

export interface PriceOutlook {
  costPerCup: Cents;
  margin: Cents;
  /** Glasses the planned pitchers make. */
  glasses: number;
  /** What making those glasses costs at today's prices. */
  totalCost: Cents;
  /** Profit if every planned glass is sold. */
  expectedProfit: Cents;
}

export function priceOutlook(ctx: ScreenContext): PriceOutlook {
  const game = ctx.game();
  const cost = costPerCup(game.plan.recipe, game.prices, ctx.cfg);
  const glasses = game.plan.pitchers * ctx.cfg.recipe.servings_per_pitcher;
  const margin = game.plan.pricePerCup - cost;
  return {
    costPerCup: cost,
    margin,
    glasses,
    totalCost: cost * glasses,
    expectedProfit: margin * glasses,
  };
}

/** Selling price, what a cup costs, the profit to expect, and opening the stand. */
export function pricePane(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const p = ctx.cfg.recipe.selling_price_per_cup;
  const plan = game.plan;
  const check = checkPreparation(game.inventory, plan, ctx.cfg);
  const o = priceOutlook(ctx);
  const losing = o.margin < 0;

  const blocked = check.shortages.length > 0 || check.servings === 0;
  const blockReason =
    check.shortages.length > 0
      ? fr.recette.manque
      : check.servings === 0
        ? fr.erreurs.actions.AUCUN_PICHET
        : null;

  const row = (label: string, value: string, cls = '') =>
    h(
      'div',
      { class: `prix__ligne-info ${cls}` },
      h('span', null, label),
      h('strong', null, value),
    );

  return pane(
    'prix',
    fr.volets.prix,
    tutorialHint(ctx, 4, fr.tutoriel.prix),
    stepper({
      id: 'prix',
      label: fr.recette.prix,
      shortLabel: fr.recette.prixCourt,
      value: plan.pricePerCup,
      min: p.min,
      max: p.max,
      step: p.step,
      format: (c) => money(c),
      compact: true,
      onChange: (c) => updatePlan(ctx, { pricePerCup: c }),
    }),
    h(
      'div',
      { class: 'prix__rapides' },
      QUICK_PRICES.filter((c) => c >= p.min && c <= p.max && c % p.step === 0).map((c) =>
        button(money(c), () => updatePlan(ctx, { pricePerCup: c }), {
          variant: c === plan.pricePerCup ? 'primary' : 'secondary',
          focusKey: `prix-${c}`,
        }),
      ),
    ),
    h(
      'div',
      { class: 'prix__infos' },
      row(fr.recette.coutUnVerre, money(o.costPerCup)),
      row(
        losing ? fr.recette.perteParVerre : fr.recette.gainParVerre,
        signedMoney(o.margin),
        losing ? 'ton--mauvais' : 'ton--bon',
      ),
      row(fr.recette.coutTotal(o.glasses), money(o.totalCost)),
      row(
        fr.recette.beneficePrevu(o.glasses),
        signedMoney(o.expectedProfit),
        `prix__benefice ${o.expectedProfit < 0 ? 'ton--mauvais' : 'ton--bon'}`,
      ),
    ),
    h(
      'div',
      { class: 'prix__ouvrir' },
      blockReason ? h('p', { class: 'avertissement', role: 'status' }, blockReason) : null,
      button(
        fr.recette.ouvrir,
        () => {
          if (ctx.act((g) => openStand(g, ctx.cfg))) {
            ctx.events.emit('stand_open', { day: game.day });
          }
        },
        { large: true, disabled: blocked, focusKey: 'ouvrir' },
      ),
    ),
  );
}
