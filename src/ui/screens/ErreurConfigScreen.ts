import type { ConfigIssue } from '../../config/loadConfig';
import { fr } from '../../i18n/fr';

/** Shown instead of the game when config/game-config.json is invalid (spec §10). */
export function renderErreurConfig(issues: readonly ConfigIssue[]): HTMLElement {
  const card = document.createElement('section');
  card.className = 'card card--erreur';
  card.setAttribute('role', 'alert');

  const title = document.createElement('h1');
  title.textContent = fr.erreurConfig.titre;

  const intro = document.createElement('p');
  intro.textContent = fr.erreurConfig.intro;

  const list = document.createElement('ul');
  list.className = 'liste-erreurs';
  for (const issue of issues) {
    const item = document.createElement('li');
    if (issue.path) {
      const path = document.createElement('code');
      path.textContent = issue.path;
      item.append(path, ' : ');
    }
    item.append(issue.message);
    list.append(item);
  }

  const hint = document.createElement('p');
  hint.textContent = fr.erreurConfig.conseil;

  card.append(title, intro, list, hint);
  return card;
}
