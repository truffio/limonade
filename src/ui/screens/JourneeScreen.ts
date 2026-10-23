import { DayPlayer } from '../../app/DayPlayer';
import { finishDay } from '../../core/actions';
import type { DayEvent } from '../../core/types';
import { hour, money } from '../../i18n/format';
import { fr } from '../../i18n/fr';
import { button } from '../components';
import { h } from '../dom';
import type { Screen } from './types';

/** How many recent customer reactions stay on screen. */
const FEED_LENGTH = 10;

function reaction(event: DayEvent): string | null {
  if (event.type !== 'visitor') return null;
  return event.outcome === 'buy' ? fr.journee.reactions.buy : fr.journee.reactions[event.reason];
}

function announcement(event: DayEvent): string | null {
  switch (event.type) {
    case 'rain_start':
      return fr.journee.pluieCommence;
    case 'rain_stop':
      return fr.journee.pluieFinie;
    case 'sold_out':
      return event.what === 'limonade' ? fr.journee.plusDeLimonade : fr.journee.plusDeGobelets;
    default:
      return null;
  }
}

/**
 * Live view of the selling day (spec §6): the day is already simulated; the
 * player releases its events over time while the counters update.
 */
export const JourneeScreen: Screen = {
  render(ctx) {
    const game = ctx.game();
    const day = game.currentDay;
    if (!day) return h('p', null, '…');
    const { record, events } = day;
    const startCash = game.cash - record.revenue;

    const clock = h('div', { class: 'journee__horloge' }, hour(0));
    const bar = h('div', { class: 'journee__barre-remplie', style: 'width:0%' });
    const progress = h(
      'div',
      {
        class: 'journee__barre',
        role: 'progressbar',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': 0,
      },
      bar,
    );
    const sold = h('strong', null, '0');
    const visitors = h('strong', null, '0');
    const cash = h('strong', null, money(startCash));
    const feed = h('div', { class: 'journee__clients', 'aria-hidden': 'true' });
    const news = h('div', { class: 'journee__annonce', 'aria-live': 'polite' });

    let soldCount = 0;
    let visitorCount = 0;
    const player = new DayPlayer(events);
    ctx.onCleanup(() => player.dispose());

    player.onEvent((event) => {
      ctx.events.emit('day_event', { event });
      const face = reaction(event);
      if (face) {
        visitorCount++;
        visitors.textContent = String(visitorCount);
        if (event.type === 'visitor' && event.outcome === 'buy') {
          soldCount++;
          sold.textContent = String(soldCount);
          cash.textContent = money(startCash + soldCount * record.plan.pricePerCup);
        }
        feed.append(h('span', { class: 'journee__visage' }, face));
        while (feed.childElementCount > FEED_LENGTH) feed.firstElementChild?.remove();
      }
      const text = announcement(event);
      if (text) news.textContent = text;
    });

    player.onProgress((t) => {
      ctx.events.emit('day_progress', { t });
      clock.textContent = hour(t);
      bar.style.width = `${Math.round(t * 100)}%`;
      progress.setAttribute('aria-valuenow', String(Math.round(t * 100)));
    });

    player.onEnd(({ skipped }) => {
      ctx.events.emit('day_end', { skipped, profit: record.profit });
      ctx.act(finishDay);
    });

    const speedButtons = h(
      'div',
      { class: 'journee__vitesse' },
      button(fr.journee.vitesse.normale, () => player.setSpeed(1), {
        variant: 'secondary',
        label: 'Vitesse normale',
      }),
      button(fr.journee.vitesse.rapide, () => player.setSpeed(2), {
        variant: 'secondary',
        label: 'Vitesse rapide',
      }),
      button(fr.journee.passer, () => player.skip(), { variant: 'primary', focusKey: 'passer' }),
    );

    // Start on the next frame so the screen is in the document first.
    queueMicrotask(() => {
      if (typeof requestAnimationFrame === 'function') player.start();
    });

    return h(
      'section',
      { class: 'journee', 'aria-label': fr.ecrans.journee },
      h('h1', { class: 'sr-only' }, fr.ecrans.journee),
      h('div', { class: 'journee__haut' }, clock, progress),
      h(
        'div',
        { class: 'journee__compteurs' },
        h('span', null, `🧑‍🤝‍🧑 ${fr.journee.clients} : `, visitors),
        h('span', null, `🥤 ${fr.journee.vendus} : `, sold),
        h('span', null, '💰 ', cash),
      ),
      news,
      feed,
      speedButtons,
    );
  },
};
