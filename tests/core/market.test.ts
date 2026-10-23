import { describe, expect, it } from 'vitest';
import { startingPrices, updatePrices } from '../../src/core/market';
import { createRng } from '../../src/core/rng';
import { SUPPLIES } from '../../src/core/types';
import { testConfig } from './helpers';

describe('market prices', () => {
  it('start at the configured prices', () => {
    const cfg = testConfig();
    expect(startingPrices(cfg).lemons).toBe(cfg.supplies.lemons.starting_price_per_package);
  });

  it('never leave their bounds and move in 5-cent steps', () => {
    const cfg = testConfig();
    const rng = createRng(11);
    let prices = startingPrices(cfg);
    for (let day = 0; day < 2000; day++) {
      prices = updatePrices(prices, 30, cfg, rng).prices;
      for (const supply of SUPPLIES) {
        const s = cfg.supplies[supply];
        expect(prices[supply]).toBeGreaterThanOrEqual(s.minimum_price_per_package);
        expect(prices[supply]).toBeLessThanOrEqual(s.maximum_price_per_package);
        expect(prices[supply] % 5).toBe(0);
      }
    }
  });

  it('changes modestly from day to day', () => {
    const cfg = testConfig((c) => {
      c.market_events = [];
    });
    const rng = createRng(12);
    let prices = startingPrices(cfg);
    for (let day = 0; day < 500; day++) {
      const next = updatePrices(prices, 25, cfg, rng).prices;
      expect(Math.abs(next.sugar - prices.sugar)).toBeLessThanOrEqual(prices.sugar * 0.15 + 5);
      prices = next;
    }
  });

  it('applies a market event and explains it', () => {
    const cfg = testConfig((c) => {
      c.supplies.lemons.daily_volatility = 0;
      c.supplies.lemons.mean_reversion = 0;
      c.market_events = [
        { id: 'RECOLTE_CITRONS', supply: 'lemons', chance_per_day: 1, price_multiplier: 0.75 },
      ];
    });
    const { prices, news } = updatePrices(startingPrices(cfg), 25, cfg, createRng(1));
    expect(prices.lemons).toBe(225); // 3,00 $ × 0,75
    expect(news).toEqual([{ id: 'RECOLTE_CITRONS', supply: 'lemons', direction: 'baisse' }]);
  });

  it('only raises ice prices in a heat wave when it is hot enough', () => {
    const cfg = testConfig((c) => {
      c.market_events = [
        {
          id: 'CANICULE_GLACE',
          supply: 'ice',
          chance_per_day: 1,
          price_multiplier: 1.3,
          minimum_temperature_c: 32,
        },
      ];
    });
    expect(updatePrices(startingPrices(cfg), 25, cfg, createRng(1)).news).toEqual([]);
    expect(updatePrices(startingPrices(cfg), 34, cfg, createRng(1)).news[0]?.direction).toBe(
      'hausse',
    );
  });
});
