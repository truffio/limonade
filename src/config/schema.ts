import { z } from 'zod';
import { money as formatMoney } from '../i18n/format';

// Built-in zod messages (wrong type, too small…) in French, like the rest of the game.
z.config(z.locales.fr());

export const SUPPLY_IDS = ['lemons', 'sugar', 'ice', 'cups'] as const;
export const CLOUD_STATES = ['soleil', 'nuageux', 'couvert'] as const;

/** Bounds on game length that the config can narrow but never widen. */
export const DAYS_LIMITS = { min: 14, max: 60 } as const;

const EPSILON = 1e-6;

const probability = z.number().min(0).max(1);
const nonNegative = z.number().nonnegative();
const positive = z.number().positive();
const nonNegativeInt = z.number().int().nonnegative();
const positiveInt = z.number().int().positive();

/** An amount in dollars in the JSON file, converted to integer cents. */
const money = z
  .number()
  .nonnegative()
  .refine((dollars) => Math.abs(dollars * 100 - Math.round(dollars * 100)) < EPSILON, {
    error: 'un montant doit avoir au plus 2 décimales (ex. 1.25)',
  })
  .transform((dollars) => Math.round(dollars * 100));

function cloudRecord<T extends z.ZodType>(value: T) {
  return z.strictObject({ soleil: value, nuageux: value, couvert: value });
}

const intRange = z
  .strictObject({ min: nonNegativeInt, max: positiveInt, default: nonNegativeInt })
  .superRefine((r, ctx) => {
    if (!(r.min <= r.default && r.default <= r.max)) {
      ctx.addIssue({
        code: 'custom',
        message: `il faut min ≤ default ≤ max (reçu : min ${r.min}, default ${r.default}, max ${r.max})`,
      });
    }
  });

const days = z
  .strictObject({
    default: positiveInt,
    min: positiveInt.min(DAYS_LIMITS.min, {
      error: `une partie dure au moins ${DAYS_LIMITS.min} jours`,
    }),
    max: positiveInt.max(DAYS_LIMITS.max, {
      error: `une partie dure au plus ${DAYS_LIMITS.max} jours`,
    }),
  })
  .superRefine((d, ctx) => {
    if (!(d.min <= d.default && d.default <= d.max)) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: `la durée par défaut (${d.default} jours) doit être entre ${d.min} et ${d.max} jours`,
      });
    }
  });

const game = z
  .strictObject({
    currency: z.string().regex(/^[A-Z]{3}$/, { error: 'code de devise ISO attendu (ex. CAD)' }),
    locale: z.string().min(2),
    days,
    starting_cash: money,
    starting_inventory: z.strictObject({
      lemons: nonNegativeInt,
      sugar: nonNegativeInt,
      ice: nonNegativeInt,
      cups: nonNegativeInt,
    }),
  })
  .superRefine((g, ctx) => {
    try {
      new Intl.NumberFormat(g.locale, { style: 'currency', currency: g.currency });
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['currency'],
        message: `la devise « ${g.currency} » ou la langue « ${g.locale} » n'est pas reconnue`,
      });
    }
  });

const supply = z
  .strictObject({
    unit: z.string().min(1),
    package_quantity: positiveInt,
    starting_price_per_package: money,
    minimum_price_per_package: money,
    maximum_price_per_package: money,
    daily_volatility: probability,
    daily_drift: z.number().min(-0.5).max(0.5),
    /** Fraction of the gap to the starting price closed each day (0 = pure random walk). */
    mean_reversion: probability,
  })
  .superRefine((s, ctx) => {
    const min = s.minimum_price_per_package;
    const max = s.maximum_price_per_package;
    const start = s.starting_price_per_package;
    if (min <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['minimum_price_per_package'],
        message: 'le prix minimum doit être supérieur à 0',
      });
    }
    if (min > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['minimum_price_per_package'],
        message: `le prix minimum (${formatMoney(min)}) est supérieur au prix maximum (${formatMoney(max)})`,
      });
    } else if (start < min || start > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['starting_price_per_package'],
        message: `le prix de départ (${formatMoney(start)}) doit être entre ${formatMoney(min)} et ${formatMoney(max)}`,
      });
    }
  });

const marketEvent = z.strictObject({
  id: z.string().regex(/^[A-Z][A-Z0-9_]*$/, { error: 'identifiant en MAJUSCULES attendu' }),
  supply: z.enum(SUPPLY_IDS),
  chance_per_day: probability,
  price_multiplier: positive,
  minimum_temperature_c: z.number().optional(),
});

const sellingPrice = z
  .strictObject({ min: money, max: money, default: money, step: money })
  .superRefine((p, ctx) => {
    if (p.step <= 0) {
      ctx.addIssue({ code: 'custom', path: ['step'], message: 'le pas doit être supérieur à 0' });
      return;
    }
    if (p.min <= 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['min'],
        message: 'le prix minimum doit être supérieur à 0',
      });
    }
    if (!(p.min <= p.default && p.default <= p.max)) {
      ctx.addIssue({
        code: 'custom',
        path: ['default'],
        message: `le prix par défaut (${formatMoney(p.default)}) doit être entre ${formatMoney(p.min)} et ${formatMoney(p.max)}`,
      });
    }
    for (const key of ['min', 'max', 'default'] as const) {
      if (p[key] % p.step !== 0) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${formatMoney(p[key])} n'est pas un multiple du pas (${formatMoney(p.step)})`,
        });
      }
    }
  });

