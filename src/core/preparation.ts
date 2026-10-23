import type { GameConfig } from '../config/schema';
import { count } from './inventory';
import type { ActionError, DayPlan, Inventory, InventoryCounts, Recipe } from './types';

export type Ingredient = keyof Recipe;
const INGREDIENTS: readonly Ingredient[] = ['lemons', 'sugar', 'ice'];

export function ingredientNeeds(plan: DayPlan): Recipe {
  return {
    lemons: plan.recipe.lemons * plan.pitchers,
    sugar: plan.recipe.sugar * plan.pitchers,
    ice: plan.recipe.ice * plan.pitchers,
  };
}

/** Most pitchers the stock allows with this recipe, capped by the daily limit. */
export function maxPitchers(inventory: Inventory, recipe: Recipe, cfg: GameConfig): number {
  let max = cfg.recipe.max_pitchers_per_day;
  for (const ingredient of INGREDIENTS) {
    const perPitcher = recipe[ingredient];
    if (perPitcher > 0) max = Math.min(max, Math.floor(count(inventory, ingredient) / perPitcher));
  }
  return max;
}

export interface PreparationCheck {
  needs: Recipe;
  available: InventoryCounts;
  shortages: Ingredient[];
  /** Servings from today's pitchers plus any lemonade kept from yesterday. */
  servings: number;
  cupsAvailable: number;
  /** Cups that can actually be sold: limited by servings and by cups (spec §5). */
  sellableCups: number;
  cupsLimitSales: boolean;
  maxPitchers: number;
}

/** Everything the recipe screen shows before the stand opens (spec §5 "Preparation"). */
export function checkPreparation(
  inventory: Inventory,
  plan: DayPlan,
  cfg: GameConfig,
): PreparationCheck {
  const needs = ingredientNeeds(plan);
  const available: InventoryCounts = {
    lemons: count(inventory, 'lemons'),
    sugar: count(inventory, 'sugar'),
    ice: count(inventory, 'ice'),
    cups: count(inventory, 'cups'),
  };
  const shortages = INGREDIENTS.filter((i) => needs[i] > available[i]);
  const servings = plan.pitchers * cfg.recipe.servings_per_pitcher + count(inventory, 'lemonade');
  return {
    needs,
    available,
    shortages,
    servings,
    cupsAvailable: available.cups,
    sellableCups: Math.min(servings, available.cups),
    cupsLimitSales: available.cups < servings,
    maxPitchers: maxPitchers(inventory, plan.recipe, cfg),
  };
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

/** Checks a plan against the configured limits. Stock is checked separately when opening. */
export function validatePlan(plan: DayPlan, cfg: GameConfig): ActionError | null {
  const r = cfg.recipe;
  if (
    !inRange(plan.recipe.lemons, r.lemons_per_pitcher) ||
    !inRange(plan.recipe.sugar, r.sugar_per_pitcher) ||
    !inRange(plan.recipe.ice, r.ice_per_pitcher)
  ) {
    return 'RECETTE_INVALIDE';
  }
  if (!inRange(plan.pitchers, { min: 0, max: r.max_pitchers_per_day })) return 'PICHETS_INVALIDES';
  const price = r.selling_price_per_cup;
  if (!inRange(plan.pricePerCup, price) || plan.pricePerCup % price.step !== 0) {
    return 'PRIX_INVALIDE';
  }
  return null;
}
