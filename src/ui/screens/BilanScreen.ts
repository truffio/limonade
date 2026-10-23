import { nextDay } from '../../core/actions';
import { money, signedMoney } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import {
  actions,
  button,
  columns,
  countUp,
  mascot,
  screenTitle,
  tile,
  toneOf,
  tutorialTip,
} from '../components';
import { h } from '../dom';
import { forecastLine, weatherLine } from '../weather';
import type { Screen } from './types';

let lastCountedDay = '';

/** End-of-day report (spec §8), with profit as the headline (ARCHITECTURE.md §10.3). */
export const BilanScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    const record = game.currentDay?.record ?? game.history[game.history.length - 1];
    if (!record) return h('p', null, '…');
    const last = game.day >= game.totalDays;
    const w = record.waste;
    const wasteLines = [
      w.servingsDiscarded > 0 ? fr.bilan.verresJetes(w.servingsDiscarded) : null,
      w.iceMelted > 0 ? fr.bilan.glaconsFondus(w.iceMelted) : null,
      w.lemonsSpoiled > 0 ? fr.bilan.citronsPourris(w.lemonsSpoiled) : null,
    ].filter((line): line is string => line !== null);

    // Count the profit up once, when the report first appears for this day.
    const profitValue = h('div', { class: 'benefice__valeur' }, signedMoney(record.profit));
    const key = `${game.seed}:${record.day}`;
    if (key !== lastCountedDay) {
      lastCountedDay = key;
      countUp(profitValue, record.profit, signedMoney);
    }

    return h(
      'section',
      { class: 'panneau' },
      screenTitle(`${fr.ecrans.bilan} ${record.day}`),
      tutorialTip(ctx, 4, fr.tutoriel.bilan),
      columns(
        [
          h(
            'div',
            { class: `benefice benefice--${toneOf(record.profit)}` },
            h('div', { class: 'benefice__label' }, fr.bilan.beneficeDuJour),
            profitValue,
            h(
              'div',
              { class: 'benefice__calcul' },
              h('span', null, `${fr.bilan.ventes} ${money(record.revenue)}`),
              ' − ',
              h('span', null, `${fr.bilan.coutVerresVendus} ${money(record.costOfGoodsUsed)}`),
              ' − ',
              h('span', null, `${fr.bilan.gaspillage} ${money(record.wasteCost)}`),
            ),
            button(
              fr.bilan.pourquoi,
              () => ctx.setUi({ explicationOuverte: !ctx.state.ui.explicationOuverte }),
              {
                variant: 'ghost',
                focusKey: 'pourquoi',
              },
            ),
            ctx.state.ui.explicationOuverte ? mascot(fr.bilan.explication) : null,
          ),
          h(
            'div',
            { class: 'bilan__bloc' },
            h('h2', null, fr.bilan.gaspille),
            wasteLines.length > 0
              ? h(
                  'ul',
                  { class: 'liste-simple' },
                  wasteLines.map((line) => h('li', null, line)),
                )
              : h('p', null, fr.bilan.rienJete),
          ),
          h(
            'div',
            { class: 'bilan__bloc bilan__meteo' },
            h('p', null, h('strong', null, `${fr.bilan.prevu} : `), forecastLine(record.forecast)),
            h('p', null, h('strong', null, `${fr.bilan.reel} : `), weatherLine(record.actual)),
          ),
        ],
        [
          h(
            'div',
            { class: 'tuiles' },
            tile(fr.bilan.clientsVenus, String(record.potentialCustomers)),
            tile(
              fr.bilan.verresVendus,
              String(record.cupsSold),
              record.cupsSold > 0 ? 'bon' : 'neutre',
            ),
            tile(
              fr.bilan.clientsDecus,
              String(record.missedSales),
              record.missedSales > 0 ? 'mauvais' : 'neutre',
            ),
            tile(fr.bilan.recette, money(record.revenue)),
            tile(fr.bilan.depenses, money(record.supplySpending)),
            tile(
              fr.bilan.variationCaisse,
              signedMoney(record.cashChange),
              toneOf(record.cashChange),
            ),
          ),
          record.feedback.length > 0
            ? mascot(...record.feedback.map((f) => fr.feedback[f.code](f)))
            : null,
        ],
      ),
      actions(
        button(fr.commun.historique, () => ctx.goTo('historique'), {
          variant: 'secondary',
          focusKey: 'historique',
        }),
        button(
          last ? fr.bilan.voirFin : fr.bilan.jourSuivant,
          () => ctx.act((g) => nextDay(g, ctx.cfg)),
          {
            large: true,
            focusKey: 'jour-suivant',
          },
        ),
      ),
    );
  },
};