const recipe = z.strictObject({
  servings_per_pitcher: positiveInt,
  lemons_per_pitcher: intRange,
  sugar_per_pitcher: intRange,
  ice_per_pitcher: intRange,
  max_pitchers_per_day: positiveInt,
  selling_price_per_cup: sellingPrice,
});

const taste = z.strictObject({
  ideal_lemons_per_pitcher: positive,
  lemon_tolerance: positive,
  ideal_sugar_per_lemon: nonNegative,
  sugar_tolerance: positive,
  ideal_ice_per_pitcher_at_20c: nonNegative,
  ideal_ice_per_pitcher_at_35c: nonNegative,
  ice_tolerance: positive,
  weights: z
    .strictObject({ lemon: probability, sugar: probability, ice: probability })
    .superRefine((w, ctx) => {
      const total = w.lemon + w.sugar + w.ice;
      if (Math.abs(total - 1) > EPSILON) {
        ctx.addIssue({
          code: 'custom',
          message: `les poids doivent faire 1 au total (total actuel : ${round(total)})`,
        });
      }
    }),
});

const transitionRow = cloudRecord(probability).superRefine((row, ctx) => {
  const total = row.soleil + row.nuageux + row.couvert;
  if (Math.abs(total - 1) > EPSILON) {
    ctx.addIssue({
      code: 'custom',
      message: `les probabilités d'une ligne doivent faire 1 au total (total actuel : ${round(total)})`,
    });
  }
});

const weather = z.strictObject({
  temperature_c: z
    .strictObject({
      mean: z.number(),
      min: z.number(),
      max: z.number(),
      persistence: probability,
      daily_sd: nonNegative,
    })
    .superRefine((t, ctx) => {
      if (!(t.min < t.mean && t.mean < t.max)) {
        ctx.addIssue({
          code: 'custom',
          message: `il faut min < mean < max (reçu : ${t.min} °C, ${t.mean} °C, ${t.max} °C)`,
        });
      }
    }),
  surprise_chance: probability,
  surprise_sd_c: nonNegative,
  cloud_transition: cloudRecord(transitionRow),
  rain_probability_by_cloud: cloudRecord(probability),
  rain_max_slots: z.number().int().min(1).max(4),
  forecast: z.strictObject({ temperature_sd_c: nonNegative, cloud_accuracy: probability }),
});

const demand = z.strictObject({
  ticks_per_slot: positiveInt,
  base_visitors_per_slot: positive,
  daily_variation_sd: nonNegative,
  rain_traffic_factor: probability,
  temperature_effect: z
    .strictObject({
      cold_c: z.number(),
      hot_c: z.number(),
      factor_at_cold: nonNegative,
      factor_at_hot: nonNegative,
    })
    .superRefine((t, ctx) => {
      if (t.cold_c >= t.hot_c) {
        ctx.addIssue({
          code: 'custom',
          path: ['cold_c'],
          message: `cold_c (${t.cold_c} °C) doit être plus petit que hot_c (${t.hot_c} °C)`,
        });
      }
    }),
  cloud_traffic_factor: cloudRecord(nonNegative),
  purchase: z.strictObject({
    base_logit: z.number(),
    quality_weight: nonNegative,
    heat_weight: nonNegative,
    price_sensitivity: nonNegative,
    customer_variation_sd: nonNegative,
  }),
  reference_price_per_cup: money.refine((cents) => cents > 0, {
    error: 'le prix de référence doit être supérieur à 0',
  }),
  reference_price_hot_bonus_per_cup: money,
  traffic_outlook_thresholds: z
    .strictObject({ moyenne: positive, forte: positive })
    .superRefine((t, ctx) => {
      if (t.moyenne >= t.forte) {
        ctx.addIssue({
          code: 'custom',
          path: ['moyenne'],
          message: `le seuil « moyenne » (${t.moyenne}) doit être plus petit que « forte » (${t.forte})`,
        });
      }
    }),
});

export const gameConfigSchema = z.strictObject({
  game,
  supplies: z.strictObject({
    lemons: supply,
    sugar: supply,
    ice: supply,
    cups: supply,
  }),
  market_events: z.array(marketEvent),
  spoilage: z.strictObject({
    lemon_spoilage_days: positiveInt,
    ice_melts_end_of_day: z.boolean(),
    prepared_lemonade_discarded_end_of_day: z.boolean(),
  }),
  recipe,
  taste,
  weather,
  demand,
});

/** Validated configuration. Every money value is in integer cents. */
export type GameConfig = z.output<typeof gameConfigSchema>;
export type SupplyId = (typeof SUPPLY_IDS)[number];
export type CloudState = (typeof CLOUD_STATES)[number];

function round(value: number): string {
  return String(Math.round(value * 1000) / 1000).replace('.', ',');
}
