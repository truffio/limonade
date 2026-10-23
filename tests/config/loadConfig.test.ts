import { describe, expect, it } from 'vitest';
import defaultConfig from '../../config/game-config.json';
import {
  describeIssue,
  formatPath,
  loadConfig,
  type ConfigIssue,
} from '../../src/config/loadConfig';

type Json = Record<string, unknown>;

/** Returns a copy of the default config with one change applied. */
function withChange(change: (config: Json) => void): Json {
  const copy = structuredClone(defaultConfig) as Json;
  change(copy);
  return copy;
}

function issuesFor(raw: unknown): ConfigIssue[] {
  const result = loadConfig(raw);
  if (result.ok) throw new Error('expected config to be invalid');
  return result.issues;
}

/** Normalises the no-break spaces used in fr-CA money formatting. */
const plain = (s: string) => s.replace(/\s/g, ' ');

function at(obj: Json, path: string): Json {
  return path.split('.').reduce((o, key) => o[key] as Json, obj);
}

describe('loadConfig: default config', () => {
  it('is valid', () => {
    const result = loadConfig(defaultConfig);
    if (!result.ok) throw new Error(result.issues.map(describeIssue).join('\n'));
    expect(result.ok).toBe(true);
  });

  it('converts dollar amounts to integer cents', () => {
    const result = loadConfig(defaultConfig);
    if (!result.ok) throw new Error('default config is invalid');
    const { config } = result;
    expect(config.game.starting_cash).toBe(2000);
    expect(config.supplies.lemons.minimum_price_per_package).toBe(200);
    expect(config.supplies.ice.minimum_price_per_package).toBe(125);
    expect(config.recipe.selling_price_per_cup).toEqual({
      min: 10,
      max: 500,
      default: 100,
      step: 5,
    });
    expect(config.demand.reference_price_per_cup).toBe(100);
  });

  it('defaults to 14 days, allowed between 14 and 60', () => {
    const result = loadConfig(defaultConfig);
    if (!result.ok) throw new Error('default config is invalid');
    expect(result.config.game.days).toEqual({ default: 14, min: 14, max: 60 });
  });
});

