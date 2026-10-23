import { describe, expect, it } from 'vitest';
import { outlookCheck, simulate } from '../tools/stats';
import { testConfig } from './core/helpers';

/**
 * Guards the balance goals (ARCHITECTURE.md §14) against config or rule changes:
 * good play pays, following the forecast helps, careless play can lose.
 */
describe('balance (bots on the shipped config)', () => {
  const cfg = testConfig();
  const stats = simulate(cfg, 120, 14);
  const by = (name: string) => {
    const s = stats.find((x) => x.strategy === name);
    if (!s) throw new Error(`missing strategy ${name}`);
    return s;
  };
  const start = cfg.game.starting_cash;

  it('lets a sensible player end well above the starting cash', () => {
    expect(by('prudent').finalCash.median).toBeGreaterThan(start * 3);
    expect(by('malin').earlyEndRate).toBe(0);
  });

  it('rewards following the forecast', () => {
    expect(by('malin').finalCash.median).toBeGreaterThan(by('sans-meteo').finalCash.median * 1.05);
  });

  it('beats overpricing and overproducing with good play', () => {
    expect(by('malin').finalCash.median).toBeGreaterThan(by('gourmand').finalCash.median);
    expect(by('gourmand').wasteRate).toBeGreaterThan(by('malin').wasteRate);
  });

  it('lets careless play lose money sometimes', () => {
    expect(by('aleatoire').finalCash.p10).toBeLessThan(start);
    expect(by('aleatoire').finalCash.median).toBeLessThan(by('prudent').finalCash.median);
  });

  it('forecasts more visitors on days announced as busier', () => {
    const [faible, moyenne, forte] = outlookCheck(cfg, 60, 14);
    expect(faible?.meanVisitors).toBeLessThan(moyenne?.meanVisitors ?? 0);
    expect(moyenne?.meanVisitors).toBeLessThan(forte?.meanVisitors ?? 0);
  });
});
