import { fr } from '../../i18n/fr';
import type { Screen } from './types';

export const AccueilScreen: Screen = {
  render(ctx) {
    const card = document.createElement('section');
    card.className = 'card card--accueil';

    const title = document.createElement('h1');
    title.className = 'titre-jeu';
    title.textContent = `🍋 ${fr.jeu.titre}`;

    const tagline = document.createElement('p');
    tagline.textContent = fr.jeu.accroche;

    const start = document.createElement('button');
    start.className = 'btn btn--primary btn--large';
    start.textContent = fr.commun.nouvellePartie;
    start.addEventListener('click', () => {
      ctx.click('nouvelle-partie');
      ctx.goTo('meteo');
    });

    card.append(title, tagline, start);
    return card;
  },
};
