import type { GameConfig } from '../src/config/schema';
import { buySupplies, cartCost, finishDay, nextDay, openStand, setPlan } from '../src/core/actions';
import type { Cart } from '../src/core/actions';
import { costPerCup } from '../src/core/accounting';
import { buyProbability, expectedDailyVisitors, purchaseTerms } from '../src/core/demand';
import { newGame } from '../src/core/game';
import { count } from '../src/core/inventory';
import { maxPitchers } from '../src/core/preparation';
import { idealIce, tasteRecipe } from '../src/core/recipe';
import { createRng, int, type Rng } from '../src/core/rng';
import type { Cents, DayPlan, GameState, Prices, Recipe, SupplyId } from '../src/core/types';
import { SUPPLIES } from '../src/core/types';

/** What a strategy wants to do today, before checking stock and cash. */
export interface Intent {
  recipe: Recipe;
  pitchers: number;
  pricePerCup: Cents;
}

export interface Strategy {
  name: string;
  description: string;
  decide(state: GameState, cfg: GameConfig, rng: Rng): Intent;
}

function roundToStep(price: number, cfg: GameConfig): Cents {
  const p = cfg.recipe.selling_price_per_cup;
  const stepped = Math.round(price / p.step) * p.step;
  return Math.min(p.max, Math.max(p.min, stepped));
}

function defaultRecipe(cfg: GameConfig): Recipe {
  const r = cfg.recipe;
  return {
    lemons: r.lemons_per_pitcher.default,
    sugar: r.sugar_per_pitcher.default,
    ice: r.ice_per_pitcher.default,
  };
}

/**
 * The best recipe, price and stand size for a temperature and expected visitors.
 * The "expert" bots know the taste and demand model, so they show what good
 * play can earn; a child gets there by reading the feedback.
 */
function expertIntent(
  temperatureC: number,
  visitors: number,
  prices: Prices,
  cfg: GameConfig,
): Intent {
  const t = cfg.taste;
  const lemons = Math.round(t.ideal_lemons_per_pitcher);
  const recipe: Recipe = {
    lemons,
    sugar: Math.round(lemons * t.ideal_sugar_per_lemon),
    ice: Math.round(idealIce(temperatureC, t)),
  };
  const quality = tasteRecipe(recipe, temperatureC, t).quality;
  const unitCost = costPerCup(recipe, prices, cfg);

  // Price with the best expected profit per visitor.
  const p = cfg.recipe.selling_price_per_cup;
  let best = { price: p.default, profit: -Infinity, buyRate: 0 };
  for (let price = p.min; price <= p.max; price += p.step) {
    const buyRate = buyProbability(purchaseTerms(quality, temperatureC, price, cfg.demand), 0);
    const profit = buyRate * (price - unitCost);
    if (profit > best.profit) best = { price, profit, buyRate };
  }

  const pitchers = Math.max(
    1,
    Math.round((visitors * best.buyRate) / cfg.recipe.servings_per_pitcher),
  );
  return { recipe, pitchers, pricePerCup: best.price };
}

export const STRATEGIES: Strategy[] = [
  {
    name: 'prudent',
    description: 'recette et prix par défaut, toujours 2 pichets',
    decide: (_s, cfg) => ({
      recipe: defaultRecipe(cfg),
      pitchers: 2,
      pricePerCup: cfg.recipe.selling_price_per_cup.default,
    }),
  },
  {
    name: 'gourmand',
    description: 'prix élevé (2 $) et 6 pichets chaque jour',
    decide: (_s, cfg) => ({
      recipe: defaultRecipe(cfg),
      pitchers: 6,
      pricePerCup: roundToStep(200, cfg),
    }),
  },
  {
    name: 'aleatoire',
    description: 'recette, prix et pichets au hasard',
    decide: (_s, cfg, rng) => {
      const r = cfg.recipe;
      const range = (x: { min: number; max: number }) => int(rng, x.min, x.max);
      const p = r.selling_price_per_cup;
      return {
        recipe: {
          lemons: range(r.lemons_per_pitcher),
          sugar: range(r.sugar_per_pitcher),
          ice: range(r.ice_per_pitcher),
        },
        pitchers: int(rng, 1, 6),
        pricePerCup: roundToStep(int(rng, p.min, Math.round(p.max / 2)), cfg),
      };
    },
  },
  {
    name: 'sans-meteo',
    description: 'bonne recette mais ignore la météo (pense toujours à un jour moyen)',
    decide: (s, cfg) => {
      const mean = cfg.weather.temperature_c.mean;
      const visitors = expectedDailyVisitors(
        mean,
        'nuageux',
        0.2,
        cfg.weather.rain_max_slots,
        cfg.demand,
      );
      return expertIntent(mean, visitors, s.prices, cfg);
    },
  },
  {
    name: 'malin',
    description: 'bonne recette, suit la prévision pour la glace, le prix et la quantité',
    decide: (s, cfg) => {
      const f = s.forecast;
      const visitors = expectedDailyVisitors(
        f.temperatureC,
        f.cloud,
        f.rainChance,
        cfg.weather.rain_max_slots,
        cfg.demand,
      );
      return expertIntent(f.temperatureC, visitors, s.prices, cfg);
    },
  },
];

