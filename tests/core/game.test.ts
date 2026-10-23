import { describe, expect, it } from 'vitest';
import {
  buySupplies,
  cartCost,
  finishDay,
  goToPhase,
  nextDay,
  openStand,
  setPlan,
} from '../../src/core/actions';
import { canStillPlay } from '../../src/core/endConditions';
import { newGame } from '../../src/core/game';
import { count, stockValue } from '../../src/core/inventory';
import { checkPreparation } from '../../src/core/preparation';
import type { GameState } from '../../src/core/types';
import { playSimpleDay, testConfig, unwrap } from './helpers';

const cfg = testConfig();

/** A game on day 1 with enough stock for `pitchers` pitchers and plenty of cups. */
function stocked(pitchers = 3, seed = 1): GameState {
  const s = newGame(cfg, { seed });
  const bought = unwrap(buySupplies(s, cfg, { lemons: 2, sugar: 1, ice: 1, cups: 2 }));
  return unwrap(setPlan(bought, cfg, { ...bought.plan, pitchers }));
}

describe('newGame', () => {
  it('starts on day 1 with the configured cash, length and prices', () => {
    const s = newGame(cfg, { seed: 1 });
    expect(s).toMatchObject({ phase: 'METEO', day: 1, totalDays: 14, cash: 2000, totalProfit: 0 });
    expect(s.prices.lemons).toBe(300);
    expect(s.history).toEqual([]);
  });

  it('clamps the game length to the configured range', () => {
    expect(newGame(cfg, { seed: 1, days: 5 }).totalDays).toBe(14);
    expect(newGame(cfg, { seed: 1, days: 30 }).totalDays).toBe(30);
    expect(newGame(cfg, { seed: 1, days: 99 }).totalDays).toBe(60);
  });
});

describe('planning actions', () => {
  it('moves between planning screens only', () => {
    const s = newGame(cfg, { seed: 1 });
    expect(unwrap(goToPhase(s, 'MAGASIN')).phase).toBe('MAGASIN');
    expect(goToPhase(s, 'BILAN')).toEqual({ ok: false, error: 'PHASE_INVALIDE' });
  });

  it('buys supplies: stock up, cash down, spending tracked', () => {
    const s = newGame(cfg, { seed: 1 });
    const cart = { lemons: 1, cups: 1 };
    const after = unwrap(buySupplies(s, cfg, cart));
    expect(count(after.inventory, 'lemons')).toBe(6);
    expect(count(after.inventory, 'cups')).toBe(25);
    expect(after.cash).toBe(2000 - cartCost(s, cart));
    expect(after.todaySpending).toBe(cartCost(s, cart));
  });

  it('never spends more than the cash available', () => {
    const s = newGame(cfg, { seed: 1 });
    expect(buySupplies(s, cfg, { lemons: 7 })).toEqual({ ok: false, error: 'ARGENT_INSUFFISANT' });
    expect(buySupplies(s, cfg, { lemons: -1 })).toEqual({ ok: false, error: 'QUANTITE_INVALIDE' });
    expect(buySupplies(s, cfg, { lemons: 1.5 })).toEqual({
      ok: false,
      error: 'QUANTITE_INVALIDE',
    });
  });

  it('validates recipe, pitchers and price', () => {
    const s = newGame(cfg, { seed: 1 });
    const bad = (patch: object) => setPlan(s, cfg, { ...s.plan, ...patch });
    expect(bad({ recipe: { lemons: 9, sugar: 4, ice: 6 } })).toMatchObject({
      error: 'RECETTE_INVALIDE',
    });
    expect(bad({ pitchers: 21 })).toMatchObject({ error: 'PICHETS_INVALIDES' });
    expect(bad({ pricePerCup: 102 })).toMatchObject({ error: 'PRIX_INVALIDE' });
    expect(bad({ pricePerCup: 600 })).toMatchObject({ error: 'PRIX_INVALIDE' });
  });

  it('shows shortages and when cups limit sales before opening', () => {
    const s = newGame(cfg, { seed: 1 });
    const bought = unwrap(buySupplies(s, cfg, { lemons: 1, sugar: 1, ice: 1, cups: 1 }));
    const check = checkPreparation(bought.inventory, { ...bought.plan, pitchers: 4 }, cfg);
    expect(check.shortages).toEqual(['lemons']); // 16 needed, 6 owned
    expect(check.maxPitchers).toBe(1);

    const fewCups = checkPreparation(bought.inventory, { ...bought.plan, pitchers: 1 }, cfg);
    expect(fewCups.cupsLimitSales).toBe(false); // 8 servings, 25 cups
    const s2 = unwrap(buySupplies(s, cfg, { lemons: 2, sugar: 2, ice: 1 }));
    const noCups = checkPreparation(s2.inventory, { ...s2.plan, pitchers: 2 }, cfg);
    expect(noCups.cupsLimitSales).toBe(true);
    expect(noCups.sellableCups).toBe(0);
  });

  it('refuses to open without ingredients or without any pitcher', () => {
    const s = newGame(cfg, { seed: 1 });
    expect(openStand(s, cfg)).toEqual({ ok: false, error: 'INGREDIENTS_INSUFFISANTS' });
    const zero = unwrap(setPlan(s, cfg, { ...s.plan, pitchers: 0 }));
    expect(openStand(zero, cfg)).toEqual({ ok: false, error: 'AUCUN_PICHET' });
  });
});

