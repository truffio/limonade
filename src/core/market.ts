import type { GameConfig } from '../config/schema';
import { chance, clamp, normal, type Rng } from './rng';
import type { Cents, MarketNews, Prices } from './types';
import { SUPPLIES } from './types';

/** Shop prices move in steps of 5 cents. */
const PRICE_STEP: Cents = 5;

export function startingPrices(cfg: GameConfig): Prices {
  const s = cfg.supplies;
  return {
    lemons: s.lemons.starting_price_per_package,
    sugar: s.sugar.starting_price_per_package,
    ice: s.ice.starting_price_per_package,
    cups: s.cups.starting_price_per_package,
  };
}

/**
 * Next day's prices (spec §4): a small random move with a pull back toward the
 * usual price, plus occasional market events, always kept within the configured bounds.
 * `temperatureC` is the weather that just happened, which drives heat-related events.
 */
export function updatePrices(
  current: Prices,
  temperatureC: number,
  cfg: GameConfig,
  rng: Rng,
): { prices: Prices; news: MarketNews[] } {
  const news: MarketNews[] = [];
  const prices = { ...current };

  for (const supply of SUPPLIES) {
    const s = cfg.supplies[supply];
    let price = current[supply];
    price += s.mean_reversion * (s.starting_price_per_package - price);
    price *= 1 + normal(rng, s.daily_drift, s.daily_volatility);

    for (const event of cfg.market_events) {
      if (event.supply !== supply) continue;
      if (event.minimum_temperature_c !== undefined && temperatureC < event.minimum_temperature_c) {
        continue;
      }
      if (chance(rng, event.chance_per_day)) {
        price *= event.price_multiplier;
        news.push({
          id: event.id,
          supply,
          direction: event.price_multiplier >= 1 ? 'hausse' : 'baisse',
        });
      }
    }

    const rounded = Math.round(price / PRICE_STEP) * PRICE_STEP;
    prices[supply] = clamp(rounded, s.minimum_price_per_package, s.maximum_price_per_package);
  }

  return { prices, news };
}
