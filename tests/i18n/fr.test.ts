import { describe, expect, it } from 'vitest';
import type { FeedbackCode } from '../../src/core/types';
import { hour, signedMoney } from '../../src/i18n/format';
import { fr, plural } from '../../src/i18n/fr';
import { testConfig } from '../core/helpers';

const plain = (s: string) => s.replace(/\s/g, ' ');

describe('French texts', () => {
  it('has a message for every feedback code, filled with numbers', () => {
    const codes = Object.keys(fr.feedback) as FeedbackCode[];
    expect(codes.length).toBeGreaterThanOrEqual(14);
    for (const code of codes) {
      const text = fr.feedback[code]({ code, count: 3, t: 0.5 });
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toMatch(/undefined|NaN/);
    }
    expect(
      plain(fr.feedback.RUPTURE_LIMONADE({ code: 'RUPTURE_LIMONADE', count: 1, t: 0.5 })),
    ).toContain('Plus de limonade à 14 h : 1 client est reparti déçu');
  });

  it('explains every market event in the config', () => {
    for (const event of testConfig().market_events) {
      expect(fr.magasin.nouvelles[event.id]).toBeTruthy();
    }
  });

  it('pluralises', () => {
    expect(plural(1, 'verre', 'verres')).toBe('1 verre');
    expect(plural(0, 'verre', 'verres')).toBe('0 verre');
    expect(plural(3, 'verre', 'verres')).toBe('3 verres');
  });

  it('turns the moment of the day into a clock time between 10 h and 18 h', () => {
    expect(plain(hour(0))).toBe('10 h');
    expect(plain(hour(0.5))).toBe('14 h');
    expect(plain(hour(1))).toBe('18 h');
    expect(plain(hour(0.0625))).toBe('10 h 30');
  });

  it('always signs profits', () => {
    expect(plain(signedMoney(480))).toBe('+4,80 $');
    expect(plain(signedMoney(-75))).toMatch(/^-\s?0,75 \$$/);
    expect(plain(signedMoney(0))).toBe('0,00 $');
  });
});
