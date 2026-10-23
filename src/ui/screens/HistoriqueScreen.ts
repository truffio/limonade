import { PHASE_SCREEN } from '../../app/App';
import type { DayRecord, GameState } from '../../core/types';
import { money, signedMoney, temp } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { actions, button, screenTitle } from '../components';
import { lineChart } from '../components/lineChart';
import { h } from '../dom';
import { forecastIcon, weatherIcon } from '../weather';
import type { Screen } from './types';

const SUPPLY_COLORS = {
  lemons: 'var(--citron-fonce)',
  sugar: 'var(--corail)',
  ice: 'var(--ciel)',
  cups: 'var(--feuille-fonce)',
} as const;

/** Day-by-day table of decisions and results (spec §8 "History", §9). */
export function historyTable(history: readonly DayRecord[]): HTMLElement {
  const t = fr.historique;
  return h(
    'div',
    { class: 'tableau-defilant' },
    h(
      'table',
      { class: 'historique' },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          [t.jour, t.meteo, t.recette, t.prix, t.vendus, t.benefice, t.caisse].map((label) =>
            h('th', { scope: 'col' }, label),
          ),
        ),
      ),
      h(
        'tbody',
        null,
        history.map((d) =>
          h(
            'tr',
            null,
            h('th', { scope: 'row' }, String(d.day)),
            h(
              'td',
              null,
              `${forecastIcon(d.forecast)} ${temp(d.forecast.temperatureC)} → ${weatherIcon(d.actual)} ${temp(d.actual.temperatureC)}`,
            ),
            h(
              'td',
              null,
              `🍋${d.plan.recipe.lemons} 🍬${d.plan.recipe.sugar} 🧊${d.plan.recipe.ice} ×${d.plan.pitchers}`,
            ),
            h('td', null, money(d.plan.pricePerCup)),
            h('td', null, `${d.cupsSold} / ${d.potentialCustomers}`),
            h('td', { class: d.profit >= 0 ? 'ton--bon' : 'ton--mauvais' }, signedMoney(d.profit)),
            h('td', null, money(d.cashAfter)),
          ),
        ),
      ),
    ),
  );
}

export function historyCharts(game: GameState): HTMLElement {
  const days = game.history.map((d) => `J${d.day}`);
  const dollars = (c: number) => c / 100;
  const fmt = (v: number) => money(Math.round(v * 100));
  return h(
    'div',
    { class: 'graphiques' },
    lineChart(
      fr.historique.courbeCaisse,
      [
        {
          label: fr.hud.caisse,
          color: 'var(--feuille-fonce)',
          values: [game.startingCash, ...game.history.map((d) => d.cashAfter)].map(dollars),
        },
      ],
      fmt,
      [fr.historique.depart, ...days],
    ),
    lineChart(
      fr.historique.courbeBenefice,
      [
        {
          label: fr.hud.benefice,
          color: 'var(--citron-fonce)',
          values: game.history.map((d) => dollars(d.profit)),
        },
      ],
      fmt,
      days,
    ),
    lineChart(
      fr.historique.courbePrix,
      (['lemons', 'sugar', 'ice', 'cups'] as const).map((supply) => ({
        label: `${fr.fournitures[supply].icone} ${fr.fournitures[supply].nom}`,
        color: SUPPLY_COLORS[supply],
        values: game.history.map((d) => dollars(d.prices[supply])),
      })),
      fmt,
      days,
    ),
  );
}

export const HistoriqueScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    return h(
      'section',
      { class: 'panneau' },
      screenTitle(fr.ecrans.historique),
      game.history.length === 0
        ? h('p', null, fr.historique.vide)
        : [historyCharts(game), historyTable(game.history)],
      actions(
        button(fr.historique.retour, () => ctx.goTo(PHASE_SCREEN[game.phase]), {
          large: true,
          focusKey: 'retour-jeu',
        }),
      ),
    );
  },
};
