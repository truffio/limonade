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
        ),
      chosen === null
        ? h(
            'details',
            { class: 'reglages' },
            h('summary', null, `⚙️ ${fr.accueil.reglages}`),
            h(
              'div',
              { class: 'reglages__contenu' },
              button(
                fr.accueil.son(ctx.state.ui.son),
                () => ctx.setUi({ son: !ctx.state.ui.son }),
                { variant: 'secondary', focusKey: 'reglage-son' },
              ),
              button(
                fr.accueil.musique(ctx.state.ui.musique),
                () => ctx.setUi({ musique: !ctx.state.ui.musique }),
                { variant: 'secondary', focusKey: 'reglage-musique', disabled: !ctx.state.ui.son },
              ),
              stepper({
                id: 'volume',
                label: fr.accueil.volume,
                icon: '🔉',
                value: ctx.state.ui.volume,
                min: 1,
                max: 5,
                format: (v) => '●'.repeat(v) + '○'.repeat(5 - v),
                onChange: (v) => ctx.setUi({ volume: v }),
              }),
              button(
                fr.accueil.conseils(ctx.state.ui.conseils),
                () => ctx.setUi({ conseils: !ctx.state.ui.conseils }),
                { variant: 'secondary', focusKey: 'conseils' },
              ),
            ),
          )
        : null,
      help,
      chosen === null ? mascot(fr.accueil.bienvenue) : null,
    );
  },
};
