import type { Forecast, Weather } from '../core/types';
import { percent, temp } from '../i18n/format';
import { fr } from '../i18n/fr';

/** One icon for a forecast: rain wins when it is likely. */
export function forecastIcon(forecast: Forecast): string {
  if (forecast.rainChance >= 0.5) return fr.meteo.pluie;
  if (forecast.rainChance >= 0.3) return '🌦️';
  return fr.meteo.ciel[forecast.cloud].icone;
}

export function weatherIcon(weather: Weather): string {
  return weather.rainSlots.length > 0 ? fr.meteo.pluie : fr.meteo.ciel[weather.cloud].icone;
}

/** « ☀️ 29 °C · Grand soleil · Risque de pluie : 10 % » */
export function forecastLine(forecast: Forecast): string {
  return `${forecastIcon(forecast)} ${temp(forecast.temperatureC)} · ${fr.meteo.ciel[forecast.cloud].nom} · ${fr.meteo.risquePluie} : ${percent(forecast.rainChance)}`;
}

/** « 🌧️ 24 °C · Ciel gris · Pluie l'après-midi » */
export function weatherLine(weather: Weather): string {
  const first = weather.rainSlots[0];
  const rain = first ? fr.bilan.pluieA(fr.meteo.momentReel[first]) : fr.bilan.pasDePluie;
  return `${weatherIcon(weather)} ${temp(weather.temperatureC)} · ${fr.meteo.ciel[weather.cloud].nom} · ${rain}`;
}
