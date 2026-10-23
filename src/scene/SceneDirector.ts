import type { App } from '../app/App';
import { count } from '../core/inventory';
import type { DayEvent, GameState } from '../core/types';
import { PLANNING_PHASES } from '../core/types';
import { money } from '../i18n/format';
import { fr } from '../i18n/fr';
import type { AppState, ScreenId } from '../ui/screens/types';
import type { GameScene } from './GameScene';

/** Screens that show a side panel on wide screens; the stand moves left to stay visible. */
const PANEL_SCREENS: ReadonlySet<ScreenId> = new Set([
  'meteo',
  'magasin',
  'recette',
  'bilan',
  'historique',
  'fin',
]);
/** Right panel width plus its margins (see `.panneau` in main.css). */
const PANEL_WIDTH = 672;
const MAX_PANEL_SHARE = 0.7;
const WIDE_SCREEN = 900;
const DAY_PANEL_SHARE = 0.12;

/** Moment shown while planning: early morning, before opening. */
const MORNING = 0.05;

/**
 * Keeps the 3D scene in step with the game: forecast weather while planning,
 * the replayed day while selling, evening for the report (ARCHITECTURE.md §9.3).
 */
export class SceneDirector {
  private dayKey = '';
  private servingsMade = 0;
  private servingsLeft = 0;
  private cupsLeft = 0;
  private dayStock = { lemons: 0, sugar: 0, ice: 0 };

  constructor(
    private readonly app: App,
    private readonly view: GameScene,
  ) {
    app.store.subscribe((state) => this.sync(state));
    app.events.on('day_event', ({ event }) => this.onDayEvent(event));
    app.events.on('day_progress', ({ t }) => this.view.setTime(t));
    app.events.on('day_end', () => this.view.clearCustomers());
    window.addEventListener('resize', () => this.updateFocus(this.app.store.get().screen));
    this.sync(app.store.get());
  }

  private updateFocus(screen: ScreenId): void {
    const width = window.innerWidth;
    const x =
      PANEL_SCREENS.has(screen) && width >= WIDE_SCREEN
        ? Math.min(MAX_PANEL_SHARE, PANEL_WIDTH / width)
        : 0;
    // During the day, the live counters cover the bottom of the screen.
    const y = screen === 'journee' ? DAY_PANEL_SHARE : 0;
    this.view.setFocusShift(x, y);
  }

  private sync(state: AppState): void {
    this.updateFocus(state.screen);
    const game = state.game;
    if (!game) {
      this.dayKey = '';
      this.view.clearCustomers();
      this.view.setSky({ t: 0.15, cloud: 'soleil', raining: false });
      this.view.setStock({ lemons: 9, sugar: 20, ice: 60, cups: 40, pitcherLevel: 1 });
      this.view.setPrice('');
      return;
    }

    this.view.setPrice(money(game.plan.pricePerCup));

    if (PLANNING_PHASES.includes(game.phase)) {
      this.dayKey = '';
      const f = game.forecast;
      this.view.setSky({ t: MORNING, cloud: f.cloud, raining: f.rainChance >= 0.5 });
      this.showInventory(game, game.plan.pitchers > 0 ? 1 : 0);
      return;
    }

    if (game.phase === 'JOURNEE' && game.currentDay) {
      const key = `${game.day}`;
      if (key !== this.dayKey) this.startDay(game);
      return;
    }

    // Report, history, end: evening light, the weather that really happened.
    this.dayKey = '';
    const last = game.history[game.history.length - 1];
    const actual = last?.actual;
    this.view.clearCustomers();
    this.view.setSky({
      t: 1,
      cloud: actual?.cloud ?? 'soleil',
      raining: actual?.rainSlots.includes('soir') ?? false,
    });
    if (last) this.view.setPrice(money(last.plan.pricePerCup));
    this.showInventory(game, 0);
  }

  private showInventory(game: GameState, pitcherLevel: number): void {
    this.view.setStock({
      lemons: count(game.inventory, 'lemons'),
      sugar: count(game.inventory, 'sugar'),
      ice: count(game.inventory, 'ice'),
      cups: count(game.inventory, 'cups'),
      pitcherLevel,
    });
  }

  private startDay(game: GameState): void {
    const day = game.currentDay;
    if (!day) return;
    const r = day.record;
    this.dayKey = `${game.day}`;
    this.servingsMade = r.servingsMade;
    this.servingsLeft = r.servingsMade;
    this.cupsLeft = r.inventoryAfter.cups + r.cupsSold;
    // Ingredients are already in the pitchers; ice left over is what melts tonight.
    this.dayStock = {
      lemons: r.inventoryAfter.lemons,
      sugar: r.inventoryAfter.sugar,
      ice: r.waste.iceMelted,
    };
    this.view.clearCustomers();
    this.view.setSky({ t: 0, cloud: r.actual.cloud, raining: false });
    this.view.setPrice(money(r.plan.pricePerCup));
    this.showDayStock();
  }

  private showDayStock(): void {
    this.view.setStock({
      ...this.dayStock,
      cups: this.cupsLeft,
      pitcherLevel: this.servingsMade > 0 ? this.servingsLeft / this.servingsMade : 0,
    });
  }

  private onDayEvent(event: DayEvent): void {
    const game = this.app.store.get().game;
    const record = game?.currentDay?.record;
    if (!record) return;
    const actual = record.actual;

    switch (event.type) {
      case 'rain_start':
      case 'rain_stop':
        this.view.setSky({ cloud: actual.cloud, raining: event.type === 'rain_start' });
        return;
      case 'sold_out':
        return;
      case 'visitor': {
        const bought = event.outcome === 'buy';
        this.view.visit({
          reaction: bought ? fr.journee.reactions.buy : fr.journee.reactions[event.reason],
          bought,
        });
        if (bought) {
          this.view.sale(`+${money(record.plan.pricePerCup)}`);
          this.servingsLeft = Math.max(0, this.servingsLeft - 1);
          this.cupsLeft = Math.max(0, this.cupsLeft - 1);
          this.showDayStock();
        }
      }
    }
  }
}