describe('loadConfig: invalid configs give readable French messages', () => {
  it('rejects a minimum price above the maximum price', () => {
    const raw = withChange((c) => {
      at(c, 'supplies.lemons').minimum_price_per_package = 6;
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('supplies.lemons.minimum_price_per_package');
    expect(plain(issue?.message ?? '')).toBe(
      'le prix minimum (6,00 $) est supérieur au prix maximum (5,00 $)',
    );
  });

  it('rejects a starting price outside the bounds', () => {
    const raw = withChange((c) => {
      at(c, 'supplies.sugar').starting_price_per_package = 9;
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('supplies.sugar.starting_price_per_package');
    expect(plain(issue?.message ?? '')).toContain('doit être entre 1,00 $ et 2,50 $');
  });

  it('rejects a minimum price of zero', () => {
    const raw = withChange((c) => {
      at(c, 'supplies.cups').minimum_price_per_package = 0;
      at(c, 'supplies.cups').starting_price_per_package = 0;
    });
    expect(issuesFor(raw).map((i) => i.message)).toContain(
      'le prix minimum doit être supérieur à 0',
    );
  });

  it('rejects money with more than 2 decimals', () => {
    const raw = withChange((c) => {
      at(c, 'game').starting_cash = 20.005;
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('game.starting_cash');
    expect(issue?.message).toContain('au plus 2 décimales');
  });

  it.each([
    [{ default: 14, min: 7, max: 60 }, 'game.days.min', 'au moins 14 jours'],
    [{ default: 14, min: 14, max: 90 }, 'game.days.max', 'au plus 60 jours'],
    [{ default: 10, min: 14, max: 60 }, 'game.days.default', 'doit être entre 14 et 60 jours'],
  ])('rejects game length %j', (daysValue, path, message) => {
    const raw = withChange((c) => {
      at(c, 'game').days = daysValue;
    });
    const issue = issuesFor(raw).find((i) => i.path === path);
    expect(issue?.message).toContain(message);
  });

  it('rejects a malformed currency code', () => {
    const raw = withChange((c) => {
      at(c, 'game').currency = 'dollars';
    });
    expect(issuesFor(raw)[0]?.path).toBe('game.currency');
  });

  it('rejects a locale that Intl cannot use', () => {
    const raw = withChange((c) => {
      at(c, 'game').locale = 'pas une langue';
    });
    expect(issuesFor(raw)[0]?.message).toContain('pas une langue');
  });

  it('rejects a cloud transition row that does not sum to 1', () => {
    const raw = withChange((c) => {
      at(c, 'weather.cloud_transition').soleil = { soleil: 0.7, nuageux: 0.2, couvert: 0.05 };
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('weather.cloud_transition.soleil');
    expect(issue?.message).toContain('total actuel : 0,95');
  });

  it('rejects a probability above 1', () => {
    const raw = withChange((c) => {
      at(c, 'weather').surprise_chance = 1.5;
    });
    expect(issuesFor(raw)[0]?.path).toBe('weather.surprise_chance');
  });

  it('rejects a recipe default outside its range', () => {
    const raw = withChange((c) => {
      at(c, 'recipe').lemons_per_pitcher = { min: 1, max: 8, default: 9 };
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('recipe.lemons_per_pitcher');
    expect(issue?.message).toContain('min ≤ default ≤ max');
  });

  it('rejects a selling price that is not a multiple of the step', () => {
    const raw = withChange((c) => {
      at(c, 'recipe.selling_price_per_cup').default = 1.02;
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('recipe.selling_price_per_cup.default');
    expect(plain(issue?.message ?? '')).toBe("1,02 $ n'est pas un multiple du pas (0,05 $)");
  });

  it('rejects temperatures out of order', () => {
    const raw = withChange((c) => {
      at(c, 'weather.temperature_c').mean = 40;
    });
    expect(issuesFor(raw)[0]?.message).toContain('min < mean < max');
  });

  it('rejects traffic thresholds out of order', () => {
    const raw = withChange((c) => {
      at(c, 'demand').traffic_outlook_thresholds = { moyenne: 80, forte: 70 };
    });
    expect(issuesFor(raw)[0]?.path).toBe('demand.traffic_outlook_thresholds.moyenne');
  });

  it('rejects taste weights that do not sum to 1', () => {
    const raw = withChange((c) => {
      at(c, 'taste').weights = { lemon: 0.5, sugar: 0.5, ice: 0.5 };
    });
    expect(issuesFor(raw)[0]?.path).toBe('taste.weights');
  });

  it('rejects a market event for an unknown supply', () => {
    const raw = withChange((c) => {
      (c.market_events as Json[])[0] = {
        id: 'PLUIE_DE_FRAISES',
        supply: 'strawberries',
        chance_per_day: 0.1,
        price_multiplier: 1.2,
      };
    });
    expect(issuesFor(raw)[0]?.path).toBe('market_events[0].supply');
  });

  it('rejects a non-positive package quantity', () => {
    const raw = withChange((c) => {
      at(c, 'supplies.ice').package_quantity = 0;
    });
    expect(issuesFor(raw)[0]?.path).toBe('supplies.ice.package_quantity');
  });

  it('rejects unknown keys, which are usually typos', () => {
    const raw = withChange((c) => {
      at(c, 'spoilage').lemon_spoilage_dayz = 3;
    });
    expect(issuesFor(raw).some((i) => i.path.startsWith('spoilage'))).toBe(true);
  });

  it('uses French built-in messages for wrong types', () => {
    const raw = withChange((c) => {
      at(c, 'recipe').servings_per_pitcher = 'huit';
    });
    const [issue] = issuesFor(raw);
    expect(issue?.path).toBe('recipe.servings_per_pitcher');
    expect(issue?.message.toLowerCase()).toMatch(/nombre|number/);
    expect(issue?.message).not.toMatch(/expected/i);
  });

  it('reports every problem at once', () => {
    const raw = withChange((c) => {
      at(c, 'supplies.lemons').package_quantity = -1;
      at(c, 'weather').surprise_chance = 2;
    });
    expect(issuesFor(raw).map((i) => i.path)).toEqual(
      expect.arrayContaining(['supplies.lemons.package_quantity', 'weather.surprise_chance']),
    );
  });
});

describe('formatPath / describeIssue', () => {
  it('joins keys with dots and array indexes with brackets', () => {
    expect(formatPath(['market_events', 2, 'supply'])).toBe('market_events[2].supply');
    expect(formatPath([])).toBe('');
  });

  it('prefixes the message with its location', () => {
    expect(describeIssue({ path: 'game.days', message: 'oups' })).toBe('game.days : oups');
    expect(describeIssue({ path: '', message: 'oups' })).toBe('oups');
  });
});
