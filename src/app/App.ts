import type { GameConfig } from '../config/schema';
import { finishDay, goToPhase } from '../core/actions';
import type { ActionResult, GameState, Phase } from '../core/types';
import { newGame } from '../core/game';
import { fr } from '../i18n/fr';
import { renderRecipePanel, RECIPE_SCREENS } from '../ui/hud/RecipePanel';
import { renderStockPanel, STOCK_SCREENS } from '../ui/hud/StockPanel';
import { renderTopBar } from '../ui/hud/TopBar';
import { screens } from '../ui/screens';
import type { AppState, ScreenContext, ScreenId } from '../ui/screens/types';
import { h } from '../ui/dom';
import { EventBus, type GameEvents } from './events';
import {
  clearSave,
  DEFAULT_PREFERENCES,
  loadGame,
  loadPreferences,
  type Preferences,
  saveGame,
  savePreferences,
} from './persistence';
import { createStore, type Store } from './store';

export const PHASE_SCREEN: Record<Phase, ScreenId> = {
  METEO: 'meteo',
  MAGASIN: 'magasin',
  RECETTE: 'recette',
  JOURNEE: 'journee',
  BILAN: 'bilan',
  FIN: 'fin',
};

const SCREEN_PHASE: Partial<Record<ScreenId, Phase>> = {
  meteo: 'METEO',
  magasin: 'MAGASIN',
  recette: 'RECETTE',
};

/** Screens without the top bar: the title screen, and the day itself, which shows live counters. */
const WITHOUT_TOP_BAR: ReadonlySet<ScreenId> = new Set(['accueil', 'journee']);

const TOAST_MS = 2500;

export function initialState(preferences: Preferences = DEFAULT_PREFERENCES): AppState {
  return {
    screen: 'accueil',
    game: null,
    cart: {},
    ui: { dureeChoisie: null, aideOuverte: false, explicationOuverte: false, ...preferences },
  };
}

function preferencesOf(state: AppState): Preferences {
  const { conseils, son, musique, volume } = state.ui;
  return { conseils, son, musique, volume };
}

export interface AppOptions {
  /** Identifies the config; saves made with another config are ignored. */
  configFingerprint?: string;
}

/** Wires the core, the screens and the event bus together (ARCHITECTURE.md §4). */
export class App {
  readonly events = new EventBus<GameEvents>();
  readonly store: Store<AppState>;
  private cleanups: (() => void)[] = [];
  private readonly screenRoot = h('div', { class: 'ui__ecran' });
  private readonly toastRoot = h('div', { class: 'ui__toasts', 'aria-live': 'polite' });
  private readonly configFingerprint: string;
  private lastScreen: ScreenId | null = null;

  constructor(
    private readonly uiRoot: HTMLElement,
    readonly config: GameConfig,
    options: AppOptions = {},
  ) {
    this.configFingerprint = options.configFingerprint ?? 'dev';
    this.store = createStore(initialState(loadPreferences()));
  }

  start(): void {
    this.uiRoot.replaceChildren(this.screenRoot, this.toastRoot);
    this.store.subscribe((state) => {
      this.persist(state);
      this.render();
    });
    this.render();
  }

  /** The saved game that can be continued, if any (only while no game is open). */
  savedGame(): GameState | null {
    return this.store.get().game ? null : loadGame(this.configFingerprint);
  }

  /** Continues the saved game. A day interrupted mid-replay resumes on its report. */
  resume(): void {
    const saved = loadGame(this.configFingerprint);
    if (!saved) return;
    let game = saved;
    if (game.phase === 'JOURNEE') {
      const finished = finishDay(game);
      if (finished.ok) game = finished.state;
    }
    const screen = PHASE_SCREEN[game.phase];
    this.store.set({ ...initialState(preferencesOf(this.store.get())), screen, game });
    this.events.emit('screen_change', { from: 'accueil', to: screen });
  }

  private persist(state: AppState): void {
    savePreferences(preferencesOf(state));
    if (!state.game) return;
    if (state.game.phase === 'FIN') clearSave();
    else saveGame(state.game, this.configFingerprint);
  }

