import type { ScreenId } from '../ui/screens/types';

/**
 * Events published by the UI and the day player. Other modules (e.g. the
 * future sound epic, docs/epics/EPIC-son.md) subscribe without touching game code.
 */
export interface GameEvents {
  screen_change: { from: ScreenId | null; to: ScreenId };
  button_click: { id: string };
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
