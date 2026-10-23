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

/** Opening hours of the stand, used to turn a moment of the day (0..1) into a clock time. */
export const OPENING_HOUR = 10;
export const CLOSING_HOUR = 18;

/** Moment of the selling day (0 = opening, 1 = closing) as a clock time, e.g. 0.5 → « 14 h ». */
export function hour(t: number): string {
  const minutes = Math.round((OPENING_HOUR + (CLOSING_HOUR - OPENING_HOUR) * t) * 4) * 15;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}\u00a0h` : `${h}\u00a0h\u00a0${String(m).padStart(2, '0')}`;
}

/** Signed amount, always with + or − so colour is never the only clue (ARCHITECTURE.md §10.2). */
export function signedMoney(cents: number, currency = 'CAD'): string {
  const rounded = Math.round(cents);
  return rounded > 0 ? `+${money(rounded, currency)}` : money(rounded, currency);
}
