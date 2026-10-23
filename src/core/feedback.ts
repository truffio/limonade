import type { TasteResult } from './recipe';
import type { Cents, DeclineReason, FeedbackItem, MissReason } from './types';

/** At most this many messages, so a child actually reads them (ARCHITECTURE.md §7.7). */
export const MAX_FEEDBACK = 3;

export interface FeedbackInput {
  potentialCustomers: number;
  cupsSold: number;
  declined: Record<DeclineReason, number>;
  missed: Record<MissReason, number>;
  /** When lemonade or cups ran out (0..1), if they did. */
  soldOutAt: { limonade: number | null; gobelets: number | null };
  taste: TasteResult;
  servingsMade: number;
  servingsDiscarded: number;
  lemonsSpoiled: number;
  rainSlots: number;
  pricePerCup: Cents;
  referencePrice: Cents;
}

/**
 * Picks the most useful comments on price, taste and stock, most important
 * first. Hints point in a direction without revealing the formula (spec §8).
 */
export function buildFeedback(input: FeedbackInput): FeedbackItem[] {
  const items: FeedbackItem[] = [];
  const share = (n: number) => (input.potentialCustomers > 0 ? n / input.potentialCustomers : 0);

  if (input.missed.MANQUE_LIMONADE > 0) {
    items.push({
      code: 'RUPTURE_LIMONADE',
      count: input.missed.MANQUE_LIMONADE,
      ...(input.soldOutAt.limonade !== null && { t: input.soldOutAt.limonade }),
    });
  }
  if (input.missed.MANQUE_GOBELETS > 0) {
    items.push({
      code: 'RUPTURE_GOBELETS',
      count: input.missed.MANQUE_GOBELETS,
      ...(input.soldOutAt.gobelets !== null && { t: input.soldOutAt.gobelets }),
    });
  }

  const tooExpensive = input.declined.TROP_CHER;
  if (tooExpensive >= 3 && share(tooExpensive) >= 0.25) {
    items.push({ code: 'PRIX_TROP_ELEVE', count: tooExpensive });
  }

  const worstTaste = input.taste.issues[0];
  const dislikedTaste = input.declined.PAS_BON;
  if (
    worstTaste &&
    (input.taste.quality < 0.6 || (dislikedTaste >= 2 && share(dislikedTaste) >= 0.15))
  ) {
    items.push({ code: worstTaste });
  }

  if (input.servingsDiscarded >= 3 && input.servingsDiscarded >= input.servingsMade * 0.25) {
    items.push({ code: 'GASPILLAGE_LIMONADE', count: input.servingsDiscarded });
  }

  if (input.lemonsSpoiled > 0) {
    items.push({ code: 'CITRONS_POURRIS', count: input.lemonsSpoiled });
  }

  const soldOut = input.soldOutAt.limonade !== null || input.soldOutAt.gobelets !== null;
  if (input.pricePerCup < input.referencePrice * 0.7 && (soldOut || tooExpensive === 0)) {
    items.push({ code: 'PRIX_BAS' });
  }

  if (input.rainSlots >= 2) items.push({ code: 'PLUIE' });

  if (input.taste.quality >= 0.85 && input.taste.issues.length === 0 && input.cupsSold > 0) {
    items.push({ code: 'DELICIEUX' });
  }

  return items.slice(0, MAX_FEEDBACK);
}
