import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import type { Weather } from '../../src/core/types';
import { makeForecast, nextWeather } from '../../src/core/weather';
import { testConfig } from './helpers';

function season(days: number, seed = 1): Weather[] {
  const cfg = testConfig();
  const rng = createRng(seed);
  const out: Weather[] = [];
  let previous: Weather | null = null;
  for (let i = 0; i < days; i++) {
    previous = nextWeather(previous, cfg.weather, rng);
    out.push(previous);
  }
  return out;
}

function correlation(xs: number[], ys: number[]): number {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let dx = 0;
  let dy = 0;
  xs.forEach((x, i) => {
    const y = ys[i] ?? 0;
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  });
  return num / Math.sqrt(dx * dy);
}

describe('weather', () => {
  const days = season(5000);
  const cfg = testConfig();

  it('keeps temperatures within the configured range, in whole degrees', () => {
    for (const d of days) {
      expect(d.temperatureC).toBeGreaterThanOrEqual(cfg.weather.temperature_c.min);
      expect(d.temperatureC).toBeLessThanOrEqual(cfg.weather.temperature_c.max);
      expect(Number.isInteger(d.temperatureC)).toBe(true);
    }
  });

  it('relates consecutive days', () => {
    const temps = days.map((d) => d.temperatureC);
    const r = correlation(temps.slice(0, -1), temps.slice(1));
    expect(r).toBeGreaterThan(0.3);
  });

  it('rains about as often as the config says for each sky', () => {
    for (const cloud of ['soleil', 'couvert'] as const) {
      const ofSky = days.filter((d) => d.cloud === cloud);
      const rainy = ofSky.filter((d) => d.rainSlots.length > 0).length / ofSky.length;
      expect(rainy).toBeCloseTo(cfg.weather.rain_probability_by_cloud[cloud], 1);
    }
  });

  it('rains in consecutive slots, at most rain_max_slots of them', () => {
    const order = ['matin', 'midi', 'apres-midi', 'soir'];
    for (const d of days.filter((x) => x.rainSlots.length > 0)) {
      expect(d.rainSlots.length).toBeLessThanOrEqual(cfg.weather.rain_max_slots);
      const idx = d.rainSlots.map((s) => order.indexOf(s));
      idx.forEach((v, i) => i > 0 && expect(v).toBe((idx[i - 1] ?? 0) + 1));
    }
  });
});

describe('forecast', () => {
  const cfg = testConfig();
  const rng = createRng(9);
  const pairs = season(5000, 2).map((actual) => ({
    actual,
    forecast: makeForecast(actual, cfg, rng),
  }));

  it('is close to the actual temperature on average', () => {
    const errors = pairs.map((p) => Math.abs(p.forecast.temperatureC - p.actual.temperatureC));
    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    expect(meanError).toBeLessThan(cfg.weather.forecast.temperature_sd_c * 1.2);
    expect(Math.max(...errors)).toBeGreaterThan(0); // but not perfect
  });

  it('gets the sky right about as often as configured', () => {
    const right = pairs.filter((p) => p.forecast.cloud === p.actual.cloud).length / pairs.length;
    expect(right).toBeCloseTo(cfg.weather.forecast.cloud_accuracy, 1);
  });

  it('gives informative but not certain rain chances', () => {
    const high = pairs.filter((p) => p.forecast.rainChance >= 0.5);
    const low = pairs.filter((p) => p.forecast.rainChance <= 0.1);
    const rate = (xs: typeof pairs) =>
      xs.filter((p) => p.actual.rainSlots.length > 0).length / xs.length;
    expect(rate(high)).toBeGreaterThan(rate(low));
    expect(rate(high)).toBeLessThan(1);
    for (const p of pairs) {
      expect(p.forecast.rainChance * 10).toBeCloseTo(Math.round(p.forecast.rainChance * 10), 6);
    }
  });

  it('names a likely rain slot only when rain is plausible', () => {
    for (const p of pairs) {
      if (p.forecast.rainChance < 0.2) expect(p.forecast.rainLikelySlot).toBeNull();
    }
  });

  it('predicts more traffic on hot sunny days than on cold rainy ones', () => {
    const hot = makeForecast(
      { temperatureC: 35, cloud: 'soleil', rainSlots: [] },
      cfg,
      createRng(1),
    );
    const cold = makeForecast(
      { temperatureC: 16, cloud: 'couvert', rainSlots: ['midi', 'apres-midi'] },
      cfg,
      createRng(1),
    );
    const rank = { faible: 0, moyenne: 1, forte: 2 };
    expect(rank[hot.trafficOutlook]).toBeGreaterThan(rank[cold.trafficOutlook]);
  });
});
