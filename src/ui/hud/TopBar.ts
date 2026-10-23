import { PLANNING_PHASES } from '../../core/types';
import { money, signedMoney, temp } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { button, toneOf } from '../components';
import { h } from '../dom';
import type { ScreenContext } from '../screens/types';
import { forecastIcon } from '../weather';

/** Always-visible game status (spec §2, ARCHITECTURE.md §10.2). */
export function renderTopBar(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const planning = PLANNING_PHASES.includes(game.phase);
  // The report, history and end screens already show or link to the history.
  const showHistory =
    !['historique', 'bilan', 'fin'].includes(ctx.state.screen) && game.history.length > 0;

  return h(
    'header',
    { class: 'barre' },
    button(
      '🏠',
      () => {
        ctx.quit();
        ctx.toast(fr.hud.sauvegarde);
      },
      { variant: 'ghost', label: fr.hud.accueil, focusKey: 'barre-accueil' },
    ),
    h('span', { class: 'barre__item barre__jour' }, '📅 ', fr.hud.jour(game.day, game.totalDays)),
    h(
      'span',
      { class: 'barre__item', title: fr.hud.caisse },
      '💰 ',
      h('span', { class: 'sr-only' }, `${fr.hud.caisse} : `),
      h('strong', null, money(game.cash)),
    ),
    h(
      'span',
      { class: `barre__item barre__benefice ton--${toneOf(game.totalProfit)}` },
      '📈 ',
      `${fr.hud.benefice} : `,
      h('strong', null, signedMoney(game.totalProfit)),
    ),
    planning
      ? h(
          'span',
          { class: 'barre__item barre__meteo' },
          `${forecastIcon(game.forecast)} ${temp(game.forecast.temperatureC)} `,
          h('small', null, `(${fr.hud.prevision})`),
        )
      : null,
    button(ctx.state.ui.son ? '🔊' : '🔇', () => ctx.setUi({ son: !ctx.state.ui.son }), {
      variant: 'ghost',
      label: ctx.state.ui.son ? fr.hud.couperSon : fr.hud.remettreSon,
      focusKey: 'barre-son',
    }),
    showHistory
      ? button(fr.commun.historique, () => ctx.goTo('historique'), {
          variant: 'ghost',
          focusKey: 'barre-historique',
        })
      : null,
  );
}
