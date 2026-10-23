import type { GameConfig } from '../config/schema';
import type { Cents, Prices, Recipe } from './types';

/** Shop price of one unit (one lemon, one spoon of sugar…). */
export function unitPrice(prices: Prices, supply: keyof Prices, cfg: GameConfig): Cents {
  return prices[supply] / cfg.supplies[supply].package_quantity;
}

/**
 * Rough cost of making and serving one cup at today's shop prices, shown next
 * to the selling price so the player sees the margin (« Un verre te coûte environ… »).
 */
export function costPerCup(recipe: Recipe, prices: Prices, cfg: GameConfig): Cents {
  const pitcher =
    recipe.lemons * unitPrice(prices, 'lemons', cfg) +
    recipe.sugar * unitPrice(prices, 'sugar', cfg) +
    recipe.ice * unitPrice(prices, 'ice', cfg);
  return pitcher / cfg.recipe.servings_per_pitcher + unitPrice(prices, 'cups', cfg);
}

export interface DayAccounts {
  revenue: Cents;
  supplySpending: Cents;
  cashChange: Cents;
  costOfGoodsUsed: Cents;
  wasteCost: Cents;
  profit: Cents;
}

/**
 * The day's two money views (spec §8, ARCHITECTURE.md §7.8). Cash change is
 * exact; costs come from the stock's cost basis and are rounded to whole cents.
 */
export function dayAccounts(input: {
  revenue: Cents;
  supplySpending: Cents;
  costOfGoodsUsed: Cents;
  wasteCost: Cents;
}): DayAccounts {
  const costOfGoodsUsed = Math.round(input.costOfGoodsUsed);
  const wasteCost = Math.round(input.wasteCost);
  return {
    revenue: input.revenue,
    supplySpending: input.supplySpending,
    cashChange: input.revenue - input.supplySpending,
    costOfGoodsUsed,
    wasteCost,
    profit: input.revenue - costOfGoodsUsed - wasteCost,
  };
}
