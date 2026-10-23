import type { GameConfig } from '../config/schema';
import { clamp, lerpClamped } from './rng';
import type { Cents, CloudState, DeclineReason, TrafficOutlook, Weather } from './types';
import { TIME_SLOTS } from './types';

type DemandConfig = GameConfig['demand'];

/**
 * Below this logit penalty, a customer who doesn't buy is just « pas soif »
 * rather than put off by price or taste. Presentation only, not balance.
 */
const DECLINE_REASON_MIN_PENALTY = 0.5;

/** How hot the day feels, from 0 (cold_c or below) to 1 (hot_c or above). */
export function heat(temperatureC: number, cfg: DemandConfig): number {
  const { cold_c, hot_c } = cfg.temperature_effect;
  return clamp((temperatureC - cold_c) / (hot_c - cold_c), 0, 1);
}

export function temperatureFactor(temperatureC: number, cfg: DemandConfig): number {
  const t = cfg.temperature_effect;
  return lerpClamped(temperatureC, t.cold_c, t.hot_c, t.factor_at_cold, t.factor_at_hot);
}

/** Mean number of visitors in one time slot of the actual day. */
export function slotVisitorMean(
  weather: Weather,
  slotIndex: number,
  dailyMultiplier: number,
  cfg: DemandConfig,
): number {
  const slot = TIME_SLOTS[slotIndex];
  const rainy = slot !== undefined && weather.rainSlots.includes(slot);
  return (
    cfg.base_visitors_per_slot *
    temperatureFactor(weather.temperatureC, cfg) *
    cfg.cloud_traffic_factor[weather.cloud] *
    (rainy ? cfg.rain_traffic_factor : 1) *
    dailyMultiplier
  );
}

/** Expected visitors for a whole day, from forecast-like inputs (used for the traffic outlook). */
export function expectedDailyVisitors(
  temperatureC: number,
  cloud: CloudState,
  rainChance: number,
  rainMaxSlots: number,
  cfg: DemandConfig,
): number {
  const slots = TIME_SLOTS.length;
  const averageRainSlots = (1 + rainMaxSlots) / 2;
  const rainyFraction = (rainChance * averageRainSlots) / slots;
  const perSlot =
    cfg.base_visitors_per_slot *
    temperatureFactor(temperatureC, cfg) *
    cfg.cloud_traffic_factor[cloud] *
    (1 - rainyFraction * (1 - cfg.rain_traffic_factor));
  return perSlot * slots;
}

export function trafficOutlook(expectedVisitors: number, cfg: DemandConfig): TrafficOutlook {
  const { moyenne, forte } = cfg.traffic_outlook_thresholds;
  if (expectedVisitors >= forte) return 'forte';
  if (expectedVisitors >= moyenne) return 'moyenne';
  return 'faible';
}

/** Price customers find fair today: higher when it is hot. */
export function referencePrice(temperatureC: number, cfg: DemandConfig): Cents {
  return (
    cfg.reference_price_per_cup + cfg.reference_price_hot_bonus_per_cup * heat(temperatureC, cfg)
  );
}

export interface PurchaseTerms {
  /** How much the price pushes customers away (logit units; > 0 means too expensive). */
  pricePenalty: number;
  /** How much imperfect taste pushes customers away (logit units, ≥ 0). */
  tastePenalty: number;
  logit: number;
}

export function purchaseTerms(
  quality: number,
  temperatureC: number,
  pricePerCup: Cents,
  cfg: DemandConfig,
): PurchaseTerms {
  const p = cfg.purchase;
  const priceRatio = pricePerCup / referencePrice(temperatureC, cfg);
  const pricePenalty = p.price_sensitivity * (priceRatio - 1);
  const tastePenalty = p.quality_weight * (1 - quality);
  const logit =
    p.base_logit +
    p.quality_weight * quality +
    p.heat_weight * heat(temperatureC, cfg) -
    pricePenalty;
  return { pricePenalty, tastePenalty, logit };
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Probability that a visitor buys, given their personal variation (logit noise). */
export function buyProbability(terms: PurchaseTerms, customerNoise: number): number {
  return sigmoid(terms.logit + customerNoise);
}

/** Why a visitor walked away without buying. */
export function declineReason(terms: PurchaseTerms): DeclineReason {
  const worst = Math.max(terms.pricePenalty, terms.tastePenalty);
  if (worst < DECLINE_REASON_MIN_PENALTY) return 'PAS_SOIF';
  return terms.pricePenalty >= terms.tastePenalty ? 'TROP_CHER' : 'PAS_BON';
}