/** Packages to buy so the stock covers `pitchers` pitchers and their cups. */
function cartFor(state: GameState, cfg: GameConfig, intent: Intent, pitchers: number): Cart {
  const servings = pitchers * cfg.recipe.servings_per_pitcher;
  const needs: Record<SupplyId, number> = {
    lemons: intent.recipe.lemons * pitchers,
    sugar: intent.recipe.sugar * pitchers,
    ice: intent.recipe.ice * pitchers,
    cups: servings,
  };
  const cart: Cart = {};
  for (const supply of SUPPLIES) {
    const missing = needs[supply] - count(state.inventory, supply);
    cart[supply] = Math.max(0, Math.ceil(missing / cfg.supplies[supply].package_quantity));
  }
  return cart;
}

/** Plays one planning phase: buy what is affordable for the intent, then open. */
function playDay(
  state: GameState,
  cfg: GameConfig,
  strategy: Strategy,
  rng: Rng,
): GameState | null {
  const intent = strategy.decide(state, cfg, rng);
  const attempts: Intent[] = [
    intent,
    // Fallback when the intent is unaffordable: the cheapest valid recipe.
    {
      recipe: {
        lemons: cfg.recipe.lemons_per_pitcher.min,
        sugar: cfg.recipe.sugar_per_pitcher.min,
        ice: cfg.recipe.ice_per_pitcher.min,
      },
      pitchers: 1,
      pricePerCup: intent.pricePerCup,
    },
  ];

  for (const attempt of attempts) {
    let pitchers = Math.min(attempt.pitchers, cfg.recipe.max_pitchers_per_day);
    let cart = cartFor(state, cfg, attempt, pitchers);
    while (pitchers > 1 && cartCost(state, cart) > state.cash) {
      pitchers--;
      cart = cartFor(state, cfg, attempt, pitchers);
    }
    const bought = buySupplies(state, cfg, cart);
    const afterBuy = bought.ok ? bought.state : state;
    const possible = Math.min(pitchers, maxPitchers(afterBuy.inventory, attempt.recipe, cfg));
    const plan: DayPlan = {
      recipe: attempt.recipe,
      pitchers: possible,
      pricePerCup: attempt.pricePerCup,
    };
    const planned = setPlan(afterBuy, cfg, plan);
    if (!planned.ok) continue;
    const opened = openStand(planned.state, cfg);
    if (!opened.ok) {
      state = afterBuy;
      continue;
    }
    const report = finishDay(opened.state);
    if (!report.ok) return null;
    const next = nextDay(report.state, cfg);
    return next.ok ? next.state : null;
  }
  return null;
}

/** Plays a whole game. Returns the final state, or the state where the bot got stuck. */
export function playGame(
  cfg: GameConfig,
  strategy: Strategy,
  seed: number,
  days: number,
): { state: GameState; stuck: boolean } {
  const rng = createRng(seed ^ 0x5bd1e995);
  let state = newGame(cfg, { seed, days });
  while (state.phase !== 'FIN') {
    const next = playDay(state, cfg, strategy, rng);
    if (!next) return { state, stuck: true };
    state = next;
  }
  return { state, stuck: false };
}
