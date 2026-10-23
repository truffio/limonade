import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './styles/main.css';

import { App } from './app/App';
import { SceneManager } from './scene/SceneManager';
import { fr } from './i18n/fr';

function getElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el;
}

const sceneRoot = getElement('scene');
const uiRoot = getElement('ui');

try {
  new SceneManager(sceneRoot).start();
} catch (error) {
  // Old devices without WebGL can still play: the UI works without the 3D scene.
  console.warn('WebGL unavailable, running without 3D scene', error);
  sceneRoot.classList.add('scene--fallback');
  sceneRoot.textContent = fr.erreurs.webgl;
}

new App(uiRoot).start();
