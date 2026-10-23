import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './styles/main.css';

import rawConfig from '../config/game-config.json';
import { App } from './app/App';
import { describeIssue, loadConfig } from './config/loadConfig';
import { fr } from './i18n/fr';
import { GameScene } from './scene/GameScene';
import { SceneDirector } from './scene/SceneDirector';
import { SceneManager } from './scene/SceneManager';
import { renderErreurConfig } from './ui/screens/ErreurConfigScreen';

function getElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} in index.html`);
  return el;
}

const sceneRoot = getElement('scene');
const uiRoot = getElement('ui');

let gameScene: GameScene | null = null;
try {
  const manager = new SceneManager(sceneRoot);
  gameScene = new GameScene(manager);
  manager.start();
} catch (error) {
  // Old devices without WebGL can still play: the UI works without the 3D scene.
  console.warn('WebGL unavailable, running without 3D scene', error);
  sceneRoot.classList.add('scene--fallback');
  sceneRoot.textContent = fr.erreurs.webgl;
}

const result = loadConfig(rawConfig);
if (result.ok) {
  const app = new App(uiRoot, result.config);
  if (gameScene) new SceneDirector(app, gameScene);
  app.start();
} else {
  console.error('Invalid config/game-config.json:\n' + result.issues.map(describeIssue).join('\n'));
  uiRoot.replaceChildren(renderErreurConfig(result.issues));
}
