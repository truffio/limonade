import { describe, expect, it } from 'vitest';
import { buildFeedback, type FeedbackInput, MAX_FEEDBACK } from '../../src/core/feedback';

const base: FeedbackInput = {
  potentialCustomers: 40,
  cupsSold: 20,
  declined: { TROP_CHER: 0, PAS_BON: 0, PAS_SOIF: 20 },
  missed: { MANQUE_LIMONADE: 0, MANQUE_GOBELETS: 0 },
  soldOutAt: { limonade: null, gobelets: null },
  taste: { quality: 0.8, issues: [] },
  servingsMade: 24,
  servingsDiscarded: 4,
  lemonsSpoiled: 0,
  rainSlots: 0,
  pricePerCup: 100,
  referencePrice: 110,
};

const codes = (input: Partial<FeedbackInput>) =>
  buildFeedback({ ...base, ...input }).map((f) => f.code);

describe('feedback', () => {
  it('reports running out first, with the time it happened', () => {
    const items = buildFeedback({
      ...base,
      missed: { MANQUE_LIMONADE: 7, MANQUE_GOBELETS: 0 },
      soldOutAt: { limonade: 0.6, gobelets: null },
    });
    expect(items[0]).toEqual({ code: 'RUPTURE_LIMONADE', count: 7, t: 0.6 });
  });

  it('says when many customers found it too expensive', () => {
    expect(codes({ declined: { TROP_CHER: 15, PAS_BON: 0, PAS_SOIF: 5 } })).toContain(
      'PRIX_TROP_ELEVE',
    );
    expect(codes({ declined: { TROP_CHER: 2, PAS_BON: 0, PAS_SOIF: 18 } })).not.toContain(
      'PRIX_TROP_ELEVE',
    );
  });

  it('gives the worst taste problem when taste is poor', () => {
    expect(codes({ taste: { quality: 0.4, issues: ['TROP_ACIDE', 'PAS_ASSEZ_FRAIS'] } })).toContain(
      'TROP_ACIDE',
    );
  });

  it('mentions waste, spoiled lemons, rain and a good recipe', () => {
    expect(codes({ servingsDiscarded: 10 })).toContain('GASPILLAGE_LIMONADE');
    expect(codes({ lemonsSpoiled: 6 })).toContain('CITRONS_POURRIS');
    expect(codes({ rainSlots: 2 })).toContain('PLUIE');
    expect(codes({ taste: { quality: 0.9, issues: [] } })).toContain('DELICIEUX');
  });

  it('hints at a higher price when cheap cups sell out', () => {
    expect(codes({ pricePerCup: 50, soldOutAt: { limonade: 0.5, gobelets: null } })).toContain(
      'PRIX_BAS',
    );
  });

  it('never gives more than three messages', () => {
    const items = buildFeedback({
      ...base,
      missed: { MANQUE_LIMONADE: 3, MANQUE_GOBELETS: 2 },
      declined: { TROP_CHER: 20, PAS_BON: 10, PAS_SOIF: 0 },
      taste: { quality: 0.3, issues: ['TROP_SUCRE'] },
      servingsDiscarded: 12,
      lemonsSpoiled: 6,
      rainSlots: 3,
    });
    expect(items).toHaveLength(MAX_FEEDBACK);
  });
});
