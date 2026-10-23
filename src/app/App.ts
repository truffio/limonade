import { screens } from '../ui/screens';
import type { ScreenContext, ScreenId } from '../ui/screens/types';
import { EventBus, type GameEvents } from './events';
import { createStore } from './store';

interface AppState {
  screen: ScreenId;
}

/** Wires the UI screens together. Core and scene wiring arrive in later milestones. */
export class App {
  readonly events = new EventBus<GameEvents>();
  private readonly store = createStore<AppState>({ screen: 'accueil' });
  private readonly ctx: ScreenContext = {
    goTo: (screen) => this.goTo(screen),
    click: (id) => this.events.emit('button_click', { id }),
  };

  constructor(private readonly uiRoot: HTMLElement) {}

  start(): void {
    this.store.subscribe((state) => this.render(state.screen));
    this.render(this.store.get().screen);
  }

  goTo(screen: ScreenId): void {
    const from = this.store.get().screen;
    this.store.set({ ...this.store.get(), screen });
    this.events.emit('screen_change', { from, to: screen });
  }

  private render(screen: ScreenId): void {
    this.uiRoot.replaceChildren(screens[screen].render(this.ctx));
    this.uiRoot.dataset['screen'] = screen;
  }
}
