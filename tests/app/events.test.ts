import { describe, expect, it, vi } from 'vitest';
import { EventBus, type GameEvents } from '../../src/app/events';

describe('EventBus', () => {
  it('delivers payloads only to handlers of that event type', () => {
    const bus = new EventBus<GameEvents>();
    const onClick = vi.fn();
    const onScreen = vi.fn();
    bus.on('button_click', onClick);
    bus.on('screen_change', onScreen);

    bus.emit('button_click', { id: 'nouvelle-partie' });

    expect(onClick).toHaveBeenCalledWith({ id: 'nouvelle-partie' });
    expect(onScreen).not.toHaveBeenCalled();
  });

  it('stops delivering after the returned unsubscribe is called', () => {
    const bus = new EventBus<GameEvents>();
    const handler = vi.fn();
    const off = bus.on('button_click', handler);

    off();
    bus.emit('button_click', { id: 'x' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores events with no handlers', () => {
    const bus = new EventBus<GameEvents>();
    expect(() => bus.emit('screen_change', { from: null, to: 'accueil' })).not.toThrow();
  });
});
