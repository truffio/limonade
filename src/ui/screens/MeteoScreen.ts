import type { TrafficOutlook } from '../../core/types';
import { percent, temp } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { actions, button, mascot, screenTitle } from '../components';
import { h } from '../dom';
import { forecastIcon } from '../weather';
import { marketNewsLines } from './MagasinScreen';
import type { Screen } from './types';

const OUTLOOKS: TrafficOutlook[] = ['faible', 'moyenne', 'forte'];

export const MeteoScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    const f = game.forecast;
    const sky = fr.meteo.ciel[f.cloud];
    const news = marketNewsLines(game);

    return h(
      'section',
      { class: 'panneau' },
      screenTitle(fr.ecrans.meteo),
      h(
        'div',
        { class: 'meteo' },
        h('div', { class: 'meteo__icone', 'aria-hidden': 'true' }, forecastIcon(f)),
        h(
          'div',
          null,
          h('div', { class: 'meteo__temperature' }, temp(f.temperatureC)),
          h('div', { class: 'meteo__ciel' }, sky.nom),
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
        { class: 'affluence' },
        h('h2', null, fr.meteo.affluence),
        h(
          'div',
          { class: 'affluence__choix' },
          OUTLOOKS.map((o) =>
            h(
              'div',
              {
                class: `affluence__niveau${o === f.trafficOutlook ? ' affluence__niveau--actif' : ''}`,
                'aria-current': o === f.trafficOutlook ? 'true' : null,
              },
              h(
                'div',
                { class: 'affluence__visage', 'aria-hidden': 'true' },
                fr.meteo.affluences[o].icone,
              ),
              fr.meteo.affluences[o].texte,
            ),
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
      mascot(fr.meteo.conseil),
      actions(
        button(fr.meteo.vaAuMagasin, () => ctx.goTo('magasin'), {
          large: true,
          focusKey: 'vers-magasin',
        }),
      ),
    );
  },
};