describe('a selling day', () => {
  const before = stocked(3);
  const after = unwrap(openStand(before, cfg));
  const day = after.currentDay;
  if (!day) throw new Error('no current day');
  const { record, events } = day;

  it('locks decisions once the stand is open (spec §2)', () => {
    expect(after.phase).toBe('JOURNEE');
    expect(setPlan(after, cfg, after.plan)).toMatchObject({ error: 'PHASE_INVALIDE' });
    expect(buySupplies(after, cfg, {})).toMatchObject({ error: 'PHASE_INVALIDE' });
  });

  it('uses the ingredients when preparing', () => {
    const r = before.plan.recipe;
    expect(count(before.inventory, 'lemons') - record.inventoryAfter.lemons).toBe(r.lemons * 3);
    expect(count(before.inventory, 'sugar') - record.inventoryAfter.sugar).toBe(r.sugar * 3);
  });

  it('sells at most what was made and what cups allow, one cup per sale', () => {
    expect(record.servingsMade).toBe(24);
    expect(record.cupsSold).toBeLessThanOrEqual(24);
    expect(count(before.inventory, 'cups') - record.inventoryAfter.cups).toBe(record.cupsSold);
    expect(record.revenue).toBe(record.cupsSold * before.plan.pricePerCup);
    expect(after.cash).toBe(before.cash + record.revenue);
  });

  it('accounts for every visitor and only misses sales after running out', () => {
    const visitors = events.filter((e) => e.type === 'visitor');
    expect(visitors).toHaveLength(record.potentialCustomers);
    expect(record.cupsSold + record.declined + record.missedSales).toBe(record.potentialCustomers);
    const soldOut = events.findIndex((e) => e.type === 'sold_out');
    const firstMiss = events.findIndex((e) => e.type === 'visitor' && e.outcome === 'missed');
    if (firstMiss >= 0) expect(soldOut).toBeGreaterThanOrEqual(0);
    if (firstMiss >= 0) expect(firstMiss).toBeGreaterThan(soldOut);
  });

  it('never shows a disappointed customer before the sold-out moment, whatever the seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const played = unwrap(openStand(stocked(1, seed), cfg)).currentDay?.events ?? [];
      const soldOut = played.findIndex((e) => e.type === 'sold_out');
      const firstMiss = played.findIndex((e) => e.type === 'visitor' && e.outcome === 'missed');
      if (firstMiss >= 0) expect(firstMiss).toBeGreaterThan(soldOut);
      if (firstMiss >= 0) expect(soldOut).toBeGreaterThanOrEqual(0);
    }
  });

  it('orders events in time from opening to closing', () => {
    events.forEach((e, i) => {
      expect(e.t).toBeGreaterThanOrEqual(0);
      expect(e.t).toBeLessThanOrEqual(1);
      if (i > 0) expect(e.t).toBeGreaterThanOrEqual(events[i - 1]?.t ?? 0);
    });
  });

  it('discards leftover lemonade and melts ice at closing', () => {
    expect(record.waste.servingsDiscarded).toBe(24 - record.cupsSold);
    expect(record.inventoryAfter.ice).toBe(0);
  });

  it('keeps cash change and profit separate (spec §8)', () => {
    expect(record.cashChange).toBe(record.revenue - record.supplySpending);
    expect(record.profit).toBe(record.revenue - record.costOfGoodsUsed - record.wasteCost);
    expect(after.totalProfit).toBe(record.profit);
    expect(record.feedback.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic for the same seed and decisions', () => {
    const again = unwrap(openStand(stocked(3), cfg));
    expect(again.currentDay).toEqual(after.currentDay);
    const other = unwrap(openStand(stocked(3, 2), cfg));
    expect(other.currentDay).not.toEqual(after.currentDay);
  });

  it('goes to the report, then to the next day with new prices and weather', () => {
    const bilan = unwrap(finishDay(after));
    expect(bilan.phase).toBe('BILAN');
    const tomorrow = unwrap(nextDay(bilan, cfg));
    expect(tomorrow).toMatchObject({ phase: 'METEO', day: 2, todaySpending: 0, currentDay: null });
    expect(tomorrow.previousPrices).toEqual(before.prices);
    expect(tomorrow.history).toHaveLength(1);
  });
});

describe('whole games', () => {
  function playGame(seed: number, days = 14) {
    let s = newGame(cfg, { seed, days });
    let guard = 0;
    while (s.phase !== 'FIN' && guard++ < days + 5) {
      const next = playSimpleDay(s, cfg);
      if (next === s) break; // could not open
      s = next;
    }
    return s;
  }

  it('ends after the last day', () => {
    const s = playGame(3);
    expect(s.phase).toBe('FIN');
    expect(s.endReason).toBe('DERNIER_JOUR');
    expect(s.history).toHaveLength(14);
  });

  it('keeps the books balanced over a whole game', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = playGame(seed);
      const totalCashChange = s.history.reduce((sum, d) => sum + d.cashChange, 0);
      expect(s.startingCash + totalCashChange).toBe(s.cash);

      // Stock bought and still owned lowers cash but not profit:
      // final cash = starting cash + total profit − (stock value now − at the start).
      // Costs are rounded to the cent each day, hence the small tolerance.
      const stockChange = stockValue(s.inventory) - s.startingStockValue;
      expect(Math.abs(s.cash - (s.startingCash + s.totalProfit - stockChange))).toBeLessThanOrEqual(
        s.history.length,
      );
    }
  });

  it('ends early when the player can neither sell nor afford to', () => {
    const s = newGame(cfg, { seed: 1 });
    const broke: GameState = { ...s, cash: 0 };
    expect(canStillPlay(broke, cfg)).toBe(false);

    const bilan: GameState = { ...broke, phase: 'BILAN' };
    const end = unwrap(nextDay(bilan, cfg));
    expect(end.phase).toBe('FIN');
    expect(end.endReason).toBe('PLUS_POSSIBLE');
  });

  it('lets a player with stock but no cash keep playing', () => {
    const s = stocked(1);
    expect(canStillPlay({ ...s, cash: 0 }, cfg)).toBe(true);
  });
});
