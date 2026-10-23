import type { GameConfig } from '../config/schema';
import { startingInventory, stockValue } from './inventory';
import { startingPrices } from './market';
import { clamp, createRng, type Rng } from './rng';
import type { DayPlan, GameState, Weather } from './types';
import { makeForecast, nextWeather } from './weather';

export interface NewGameOptions {
  seed: number;
  /** Game length; clamped to the configured range. Defaults to the configured default. */
  days?: number;
}

export function defaultPlan(cfg: GameConfig): DayPlan {
  const r = cfg.recipe;
  return {
    recipe: {
      lemons: r.lemons_per_pitcher.default,
      sugar: r.sugar_per_pitcher.default,
      ice: r.ice_per_pitcher.default,
    },
    pitchers: 1,
    pricePerCup: r.selling_price_per_cup.default,
  };
}

/** Draws the actual weather of the coming day and the forecast the player will see. */
export function prepareWeather(
  previous: Weather | null,
  cfg: GameConfig,
  rng: Rng,
): Pick<GameState, 'weatherHidden' | 'forecast'> {
  const weatherHidden = nextWeather(previous, cfg.weather, rng);
  return { weatherHidden, forecast: makeForecast(weatherHidden, cfg, rng) };
}

export function newGame(cfg: GameConfig, options: NewGameOptions): GameState {
  const d = cfg.game.days;
  const totalDays = Math.round(clamp(options.days ?? d.default, d.min, d.max));
  const rng = createRng(options.seed);
  const inventory = startingInventory(cfg);
  const weather = prepareWeather(null, cfg, rng);

  return {
    seed: options.seed,
    rngState: rng.state,
    phase: 'METEO',
    day: 1,
    totalDays,
    startingCash: cfg.game.starting_cash,
    startingStockValue: stockValue(inventory),
    cash: cfg.game.starting_cash,
    totalProfit: 0,
    inventory,
    prices: startingPrices(cfg),
    previousPrices: null,
    marketNews: [],
    ...weather,
    plan: defaultPlan(cfg),
    todaySpending: 0,
    history: [],
    currentDay: null,
    endReason: null,
  };
}
