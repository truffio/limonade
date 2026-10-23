import type { GameConfig } from '../config/schema';
import { goToPhase } from '../core/actions';
import type { ActionResult, GameState, Phase } from '../core/types';
import { newGame } from '../core/game';
import { fr } from '../i18n/fr';
import { renderTopBar } from '../ui/hud/TopBar';
import { screens } from '../ui/screens';
import type { AppState, ScreenContext, ScreenId } from '../ui/screens/types';
import { h } from '../ui/dom';
import { EventBus, type GameEvents } from './events';
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

export function initialState(): AppState {
  return {
    screen: 'accueil',
    game: null,
    cart: {},
    ui: { dureeChoisie: null, aideOuverte: false, explicationOuverte: false },
  };
}

/** Wires the core, the screens and the event bus together (ARCHITECTURE.md §4). */
export class App {
  readonly events = new EventBus<GameEvents>();
  readonly store: Store<AppState>;
  private cleanups: (() => void)[] = [];
  private readonly screenRoot = h('div', { class: 'ui__ecran' });
  private readonly toastRoot = h('div', { class: 'ui__toasts', 'aria-live': 'polite' });

  constructor(
    private readonly uiRoot: HTMLElement,
    readonly config: GameConfig,
    initial: AppState = initialState(),
  ) {
    this.store = createStore(initial);
  }

  start(): void {
    this.uiRoot.replaceChildren(this.screenRoot, this.toastRoot);
    this.store.subscribe(() => this.render());
    this.render();
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
      ...initialState(),
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
      quit: () => this.store.set(initialState()),
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

    this.screenRoot.replaceChildren(
      ...(topBar ? [topBar] : []),
      h('div', { class: `ecran ecran--${state.screen}` }, content),
    );
    this.uiRoot.dataset['screen'] = state.screen;

    if (focused) {
      const target = this.screenRoot.querySelector<HTMLElement>(`[data-focus="${focused}"]`);
      if (target && !(target as HTMLButtonElement).disabled) target.focus();
    }
  }
}
