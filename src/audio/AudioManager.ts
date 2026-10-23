import type { App } from '../app/App';
import type { AppState } from '../ui/screens/types';
import type { SoundId } from './sounds';
import type { SoundPlayer } from './WebAudioPlayer';

/** Shortest gap between two plays of the same sound, so a busy day never turns into noise. */
const MIN_GAP_MS: Partial<Record<SoundId, number>> = {
  pop: 40,
  tickUp: 40,
  tickDown: 40,
  ding: 120,
  hmm: 250,
  ohh: 250,
};

/** Small random pitch change for frequent sounds, in cents. */
const VARIATION: Partial<Record<SoundId, number>> = { ding: 60, pop: 40 };

/**
 * Listens to the app's events and plays the matching sounds (docs/epics/EPIC-son.md).
 * Game code never calls it: it only subscribes, so the game works the same with sound off.
 */
export class AudioManager {
  private readonly lastPlayed = new Map<SoundId, number>();
  private unlocked = false;
  private reportedDay = '';

  constructor(
    private readonly app: App,
    private readonly player: SoundPlayer,
    private readonly now: () => number = () => performance.now(),
    private readonly random: () => number = Math.random,
  ) {
    app.store.subscribe((state) => this.applySettings(state));
    this.applySettings(app.store.get());

    app.events.on('purchase_confirmed', () => this.play('purchase'));
    app.events.on('action_refused', () => this.play('bonk'));
    app.events.on('stand_open', () => this.play('open'));
    app.events.on('day_event', ({ event }) => {
      switch (event.type) {
        case 'visitor':
          if (event.outcome === 'buy') this.play('ding');
          else if (event.outcome === 'missed') this.play('ohh');
          else if (event.reason === 'TROP_CHER') this.play('hmm');
          return;
        case 'rain_start':
          this.player.setRain(true);
          return;
        case 'rain_stop':
          this.player.setRain(false);
          return;
        case 'sold_out':
          return;
      }
    });
    // Skipping the day emits no queued sounds; the report's jingle then ends the day.
    app.events.on('day_end', () => this.player.setRain(false));
    app.events.on('screen_change', ({ to }) => this.onScreen(to));
  }

  /** Browsers block audio until the player interacts: unlock on the first tap or key. */
  installUnlock(target: Pick<Document, 'addEventListener' | 'removeEventListener'>): void {
    const unlock = () => {
      this.unlocked = true;
      this.player.unlock();
      this.applySettings(this.app.store.get());
      target.removeEventListener('pointerdown', unlock);
      target.removeEventListener('keydown', unlock);
    };
    target.addEventListener('pointerdown', unlock);
    target.addEventListener('keydown', unlock);
  }

  /** Suspends audio while the tab is hidden. */
  installVisibility(doc: Pick<Document, 'addEventListener' | 'visibilityState'>): void {
    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') this.player.suspend();
      else this.player.resume();
    });
  }

  /** Clicks on any button: a soft pop, or a tick up/down for steppers. */
  installClicks(root: HTMLElement): void {
    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!target || target.disabled) return;
      const label = target.getAttribute('aria-label') ?? '';
      if (label.endsWith(': plus')) this.play('tickUp');
      else if (label.endsWith(': moins')) this.play('tickDown');
      else this.play('pop');
    });
  }

  play(id: SoundId): void {
    if (!this.unlocked) return;
    const t = this.now();
    const gap = MIN_GAP_MS[id] ?? 0;
    const last = this.lastPlayed.get(id);
    if (last !== undefined && t - last < gap) return;
    this.lastPlayed.set(id, t);
    const range = VARIATION[id] ?? 0;
    this.player.play(id, range ? (this.random() * 2 - 1) * range : 0);
  }

  private onScreen(to: AppState['screen']): void {
    const game = this.app.store.get().game;
    if (to === 'fin') {
      this.play('celebration');
      return;
    }
    if (to !== 'bilan' || !game) return;
    // One jingle per report, even when coming back from the history.
    const record = game.history[game.history.length - 1];
    const key = `${game.seed}:${record?.day ?? 0}`;
    if (!record || key === this.reportedDay) return;
    this.reportedDay = key;
    this.play(record.profit >= 0 ? 'happy' : 'sad');
  }

  private applySettings(state: AppState): void {
    const { son, musique, volume } = state.ui;
    // Volume 1..5 → gentle gain curve; muting sound also silences the music.
    this.player.setLevels(son ? (volume / 5) ** 1.5 : 0, son);
    this.player.setMusic(son && musique && this.unlocked);
  }
}
