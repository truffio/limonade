import type { GameConfig } from '../config/schema';
import type { Cents, Inventory, InventoryCounts, StockLine, SupplyId } from './types';
import { SUPPLIES } from './types';

/** Anything held in stock: bought supplies plus servings of prepared lemonade. */
export type StockKey = SupplyId | 'lemonade';
type LineKey = Exclude<StockKey, 'lemons'>;

const EMPTY_LINE: StockLine = { qty: 0, unitCost: 0 };

export function emptyInventory(): Inventory {
  return {
    lemons: [],
    sugar: EMPTY_LINE,
    ice: EMPTY_LINE,
    cups: EMPTY_LINE,
    lemonade: EMPTY_LINE,
  };
}

/** Starting stock, valued at the starting shop price so profit stays honest. */
export function startingInventory(cfg: GameConfig): Inventory {
  let inventory = emptyInventory();
  const start = cfg.game.starting_inventory;
  for (const supply of SUPPLIES) {
    const s = cfg.supplies[supply];
    const unitCost = s.starting_price_per_package / s.package_quantity;
    inventory = addUnits(inventory, supply, start[supply], start[supply] * unitCost);
  }
  return inventory;
}

export function count(inventory: Inventory, key: StockKey): number {
  if (key === 'lemons') return inventory.lemons.reduce((sum, b) => sum + b.qty, 0);
  return inventory[key].qty;
}

export function counts(inventory: Inventory): InventoryCounts {
  return {
    lemons: count(inventory, 'lemons'),
    sugar: count(inventory, 'sugar'),
    ice: count(inventory, 'ice'),
    cups: count(inventory, 'cups'),
  };
}

/** Adds units. Lemons get a new batch (age 0); other lines update their average cost. */
export function addUnits(
  inventory: Inventory,
  key: StockKey,
  units: number,
  totalCost: Cents,
): Inventory {
  if (units <= 0) return inventory;
  if (key === 'lemons') {
    return {
      ...inventory,
      lemons: [...inventory.lemons, { qty: units, ageDays: 0, unitCost: totalCost / units }],
    };
  }
  const line = inventory[key];
  const qty = line.qty + units;
  const next: StockLine = { qty, unitCost: (line.qty * line.unitCost + totalCost) / qty };
  return { ...inventory, [key]: next };
}

/**
 * Removes units and returns their cost. Lemons are used oldest first (FIFO).
 * Throws if there is not enough stock: callers check availability first.
 */
export function takeUnits(
  inventory: Inventory,
  key: StockKey,
  units: number,
): { inventory: Inventory; cost: Cents } {
  if (units <= 0) return { inventory, cost: 0 };
  if (count(inventory, key) < units) {
    throw new Error(`Not enough ${key}: need ${units}, have ${count(inventory, key)}`);
  }
  if (key === 'lemons') return takeLemons(inventory, units);
  const line = inventory[key as LineKey];
  return {
    inventory: { ...inventory, [key]: { qty: line.qty - units, unitCost: line.unitCost } },
    cost: units * line.unitCost,
  };
}

function takeLemons(inventory: Inventory, units: number): { inventory: Inventory; cost: Cents } {
  const oldestFirst = [...inventory.lemons].sort((a, b) => b.ageDays - a.ageDays);
  let remaining = units;
  let cost = 0;
  const kept = [];
  for (const batch of oldestFirst) {
    const used = Math.min(batch.qty, remaining);
    remaining -= used;
    cost += used * batch.unitCost;
    if (batch.qty > used) kept.push({ ...batch, qty: batch.qty - used });
  }
  return { inventory: { ...inventory, lemons: kept }, cost };
}

export interface ClosingWaste {
  inventory: Inventory;
  servingsDiscarded: number;
  iceMelted: number;
  lemonsSpoiled: number;
  wasteCost: Cents;
}

/**
 * Closing time (spec §7): leftover lemonade is discarded, unused ice melts,
 * lemons age one day and batches that reach the spoilage age are thrown away.
 */
export function closeInventory(inventory: Inventory, cfg: GameConfig): ClosingWaste {
  let wasteCost = 0;

  let lemonade = inventory.lemonade;
  let servingsDiscarded = 0;
  if (cfg.spoilage.prepared_lemonade_discarded_end_of_day && lemonade.qty > 0) {
    servingsDiscarded = lemonade.qty;
    wasteCost += lemonade.qty * lemonade.unitCost;
    lemonade = EMPTY_LINE;
  }

  let ice = inventory.ice;
  let iceMelted = 0;
  if (cfg.spoilage.ice_melts_end_of_day && ice.qty > 0) {
    iceMelted = ice.qty;
    wasteCost += ice.qty * ice.unitCost;
    ice = EMPTY_LINE;
  }

  let lemonsSpoiled = 0;
  const lemons = [];
  for (const batch of inventory.lemons) {
    const aged = { ...batch, ageDays: batch.ageDays + 1 };
    if (aged.ageDays >= cfg.spoilage.lemon_spoilage_days) {
      lemonsSpoiled += aged.qty;
      wasteCost += aged.qty * aged.unitCost;
    } else {
      lemons.push(aged);
    }
  }

  return {
    inventory: { ...inventory, lemonade, ice, lemons },
    servingsDiscarded,
    iceMelted,
    lemonsSpoiled,
    wasteCost,
  };
}

/** Value of everything in stock at cost, for the end-of-game profit equation. */
export function stockValue(inventory: Inventory): Cents {
  const lemons = inventory.lemons.reduce((sum, b) => sum + b.qty * b.unitCost, 0);
  const lines: LineKey[] = ['sugar', 'ice', 'cups', 'lemonade'];
  return lines.reduce((sum, key) => sum + inventory[key].qty * inventory[key].unitCost, lemons);
}

/** Lemons that will spoil at closing today, so the UI can warn the player. */
export function lemonsExpiringToday(inventory: Inventory, cfg: GameConfig): number {
  return inventory.lemons
    .filter((b) => b.ageDays + 1 >= cfg.spoilage.lemon_spoilage_days)
    .reduce((sum, b) => sum + b.qty, 0);
}
