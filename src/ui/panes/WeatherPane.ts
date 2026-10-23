import type { GameState, TrafficOutlook } from '../../core/types';
import { percent, temp } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { h } from '../dom';
import type { ScreenContext } from '../screens/types';
import { forecastIcon } from '../weather';
import { pane, tutorialHint } from './common';

const OUTLOOKS: TrafficOutlook[] = ['faible', 'moyenne', 'forte'];

/** Short explanations of today's notable price changes (spec §4). */
export function marketNewsLines(game: GameState): string[] {
  return game.marketNews.map(
    (n) =>
      fr.magasin.nouvelles[n.id] ??
      fr.magasin.nouvelleGenerique(fr.fournitures[n.supply].nom, n.direction === 'hausse'),
  );
}

/** Tomorrow's forecast and expected traffic, top right of the dashboard. */
export function weatherPane(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const f = game.forecast;
  const news = marketNewsLines(game);

  return pane(
    'meteo',
    fr.volets.meteo,
    tutorialHint(ctx, 1, fr.tutoriel.meteo),
    h(
      'div',
      { class: 'meteo' },
      h('div', { class: 'meteo__icone', 'aria-hidden': 'true' }, forecastIcon(f)),
      h(
        'div',
        null,
        h(
          'div',
          null,
          h('span', { class: 'meteo__temperature' }, temp(f.temperatureC)),
          ' ',
          h('span', { class: 'meteo__ciel' }, fr.meteo.ciel[f.cloud].nom),
        ),
        h(
          'div',
          { class: 'meteo__pluie' },
          `${fr.meteo.pluie} ${fr.meteo.risquePluie} : `,
          h('strong', null, percent(f.rainChance)),
          f.rainLikelySlot ? ` (${fr.meteo.moment[f.rainLikelySlot]})` : '',
        ),
      ),
    ),
    h(
      'div',
      { class: 'affluence', role: 'group', 'aria-label': fr.meteo.affluence },
      h('span', { class: 'affluence__label' }, `${fr.meteo.affluence} :`),
      OUTLOOKS.map((o) =>
        h(
          'span',
          {
            class: `affluence__niveau${o === f.trafficOutlook ? ' affluence__niveau--actif' : ''}`,
            'aria-current': o === f.trafficOutlook ? 'true' : null,
            title: fr.meteo.affluences[o].texte,
          },
          h('span', { 'aria-hidden': 'true' }, fr.meteo.affluences[o].icone),
          o === f.trafficOutlook
            ? ` ${fr.meteo.affluences[o].texte}`
            : h('span', { class: 'sr-only' }, fr.meteo.affluences[o].texte),
        ),
      ),
    ),
    news.length > 0
      ? h(
          'div',
          { class: 'nouvelles' },
          news.map((n) => h('p', null, n)),
        )
      : null,
  );
}
