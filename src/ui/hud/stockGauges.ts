import type { GameConfig } from '../../config/schema';
import { counts, lemonsExpiringToday } from '../../core/inventory';
import type { DayRecord, GameState, InventoryCounts, SupplyId } from '../../core/types';
import { SUPPLIES } from '../../core/types';

/** A full bar is enough stock for a typical day: this many pitchers of the current recipe (#45). */
export const PITCHERS_FOR_FULL_BAR = 3;

export interface StockGauge {
  supply: SupplyId;
  count: number;
  /** Stock that fills the bar. */
  full: number;
  /** 0..1, clamped when stock is above the full scale. */
  fraction: number;
  /** Not enough for one pitcher of the current recipe (or its cups). */
  low: boolean;
  /** Lemons that spoil at closing tonight (0 for other supplies). */
  expiring: number;
}

/** Units of each supply needed for one pitcher with the current recipe (cups: one per serving). */
export function perPitcher(game: GameState, cfg: GameConfig): InventoryCounts {
  const { recipe } = game.plan;
  return {
    lemons: recipe.lemons,
    sugar: recipe.sugar,
    ice: recipe.ice,
    cups: cfg.recipe.servings_per_pitcher,
  };
}

export function gauge(
  supply: SupplyId,
  units: number,
  game: GameState,
  cfg: GameConfig,
  expiring = 0,
): StockGauge {
  const need = perPitcher(game, cfg)[supply];
  // A recipe without sugar or ice still gets a sensible scale: one package.
  const full = need > 0 ? need * PITCHERS_FOR_FULL_BAR : cfg.supplies[supply].package_quantity;
  return {
    supply,
    count: units,
    full,
    fraction: Math.min(1, units / full),
    low: need > 0 && units < need,
    expiring,
  };
}

export function gaugesFor(
  stock: InventoryCounts,
  game: GameState,
  cfg: GameConfig,
  expiringLemons: number,
): StockGauge[] {
  return SUPPLIES.map((supply) =>
    gauge(supply, stock[supply], game, cfg, supply === 'lemons' ? expiringLemons : 0),
  );
}

/** Stock between two days: what is in the inventory now. */
export function stockGauges(game: GameState, cfg: GameConfig): StockGauge[] {
  return gaugesFor(counts(game.inventory), game, cfg, lemonsExpiringToday(game.inventory, cfg));
}

export interface DayStock {
  supplies: InventoryCounts;
  /** Servings of lemonade prepared this morning. */
  servings: number;
  /** Lemons that spoil at closing tonight. */
  expiringLemons: number;
}

/**
 * Stock at opening time, once the pitchers are made: ingredients are already
 * used; leftover ice and old lemons are still there until closing; every cup
 * that will be sold is still on the stand.
 */
export function dayStartStock(record: DayRecord): DayStock {
  const after = record.inventoryAfter;
  return {
    supplies: {
      lemons: after.lemons + record.waste.lemonsSpoiled,
      sugar: after.sugar,
      ice: record.waste.iceMelted,
      cups: after.cups + record.cupsSold,
    },
    servings: record.servingsMade,
    expiringLemons: record.waste.lemonsSpoiled,
  };
}
