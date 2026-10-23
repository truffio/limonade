const LOCALE = 'fr-CA';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

/** Formats an amount in cents, e.g. 150 → « 1,50 $ ». */
export function money(cents: number, currency = 'CAD'): string {
  let formatter = moneyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
    moneyFormatters.set(currency, formatter);
  }
  return formatter.format(cents / 100);
}

const percentFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'percent',
  maximumFractionDigits: 0,
});

/** Formats a probability from 0 to 1, e.g. 0.3 → « 30 % ». */
export function percent(probability: number): string {
  return percentFormatter.format(probability);
}

/** Formats a temperature, e.g. 28.4 → « 28 °C ». */
export function temp(celsius: number): string {
  return `${Math.round(celsius)}\u00a0°C`;
}