  goTo(screen: ScreenId): void {
    const state = this.store.get();
    const phase = SCREEN_PHASE[screen];
    if (phase && state.game && state.game.phase !== phase) {
      this.act((game) => goToPhase(game, phase));
      return;
    }
    this.setScreen(screen);
  }

  startGame(days: number): void {
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) | 0;
    const game = newGame(this.config, { seed, days });
    this.store.set({
      ...initialState(preferencesOf(this.store.get())),
      screen: PHASE_SCREEN[game.phase],
      game,
    });
    this.events.emit('screen_change', { from: 'accueil', to: PHASE_SCREEN[game.phase] });
  }

  act(action: (game: GameState) => ActionResult, successMessage?: string): boolean {
    const state = this.store.get();
    if (!state.game) return false;
    const result = action(state.game);
    if (!result.ok) {
      this.toast(fr.erreurs.actions[result.error], 'erreur');
      this.events.emit('action_refused', { error: result.error });
      return false;
    }
    const screen =
      state.screen === 'historique' && result.state.phase === state.game.phase
        ? 'historique'
        : PHASE_SCREEN[result.state.phase];
    this.store.set({ ...state, game: result.state, screen });
    if (screen !== state.screen)
      this.events.emit('screen_change', { from: state.screen, to: screen });
    if (successMessage) this.toast(successMessage, 'ok');
    return true;
  }

  toast(text: string, tone: 'ok' | 'erreur' = 'ok'): void {
    const el = h(
      'div',
      { class: `toast toast--${tone}`, role: tone === 'erreur' ? 'alert' : 'status' },
      text,
    );
    this.toastRoot.replaceChildren(el);
    setTimeout(() => el.remove(), TOAST_MS);
  }

  private setScreen(screen: ScreenId): void {
    const state = this.store.get();
    if (state.screen === screen) return;
    this.store.set({ ...state, screen });
    this.events.emit('screen_change', { from: state.screen, to: screen });
  }

  private context(): ScreenContext {
    const state = this.store.get();
    return {
      state,
      cfg: this.config,
      events: this.events,
      game: () => {
        if (!state.game) throw new Error('No game in progress');
        return state.game;
      },
      goTo: (screen) => this.goTo(screen),
      act: (action, message) => this.act(action, message),
      setCart: (cart) => this.store.set({ ...this.store.get(), cart }),
      setUi: (patch) => {
        const current = this.store.get();
        this.store.set({ ...current, ui: { ...current.ui, ...patch } });
      },
      startGame: (days) => this.startGame(days),
      savedGame: () => this.savedGame(),
      resume: () => this.resume(),
      quit: () => this.store.set(initialState(preferencesOf(this.store.get()))),
      toast: (text, tone) => this.toast(text, tone),
      click: (id) => this.events.emit('button_click', { id }),
      onCleanup: (fn) => this.cleanups.push(fn),
    };
  }

  private render(): void {
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups = [];

    // Keep keyboard focus on the same control across re-renders (steppers re-render on each click).
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset['focus']
        : undefined;

    const state = this.store.get();
    const ctx = this.context();
    const content = screens[state.screen].render(ctx);
    const topBar = state.game && !WITHOUT_TOP_BAR.has(state.screen) ? renderTopBar(ctx) : null;
    // Left side: the stock (#45) and, while planning, the recipe summary (#50).
    const side =
      state.game && STOCK_SCREENS.has(state.screen)
        ? h(
            'div',
            { class: 'cote' },
            renderStockPanel(ctx),
            RECIPE_SCREENS.has(state.screen) ? renderRecipePanel(ctx) : null,
          )
        : null;

    // Animate only when arriving on a screen, not on every re-render of the same one.
    const entering = state.screen !== this.lastScreen;
    this.lastScreen = state.screen;
    this.screenRoot.replaceChildren(
      ...(topBar ? [topBar] : []),
      h(
        'div',
        {
          class: `ecran ecran--${state.screen}${side ? ' ecran--stock' : ''}${entering ? ' ecran--entree' : ''}`,
        },
        side,
        content,
      ),
    );
    this.uiRoot.dataset['screen'] = state.screen;

    if (focused) {
      const target = this.screenRoot.querySelector<HTMLElement>(`[data-focus="${focused}"]`);
      if (target && !(target as HTMLButtonElement).disabled) target.focus();
    }
  }
}
