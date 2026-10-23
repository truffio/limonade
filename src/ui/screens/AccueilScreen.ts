import { fr } from '../../i18n/fr';
import { button, mascot, stepper } from '../components';
import { h } from '../dom';
import type { Screen } from './types';

const QUICK_LENGTHS = [14, 30, 45, 60];

export const AccueilScreen: Screen = {
  render(ctx) {
    const { days } = ctx.cfg.game;
    const chosen = ctx.state.ui.dureeChoisie;
    const saved = chosen === null ? ctx.savedGame() : null;

    const help = ctx.state.ui.aideOuverte
      ? h(
          'div',
          { class: 'aide' },
          fr.accueil.aide.map((card) =>
            h(
              'div',
              { class: 'aide__carte' },
              h('div', { class: 'aide__icone', 'aria-hidden': 'true' }, card.icone),
              h('strong', null, card.titre),
              h('p', null, card.texte),
            ),
          ),
        )
      : null;

    const picker =
      chosen === null
        ? null
        : h(
            'div',
            { class: 'duree' },
            h('h2', null, fr.accueil.duree),
            h(
              'div',
              { class: 'duree__rapides' },
              QUICK_LENGTHS.filter((n) => n >= days.min && n <= days.max).map((n) =>
                button(fr.accueil.jours(n), () => ctx.setUi({ dureeChoisie: n }), {
                  variant: n === chosen ? 'primary' : 'secondary',
                  focusKey: `duree-${n}`,
                }),
              ),
            ),
            stepper({
              id: 'duree',
              label: fr.accueil.dureeExacte,
              icon: '📅',
              value: chosen,
              min: days.min,
              max: days.max,
              format: fr.accueil.jours,
              onChange: (n) => ctx.setUi({ dureeChoisie: n }),
            }),
            button(
              fr.commun.commencer,
              () => {
                ctx.click('commencer');
                ctx.startGame(chosen);
              },
              { large: true, focusKey: 'commencer' },
            ),
          );

    return h(
      'section',
      { class: 'card card--accueil' },
      h('h1', { class: 'titre-jeu' }, `🍋 ${fr.jeu.titre}`),
      h('p', null, fr.jeu.accroche),
      picker ??
        h(
          'div',
          { class: 'accueil__boutons' },
          saved
            ? button(fr.accueil.continuer(saved.day, saved.totalDays), () => ctx.resume(), {
                large: true,
                focusKey: 'continuer',
              })
            : null,
          button(
            fr.commun.nouvellePartie,
            () => {
              ctx.click('nouvelle-partie');
              ctx.setUi({ dureeChoisie: days.default });
            },
            {
              large: !saved,
              variant: saved ? 'secondary' : 'primary',
              focusKey: 'nouvelle-partie',
            },
          ),
          button(
            fr.commun.commentJouer,
            () => ctx.setUi({ aideOuverte: !ctx.state.ui.aideOuverte }),
            { variant: 'secondary', focusKey: 'aide' },
          ),
          button(
            fr.accueil.conseils(ctx.state.ui.conseils),
            () => ctx.setUi({ conseils: !ctx.state.ui.conseils }),
            { variant: 'ghost', focusKey: 'conseils' },
          ),
        ),
      help,
      chosen === null ? mascot(fr.accueil.bienvenue) : null,
    );
  },
};
