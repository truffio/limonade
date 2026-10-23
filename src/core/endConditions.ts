import type { GameConfig } from '../config/schema';
import { count } from './inventory';
import type { Cents, GameState, SupplyId } from './types';

/**
 * Cheapest shopping that would let the player sell one cup with the smallest
 * valid recipe, or 0 if they already can. Ice is counted after melting.
 */
export function costToSellOneCup(state: GameState, cfg: GameConfig): Cents {
  const hasLemonade = count(state.inventory, 'lemonade') > 0;
  const r = cfg.recipe;
  const needs: Record<SupplyId, number> = hasLemonade
    ? { lemons: 0, sugar: 0, ice: 0, cups: 1 }
    : {
        lemons: r.lemons_per_pitcher.min,
        sugar: r.sugar_per_pitcher.min,
        ice: r.ice_per_pitcher.min,
        cups: 1,
      };

  let cost = 0;
  for (const supply of Object.keys(needs) as SupplyId[]) {
    const missing = Math.max(0, needs[supply] - count(state.inventory, supply));
    const packages = Math.ceil(missing / cfg.supplies[supply].package_quantity);
    cost += packages * state.prices[supply];
  }
  return cost;
}

/** Spec §9: the game ends early when the player can neither make nor afford one sale. */
export function canStillPlay(state: GameState, cfg: GameConfig): boolean {
  return costToSellOneCup(state, cfg) <= state.cash;
}
