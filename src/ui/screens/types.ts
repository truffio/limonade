import type { EventBus, GameEvents } from '../../app/events';
import type { GameConfig } from '../../config/schema';
import type { Cart } from '../../core/actions';
import type { ActionResult, GameState } from '../../core/types';

export type ScreenId =
  'accueil' | 'meteo' | 'magasin' | 'recette' | 'journee' | 'bilan' | 'historique' | 'fin';

/** Screen-only state that is not part of the game rules. */
export interface UiState {
  /** Days chosen in the new-game picker, or null while it is closed. */
  dureeChoisie: number | null;
  aideOuverte: boolean;
  explicationOuverte: boolean;
}

export interface AppState {
  screen: ScreenId;
  game: GameState | null;
  cart: Cart;
  ui: UiState;
}

export interface ScreenContext {
  readonly state: AppState;
  readonly cfg: GameConfig;
  /** The current game; only call on screens that are shown during a game. */
  game(): GameState;
  goTo(screen: ScreenId): void;
  /** Applies a core action; on refusal shows the French reason and returns false. */
  act(action: (game: GameState) => ActionResult, successMessage?: string): boolean;
  setCart(cart: Cart): void;
  setUi(patch: Partial<UiState>): void;
  startGame(days: number): void;
  quit(): void;
  toast(text: string, tone?: 'ok' | 'erreur'): void;
  /** Publishes a UI click for listeners such as the future sound module. */
  click(id: string): void;
  /** Registers teardown (timers, players) run before the next render. */
  onCleanup(fn: () => void): void;
  /** Lets the journée screen publish its replay to the scene and sound listeners. */
  readonly events: EventBus<GameEvents>;
}

export interface Screen {
  render(ctx: ScreenContext): HTMLElement;
}
