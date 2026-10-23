import { fr } from '../../i18n/fr';
import type { Screen, ScreenId } from './types';

/**
 * Temporary screen used until each real screen is built (milestone 5).
 * Shows the screen title and a button to the next step of the flow.
 */
export function placeholderScreen(id: ScreenId, next: ScreenId): Screen {
  return {
    render(ctx) {
      const card = document.createElement('section');
      card.className = 'card';

      const title = document.createElement('h1');
      title.textContent = fr.ecrans[id];

      const body = document.createElement('p');
      body.textContent = fr.commun.bientot;

      const button = document.createElement('button');
      button.className = 'btn btn--primary';
      button.textContent = fr.commun.suivant;
      button.addEventListener('click', () => {
        ctx.click(`suivant:${id}`);
        ctx.goTo(next);
      });

      card.append(title, body, button);
      return card;
    },
  };
}
