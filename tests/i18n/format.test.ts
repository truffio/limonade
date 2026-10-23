import { describe, expect, it } from 'vitest';
import { money, percent, temp } from '../../src/i18n/format';

// fr-CA uses (narrow) no-break spaces; normalise them so tests read naturally.
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('format (fr-CA)', () => {
  it('formats cents as Canadian dollars', () => {
    expect(plain(money(150))).toBe('1,50 $');
    expect(plain(money(4820))).toBe('48,20 $');
    expect(plain(money(-75))).toMatch(/^-\s?0,75 \$$/);
  });

  it('formats probabilities as whole percentages', () => {
    expect(plain(percent(0.3))).toBe('30 %');
  });

  it('rounds temperatures to whole degrees', () => {
    expect(plain(temp(28.4))).toBe('28 °C');
  });
});
