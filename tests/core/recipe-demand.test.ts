import { describe, expect, it } from 'vitest';
import { costPerCup } from '../../src/core/accounting';
import {
  buyProbability,
  declineReason,
  expectedDailyVisitors,
  purchaseTerms,
  referencePrice,
  temperatureFactor,
} from '../../src/core/demand';
import { startingPrices } from '../../src/core/market';
import { idealIce, tasteRecipe } from '../../src/core/recipe';
import { testConfig } from './helpers';

const cfg = testConfig();
const ideal = { lemons: 4, sugar: 4, ice: Math.round(idealIce(27, cfg.taste)) };

describe('recipe taste', () => {
  it('scores the ideal recipe near 1 with no complaints', () => {
    const t = tasteRecipe(ideal, 27, cfg.taste);
    expect(t.quality).toBeGreaterThan(0.95);
    expect(t.issues).toEqual([]);
  });

  it.each([
    [{ ...ideal, lemons: 1, sugar: 1 }, 'PAS_ASSEZ_CITRON'],
    [{ ...ideal, lemons: 8, sugar: 8 }, 'TROP_ACIDE'],
    [{ ...ideal, sugar: 0 }, 'PAS_ASSEZ_SUCRE'],
    [{ ...ideal, sugar: 12 }, 'TROP_SUCRE'],
    [{ ...ideal, ice: 0 }, 'PAS_ASSEZ_FRAIS'],
    [{ ...ideal, ice: 20 }, 'TROP_DE_GLACE'],
  ])('%j tastes %s', (recipe, issue) => {
    const t = tasteRecipe(recipe, 27, cfg.taste);
    expect(t.issues[0]).toBe(issue);
    expect(t.quality).toBeLessThan(0.95);
  });

  it('wants more ice when it is hot', () => {
    expect(idealIce(35, cfg.taste)).toBeGreaterThan(idealIce(20, cfg.taste));
    const noIce = { ...ideal, ice: 0 };
    expect(tasteRecipe(noIce, 35, cfg.taste).quality).toBeLessThan(
      tasteRecipe(noIce, 20, cfg.taste).quality,
    );
  });
});

describe('demand', () => {
  it('brings more visitors when it is hot and sunny, fewer when it rains', () => {
    const d = cfg.demand;
    expect(temperatureFactor(34, d)).toBeGreaterThan(temperatureFactor(20, d));
    const sunnyHot = expectedDailyVisitors(33, 'soleil', 0, 2, d);
    const cloudyWarm = expectedDailyVisitors(29, 'nuageux', 0.1, 2, d);
    const rainyCool = expectedDailyVisitors(18, 'couvert', 0.9, 2, d);
    expect(sunnyHot).toBeGreaterThan(cloudyWarm);
    expect(cloudyWarm).toBeGreaterThan(rainyCool);
    // Spec §3: warm, cloudy days can still be good.
    expect(cloudyWarm).toBeGreaterThan(d.traffic_outlook_thresholds.moyenne);
  });

  it('accepts higher prices on hot days', () => {
    expect(referencePrice(34, cfg.demand)).toBeGreaterThan(referencePrice(18, cfg.demand));
  });

  it('sells less when the price goes up or the taste goes down', () => {
    const p = (quality: number, price: number) =>
      buyProbability(purchaseTerms(quality, 27, price, cfg.demand), 0);
    expect(p(0.9, 100)).toBeGreaterThan(p(0.9, 200));
    expect(p(0.9, 100)).toBeGreaterThan(p(0.4, 100));
  });

  it('explains why a visitor did not buy', () => {
    expect(declineReason(purchaseTerms(0.95, 27, 400, cfg.demand))).toBe('TROP_CHER');
    expect(declineReason(purchaseTerms(0.2, 27, 100, cfg.demand))).toBe('PAS_BON');
    expect(declineReason(purchaseTerms(0.95, 27, 100, cfg.demand))).toBe('PAS_SOIF');
  });
});

describe('cost per cup', () => {
  it('adds ingredient cost per serving and one cup at shop prices', () => {
    const prices = startingPrices(cfg);
    // 4 lemons × 50 ¢ + 4 sugar × 7,5 ¢ + 6 ice × 4 ¢ = 254 ¢ per pitcher, / 8 servings + 5 ¢ cup
    expect(costPerCup({ lemons: 4, sugar: 4, ice: 6 }, prices, cfg)).toBeCloseTo(254 / 8 + 5, 6);
  });
});
