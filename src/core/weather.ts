import type { GameConfig } from '../config/schema';
import { expectedDailyVisitors, trafficOutlook } from './demand';
import { chance, clamp, int, normal, pickWeighted, type Rng } from './rng';
import type { CloudState, Forecast, TimeSlot, Weather } from './types';
import { CLOUD_ORDER, TIME_SLOTS } from './types';

type WeatherConfig = GameConfig['weather'];

/**
 * Draws the actual weather of the next day. Temperature reverts toward the
 * seasonal mean but keeps part of yesterday's value; clouds follow a Markov chain.
 */
export function nextWeather(previous: Weather | null, cfg: WeatherConfig, rng: Rng): Weather {
  const t = cfg.temperature_c;
  const base = previous ? t.mean + t.persistence * (previous.temperatureC - t.mean) : t.mean;
  let temperature = normal(rng, base, t.daily_sd);
  if (chance(rng, cfg.surprise_chance)) temperature += normal(rng, 0, cfg.surprise_sd_c);
  const temperatureC = Math.round(clamp(temperature, t.min, t.max));

  // The first day starts from the sunny row: summer begins nicely.
  const cloud = pickWeighted(rng, cfg.cloud_transition[previous?.cloud ?? 'soleil']);

  let rainSlots: TimeSlot[] = [];
  if (chance(rng, cfg.rain_probability_by_cloud[cloud])) {
    const count = int(rng, 1, cfg.rain_max_slots);
    const start = int(rng, 0, TIME_SLOTS.length - count);
    rainSlots = TIME_SLOTS.slice(start, start + count);
  }

  return { temperatureC, cloud, rainSlots };
}

/** A neighbouring sky state (soleil ↔ nuageux ↔ couvert), used when the forecast misses. */
function neighbourCloud(cloud: CloudState, rng: Rng): CloudState {
  const i = CLOUD_ORDER.indexOf(cloud);
  const options = [CLOUD_ORDER[i - 1], CLOUD_ORDER[i + 1]].filter(
    (c): c is CloudState => c !== undefined,
  );
  return options[int(rng, 0, options.length - 1)] ?? cloud;
}

/**
 * Builds an imperfect forecast from the actual weather (spec §3): useful on
 * average, sometimes wrong.
 */
export function makeForecast(actual: Weather, cfg: GameConfig, rng: Rng): Forecast {
  const w = cfg.weather;
  const temperatureC = Math.round(normal(rng, actual.temperatureC, w.forecast.temperature_sd_c));
  const cloud = chance(rng, w.forecast.cloud_accuracy)
    ? actual.cloud
    : neighbourCloud(actual.cloud, rng);

  // The forecaster gets a hint about rain that is right with probability `accuracy`,
  // then reports the honest probability given that hint (Bayes): high chances
  // usually mean rain, but not always, and low chances are not a promise either.
  const accuracy = w.forecast.cloud_accuracy;
  const prior = w.rain_probability_by_cloud[cloud];
  const willRain = actual.rainSlots.length > 0;
  const hintsRain = chance(rng, accuracy) ? willRain : !willRain;
  const ifRain = hintsRain ? accuracy : 1 - accuracy;
  const ifDry = hintsRain ? 1 - accuracy : accuracy;
  const posterior = (prior * ifRain) / (prior * ifRain + (1 - prior) * ifDry || 1);
  const rainChance = clamp(Math.round(posterior * 10) / 10, 0, 1);

  let rainLikelySlot: TimeSlot | null = null;
  if (rainChance >= 0.2) {
    const firstRainSlot = actual.rainSlots[0];
    rainLikelySlot =
      firstRainSlot && chance(rng, w.forecast.cloud_accuracy)
        ? firstRainSlot
        : (TIME_SLOTS[int(rng, 0, TIME_SLOTS.length - 1)] ?? null);
  }

  const expected = expectedDailyVisitors(
    temperatureC,
    cloud,
    rainChance,
    w.rain_max_slots,
    cfg.demand,
  );
  return {
    temperatureC,
    cloud,
    rainChance,
    rainLikelySlot,
    trafficOutlook: trafficOutlook(expected, cfg.demand),
  };
}
