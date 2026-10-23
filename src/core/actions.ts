import type { GameConfig } from '../config/schema';
import { simulateDay } from './daySimulation';
import { canStillPlay } from './endConditions';
import { prepareWeather } from './game';
import { addUnits } from './inventory';
import { updatePrices } from './market';
import { checkPreparation, validatePlan } from './preparation';
import { createRng } from './rng';
import type { ActionResult, DayPlan, GameState, Phase, SupplyId } from './types';
import { PLANNING_PHASES, SUPPLIES } from './types';

/** Packages to buy per supply. */
export type Cart = Partial<Record<SupplyId, number>>;

const ok = (state: GameState): ActionResult => ({ ok: true, state });

function isPlanning(state: GameState): boolean {
  return PLANNING_PHASES.includes(state.phase);
}

/** Moves between the planning screens (météo, magasin, recette). */
export function goToPhase(state: GameState, phase: Phase): ActionResult {
  if (!isPlanning(state) || !PLANNING_PHASES.includes(phase)) {
    return { ok: false, error: 'PHASE_INVALIDE' };
  }
  return ok({ ...state, phase });
}

export function cartCost(state: GameState, cart: Cart): number {
  return SUPPLIES.reduce((sum, supply) => sum + (cart[supply] ?? 0) * state.prices[supply], 0);
}

/** Spec §4: confirmed purchases add stock and take cash, never more than the cash available. */
export function buySupplies(state: GameState, cfg: GameConfig, cart: Cart): ActionResult {
  if (!isPlanning(state)) return { ok: false, error: 'PHASE_INVALIDE' };
  for (const supply of SUPPLIES) {
    const packages = cart[supply] ?? 0;
    if (!Number.isInteger(packages) || packages < 0) {
      return { ok: false, error: 'QUANTITE_INVALIDE' };
    }
  }
  const total = cartCost(state, cart);
  if (total > state.cash) return { ok: false, error: 'ARGENT_INSUFFISANT' };

  let inventory = state.inventory;
  for (const supply of SUPPLIES) {
    const packages = cart[supply] ?? 0;
    const units = packages * cfg.supplies[supply].package_quantity;
    inventory = addUnits(inventory, supply, units, packages * state.prices[supply]);
  }
  return ok({
    ...state,
    inventory,
    cash: state.cash - total,
    todaySpending: state.todaySpending + total,
  });
}

/** Sets recipe, pitchers and price. Stock is only enforced when the stand opens. */
export function setPlan(state: GameState, cfg: GameConfig, plan: DayPlan): ActionResult {
  if (!isPlanning(state)) return { ok: false, error: 'PHASE_INVALIDE' };
  const error = validatePlan(plan, cfg);
  if (error) return { ok: false, error };
  return ok({ ...state, plan });
}

/** Spec §2 step 4: locks the decisions and plays the whole day. */
export function openStand(state: GameState, cfg: GameConfig): ActionResult {
  if (!isPlanning(state)) return { ok: false, error: 'PHASE_INVALIDE' };
  const error = validatePlan(state.plan, cfg);
  if (error) return { ok: false, error };
  const check = checkPreparation(state.inventory, state.plan, cfg);
  if (check.shortages.length > 0) return { ok: false, error: 'INGREDIENTS_INSUFFISANTS' };
  if (check.servings === 0) return { ok: false, error: 'AUCUN_PICHET' };

  const rng = createRng(state.rngState);
  const outcome = simulateDay(state, cfg, rng);
  return ok({
    ...state,
    rngState: rng.state,
    phase: 'JOURNEE',
    inventory: outcome.inventory,
    cash: outcome.cash,
    totalProfit: state.totalProfit + outcome.record.profit,
    history: [...state.history, outcome.record],
    currentDay: { record: outcome.record, events: outcome.events },
  });
}

/** The day's animation is over (or skipped): show the report. */
export function finishDay(state: GameState): ActionResult {
  if (state.phase !== 'JOURNEE') return { ok: false, error: 'PHASE_INVALIDE' };
  return ok({ ...state, phase: 'BILAN' });
}

/** Spec §2 step 6: next day, or the end of the game (spec §9). */
export function nextDay(state: GameState, cfg: GameConfig): ActionResult {
  if (state.phase !== 'BILAN') return { ok: false, error: 'PHASE_INVALIDE' };
  if (state.day >= state.totalDays) {
    return ok({ ...state, phase: 'FIN', endReason: 'DERNIER_JOUR', currentDay: null });
  }

  const rng = createRng(state.rngState);
  const market = updatePrices(state.prices, state.weatherHidden.temperatureC, cfg, rng);
  const weather = prepareWeather(state.weatherHidden, cfg, rng);

  const next: GameState = {
    ...state,
    rngState: rng.state,
    phase: 'METEO',
    day: state.day + 1,
    previousPrices: state.prices,
    prices: market.prices,
    marketNews: market.news,
    ...weather,
    todaySpending: 0,
    currentDay: null,
  };

  if (!canStillPlay(next, cfg)) {
    return ok({ ...next, phase: 'FIN', endReason: 'PLUS_POSSIBLE' });
  }
  return ok(next);
}
