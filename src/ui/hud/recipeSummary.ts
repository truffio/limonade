import type { GameConfig } from '../../config/schema';
import { costPerCup } from '../../core/accounting';
import { checkPreparation } from '../../core/preparation';
import type { Cents, GameState, Recipe, SupplyId } from '../../core/types';

export interface Shortage {
  supply: SupplyId;
  missing: number;
}

export interface RecipeSummary {
  recipe: Recipe;
  pitchers: number;
  /** Glasses the planned pitchers make (plus any lemonade kept from yesterday). */
  servings: number;
  pricePerCup: Cents;
  /** Cost of one cup at today's shop prices, as on the « Ta recette » screen. */
  costPerCup: Cents;
  margin: Cents;
  /** What the plan needs but the stock doesn't have. Missing cups limit sales. */
  shortages: Shortage[];
}

/** Everything the always-visible recipe pane shows (#50). */
export function recipeSummary(game: GameState, cfg: GameConfig): RecipeSummary {
  const { plan } = game;
  const check = checkPreparation(game.inventory, plan, cfg);
  const cost = costPerCup(plan.recipe, game.prices, cfg);
  const shortages: Shortage[] = check.shortages.map((supply) => ({
    supply,
    missing: check.needs[supply] - check.available[supply],
  }));
  if (check.cupsLimitSales) {
    shortages.push({ supply: 'cups', missing: check.servings - check.cupsAvailable });
  }
  return {
    recipe: plan.recipe,
    pitchers: plan.pitchers,
    servings: check.servings,
    pricePerCup: plan.pricePerCup,
    costPerCup: cost,
    margin: plan.pricePerCup - cost,
    shortages,
  };
}
