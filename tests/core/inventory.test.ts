import { describe, expect, it } from 'vitest';
import {
  addUnits,
  closeInventory,
  count,
  emptyInventory,
  lemonsExpiringToday,
  startingInventory,
  stockValue,
  takeUnits,
} from '../../src/core/inventory';
import type { Inventory } from '../../src/core/types';
import { testConfig } from './helpers';

const cfg = testConfig(); // lemons spoil after 3 days

function closeDays(inventory: Inventory, days: number) {
  let inv = inventory;
  let spoiled = 0;
  for (let i = 0; i < days; i++) {
    const closing = closeInventory(inv, cfg);
    inv = closing.inventory;
    spoiled += closing.lemonsSpoiled;
  }
  return { inventory: inv, spoiled };
}

describe('inventory', () => {
  it('uses the oldest lemons first and charges their own cost', () => {
    let inv = addUnits(emptyInventory(), 'lemons', 6, 300); // 50 ¢ each
    inv = closeInventory(inv, cfg).inventory; // now 1 day old
    inv = addUnits(inv, 'lemons', 6, 360); // 60 ¢ each, fresh

    const taken = takeUnits(inv, 'lemons', 8);
    expect(taken.cost).toBe(6 * 50 + 2 * 60);
    expect(taken.inventory.lemons).toEqual([{ qty: 4, ageDays: 0, unitCost: 60 }]);
  });

  it('spoils lemons exactly at the configured age', () => {
    const inv = addUnits(emptyInventory(), 'lemons', 6, 300);
    expect(closeDays(inv, 2).spoiled).toBe(0);
    expect(count(closeDays(inv, 2).inventory, 'lemons')).toBe(6);
    const third = closeDays(inv, 3);
    expect(third.spoiled).toBe(6);
    expect(count(third.inventory, 'lemons')).toBe(0);
  });

  it('warns about lemons that spoil tonight', () => {
    const inv = closeDays(addUnits(emptyInventory(), 'lemons', 6, 300), 2).inventory;
    expect(lemonsExpiringToday(inv, cfg)).toBe(6);
  });

  it('melts all ice and discards leftover lemonade at closing, as waste', () => {
    let inv = addUnits(emptyInventory(), 'ice', 50, 200);
    inv = addUnits(inv, 'lemonade', 5, 150);
    inv = addUnits(inv, 'sugar', 20, 150);
    const closing = closeInventory(inv, cfg);
    expect(closing.iceMelted).toBe(50);
    expect(closing.servingsDiscarded).toBe(5);
    expect(closing.wasteCost).toBe(200 + 150);
    expect(count(closing.inventory, 'ice')).toBe(0);
    expect(count(closing.inventory, 'lemonade')).toBe(0);
    expect(count(closing.inventory, 'sugar')).toBe(20); // sugar keeps
  });

  it('keeps ice and lemonade when the config says so', () => {
    const keep = testConfig((c) => {
      c.spoilage.ice_melts_end_of_day = false;
      c.spoilage.prepared_lemonade_discarded_end_of_day = false;
    });
    let inv = addUnits(emptyInventory(), 'ice', 50, 200);
    inv = addUnits(inv, 'lemonade', 5, 150);
    const closing = closeInventory(inv, keep);
    expect(closing.wasteCost).toBe(0);
    expect(count(closing.inventory, 'ice')).toBe(50);
  });

  it('averages the cost of bulk supplies', () => {
    let inv = addUnits(emptyInventory(), 'cups', 25, 125); // 5 ¢
    inv = addUnits(inv, 'cups', 25, 175); // 7 ¢
    expect(inv.cups).toEqual({ qty: 50, unitCost: 6 });
    expect(takeUnits(inv, 'cups', 10).cost).toBe(60);
  });

  it('refuses to take more than is in stock', () => {
    expect(() => takeUnits(emptyInventory(), 'sugar', 1)).toThrow();
  });

  it('values stock at cost', () => {
    let inv = addUnits(emptyInventory(), 'lemons', 6, 300);
    inv = addUnits(inv, 'cups', 25, 125);
    expect(stockValue(inv)).toBe(425);
  });

  it('values starting inventory at the starting price', () => {
    const withStock = testConfig((c) => {
      c.game.starting_inventory = { lemons: 6, sugar: 0, ice: 0, cups: 25 };
    });
    const inv = startingInventory(withStock);
    expect(count(inv, 'lemons')).toBe(6);
    expect(stockValue(inv)).toBe(300 + 125);
  });
});
