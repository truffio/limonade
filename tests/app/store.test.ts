import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/app/store';

describe('createStore', () => {
  it('notifies subscribers with the new state', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ count: 1 });

    expect(store.get()).toEqual({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 1 });
  });

  it('does not notify when the same state object is set again', () => {
    const initial = { count: 0 };
    const store = createStore(initial);
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(initial);

    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const store = createStore(0);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.set(1);

    expect(listener).not.toHaveBeenCalled();
  });
});
