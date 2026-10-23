import type { ActionError, DayEvent } from '../core/types';
import type { ScreenId } from '../ui/screens/types';

/**
 * Events published by the UI and the day player. Other modules (the 3D scene,
 * the future sound epic in docs/epics/EPIC-son.md) subscribe without touching game code.
 */
export interface GameEvents {
  screen_change: { from: ScreenId | null; to: ScreenId };
  button_click: { id: string };
  action_refused: { error: ActionError };
  purchase_confirmed: { cost: number };
  stand_open: { day: number };
  /** One event of the day's replay, at the moment it is shown. */
  day_event: { event: DayEvent };
  day_progress: { t: number };
  day_end: { skipped: boolean; profit: number };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object> {
  private readonly handlers: { [K in keyof E]?: Set<Handler<E[K]>> } = {};

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    const set = (this.handlers[type] ??= new Set<Handler<E[K]>>());
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers[type];
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}
