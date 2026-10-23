import type { GameConfig } from '../config/schema';
import { dayAccounts } from './accounting';
import {
  buyProbability,
  declineReason,
  purchaseTerms,
  referencePrice,
  slotVisitorMean,
} from './demand';
import { buildFeedback } from './feedback';
import { addUnits, closeInventory, count, counts, takeUnits } from './inventory';
import { ingredientNeeds } from './preparation';
import { tasteRecipe } from './recipe';
import { chance, int, normal, poisson, type Rng } from './rng';
import type {
  DayEvent,
  DayRecord,
  DeclineReason,
  GameState,
  Inventory,
  MissReason,
  Weather,
} from './types';
import { TIME_SLOTS } from './types';

export interface DayOutcome {
  record: DayRecord;
  events: DayEvent[];
  inventory: Inventory;
  cash: number;
}

/**
 * Tie-break for events at the same moment: weather changes come first; customers
 * and sold-out notices keep the order they happened in (Array.sort is stable).
 */
const EVENT_ORDER: Record<DayEvent['type'], number> = {
  rain_stop: 0,
  rain_start: 1,
  visitor: 2,
  sold_out: 2,
};

function rainEvents(weather: Weather): DayEvent[] {
  const slots = TIME_SLOTS.length;
  const indexes = weather.rainSlots.map((s) => TIME_SLOTS.indexOf(s)).sort((a, b) => a - b);
  const first = indexes[0];
  const last = indexes[indexes.length - 1];
  if (first === undefined || last === undefined) return [];
  return [
    { t: first / slots, type: 'rain_start' },
    { t: (last + 1) / slots, type: 'rain_stop' },
  ];
}

/** Arrival times of today's visitors, sorted (0 = opening, 1 = closing). */
function visitorTimes(weather: Weather, cfg: GameConfig, rng: Rng): number[] {
  const d = cfg.demand;
  const slots = TIME_SLOTS.length;
  const ticks = d.ticks_per_slot;
  const dailyMultiplier = Math.exp(normal(rng, 0, d.daily_variation_sd));
  const times: number[] = [];
  for (let slot = 0; slot < slots; slot++) {
    const visitors = poisson(rng, slotVisitorMean(weather, slot, dailyMultiplier, d));
    for (let i = 0; i < visitors; i++) {
      const tick = int(rng, 0, ticks - 1);
      times.push((slot * ticks + tick + 0.5) / (slots * ticks));
    }
  }
  return times.sort((a, b) => a - b);
}

/**
 * Runs one selling day (spec §6) on a plan that has already been validated:
 * prepares the pitchers, serves visitors in arrival order, then closes the stand.
 */
export function simulateDay(state: GameState, cfg: GameConfig, rng: Rng): DayOutcome {
  const { plan } = state;
  const weather = state.weatherHidden;

  // Preparation: ingredients are used up now (spec §7).
  let inventory = state.inventory;
  let ingredientCost = 0;
  const needs = ingredientNeeds(plan);
  for (const ingredient of ['lemons', 'sugar', 'ice'] as const) {
    const taken = takeUnits(inventory, ingredient, needs[ingredient]);
    inventory = taken.inventory;
    ingredientCost += taken.cost;
  }
  const servingsMade = plan.pitchers * cfg.recipe.servings_per_pitcher;
  inventory = addUnits(inventory, 'lemonade', servingsMade, ingredientCost);

  const taste = tasteRecipe(plan.recipe, weather.temperatureC, cfg.taste);
  const terms = purchaseTerms(taste.quality, weather.temperatureC, plan.pricePerCup, cfg.demand);

  const events: DayEvent[] = rainEvents(weather);
  const declined: Record<DeclineReason, number> = { TROP_CHER: 0, PAS_BON: 0, PAS_SOIF: 0 };
  const missed: Record<MissReason, number> = { MANQUE_LIMONADE: 0, MANQUE_GOBELETS: 0 };
  const soldOutAt: { limonade: number | null; gobelets: number | null } = {
    limonade: null,
    gobelets: null,
  };
  let cupsSold = 0;
  let costOfGoodsUsed = 0;

  const times = visitorTimes(weather, cfg, rng);
  times.forEach((t, id) => {
    const noise = normal(rng, 0, cfg.demand.purchase.customer_variation_sd);
    if (!chance(rng, buyProbability(terms, noise))) {
      const reason = declineReason(terms);
      declined[reason]++;
      events.push({ t, type: 'visitor', id, outcome: 'decline', reason });
      return;
    }

    const noLemonade = count(inventory, 'lemonade') === 0;
    const noCups = count(inventory, 'cups') === 0;
    if (noLemonade || noCups) {
      const reason: MissReason = noLemonade ? 'MANQUE_LIMONADE' : 'MANQUE_GOBELETS';
      missed[reason]++;
      events.push({ t, type: 'visitor', id, outcome: 'missed', reason });
      return;
    }

    const serving = takeUnits(inventory, 'lemonade', 1);
    const cup = takeUnits(serving.inventory, 'cups', 1);
    inventory = cup.inventory;
    costOfGoodsUsed += serving.cost + cup.cost;
    cupsSold++;
    events.push({ t, type: 'visitor', id, outcome: 'buy' });

    if (count(inventory, 'lemonade') === 0 && soldOutAt.limonade === null) {
      soldOutAt.limonade = t;
      events.push({ t, type: 'sold_out', what: 'limonade' });
    } else if (count(inventory, 'cups') === 0 && soldOutAt.gobelets === null) {
      soldOutAt.gobelets = t;
      events.push({ t, type: 'sold_out', what: 'gobelets' });
    }
  });

  events.sort((a, b) => a.t - b.t || EVENT_ORDER[a.type] - EVENT_ORDER[b.type]);

  const closing = closeInventory(inventory, cfg);
  const revenue = cupsSold * plan.pricePerCup;
  const accounts = dayAccounts({
    revenue,
    supplySpending: state.todaySpending,
    costOfGoodsUsed,
    wasteCost: closing.wasteCost,
  });
  const cash = state.cash + revenue;

  const record: DayRecord = {
    day: state.day,
    forecast: state.forecast,
    actual: weather,
    prices: state.prices,
    plan,
    quality: taste.quality,
    potentialCustomers: times.length,
    cupsSold,
    missedSales: missed.MANQUE_LIMONADE + missed.MANQUE_GOBELETS,
    declined: declined.TROP_CHER + declined.PAS_BON + declined.PAS_SOIF,
    ...accounts,
    servingsMade,
    waste: {
      servingsDiscarded: closing.servingsDiscarded,
      iceMelted: closing.iceMelted,
      lemonsSpoiled: closing.lemonsSpoiled,
    },
    feedback: buildFeedback({
      potentialCustomers: times.length,
      cupsSold,
      declined,
      missed,
      soldOutAt,
      taste,
      servingsMade,
      servingsDiscarded: closing.servingsDiscarded,
      lemonsSpoiled: closing.lemonsSpoiled,
      rainSlots: weather.rainSlots.length,
      pricePerCup: plan.pricePerCup,
      referencePrice: referencePrice(weather.temperatureC, cfg.demand),
    }),
    cashAfter: cash,
    inventoryAfter: counts(closing.inventory),
  };

  return { record, events, inventory: closing.inventory, cash };
}
