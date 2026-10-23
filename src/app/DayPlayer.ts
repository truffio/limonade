import type { DayEvent } from '../core/types';

/** Real-time length of a selling day at normal speed. */
export const DAY_DURATION_MS = 30_000;

type Listener<T> = (value: T) => void;

/**
 * Replays a simulated day (ARCHITECTURE.md §9.3): the core has already decided
 * everything; this only releases the events over time so the scene and the
 * counters can show them. Skipping jumps to the end without replaying events.
 */
export class DayPlayer {
  private t = 0;
  private next = 0;
  private speed = 1;
  private frame: number | null = null;
  private lastTime: number | null = null;
  private finished = false;
  private readonly eventListeners = new Set<Listener<DayEvent>>();
  private readonly progressListeners = new Set<Listener<number>>();
  private readonly endListeners = new Set<Listener<{ skipped: boolean }>>();

  constructor(
    private readonly events: readonly DayEvent[],
    private readonly durationMs = DAY_DURATION_MS,
  ) {}

  get progress(): number {
    return this.t;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  onEvent(listener: Listener<DayEvent>): void {
    this.eventListeners.add(listener);
  }

  onProgress(listener: Listener<number>): void {
    this.progressListeners.add(listener);
  }

  onEnd(listener: Listener<{ skipped: boolean }>): void {
    this.endListeners.add(listener);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  /** Starts the animation loop (browser only; tests call `advance`). */
  start(): void {
    const tick = (time: number) => {
      if (this.finished) return;
      if (this.lastTime !== null) this.advance(time - this.lastTime);
      this.lastTime = time;
      if (!this.finished) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** Moves the replay forward by `ms` of real time at the current speed. */
  advance(ms: number): void {
    if (this.finished) return;
    this.t = Math.min(1, this.t + (ms * this.speed) / this.durationMs);
    while (this.next < this.events.length) {
      const event = this.events[this.next];
      if (!event || event.t > this.t) break;
      this.next++;
      for (const listener of this.eventListeners) listener(event);
    }
    for (const listener of this.progressListeners) listener(this.t);
    if (this.t >= 1) this.end(false);
  }

  skip(): void {
    if (this.finished) return;
    this.t = 1;
    this.next = this.events.length;
    for (const listener of this.progressListeners) listener(1);
    this.end(true);
  }

  dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.finished = true;
  }

  private end(skipped: boolean): void {
    this.finished = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    for (const listener of this.endListeners) listener({ skipped });
  }
}
