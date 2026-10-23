import { stockValue } from '../../core/inventory';
import type { GameState } from '../../core/types';
import { money, signedMoney } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { actions, button, screenTitle, tile, toneOf } from '../components';
import { h } from '../dom';
import { historyTable } from './HistoriqueScreen';
import type { Screen } from './types';

/** A fun, gender-neutral title from how much the cash grew. */
export function scoreTitle(game: GameState): string {
  const ratio = game.cash / Math.max(1, game.startingCash);
  const titles = fr.fin.titres;
  const index = ratio < 1 ? 0 : ratio < 3 ? 1 : ratio < 10 ? 2 : 3;
  return titles[index] ?? titles[0];
}

/** Final results (spec §9). */
export const FinScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    const h_ = game.history;
    const sum = (pick: (d: (typeof h_)[number]) => number) => h_.reduce((s, d) => s + pick(d), 0);
    const best = h_.reduce<(typeof h_)[number] | null>(
      (b, d) => (!b || d.profit > b.profit ? d : b),
      null,
    );
    const stockLeft = Math.round(stockValue(game.inventory));
    const startStock = Math.round(game.startingStockValue);

    return h(
      'section',
      { class: 'panneau panneau--fin' },
      screenTitle(fr.ecrans.fin),
      h('p', { class: 'fin__raison' }, game.endReason ? fr.fin.raisons[game.endReason] : ''),
      h('div', { class: 'fin__titre' }, scoreTitle(game)),
      h('div', { class: 'fin__score' }, fr.fin.termine(money(game.cash))),
      h(
        'div',
        { class: `fin__benefice ton--${toneOf(game.totalProfit)}` },
        fr.fin.beneficeTotal(signedMoney(game.totalProfit)),
      ),
      h(
        'div',
        { class: 'fin__equation' },
        h('p', null, fr.fin.equation),
        h(
          'p',
          null,
          h('strong', null, money(game.startingCash + startStock)),
          ' + ',
          h('strong', null, signedMoney(game.totalProfit)),
          ' ≈ ',
          h('strong', null, money(game.cash)),
          ' + ',
          h('strong', null, money(stockLeft)),
        ),
      ),
      best ? h('p', null, fr.fin.meilleurJour(best.day, signedMoney(best.profit))) : null,
      h('h2', null, fr.fin.totaux),
      h(
        'div',
        { class: 'tuiles' },
        tile(fr.fin.caisseDepart, money(game.startingCash)),
        tile(fr.fin.caisseFinale, money(game.cash), toneOf(game.cash - game.startingCash)),
        tile(fr.fin.ventesTotales, money(sum((d) => d.revenue))),
        tile(fr.fin.depensesTotales, money(sum((d) => d.supplySpending))),
        tile(fr.fin.verresVendus, String(sum((d) => d.cupsSold))),
        tile(fr.fin.verresJetes, String(sum((d) => d.waste.servingsDiscarded))),
        tile(fr.fin.clientsDecus, String(sum((d) => d.missedSales))),
        tile(fr.fin.stockRestant, money(stockLeft)),
      ),
      h_.length > 0 ? historyTable(h_) : null,
      actions(button(fr.fin.rejouer, () => ctx.quit(), { large: true, focusKey: 'rejouer' })),
    );
  },
};
