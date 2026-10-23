import { fr } from '../../i18n/fr';
import { h } from '../dom';
import type { ScreenContext, ScreenId } from '../screens/types';
import { dayStartStock, gauge, gaugesFor, stockGauges } from './stockGauges';

/** Screens with the stock pane, top left: planning, the selling day (live) and the report. */
export const STOCK_SCREENS: ReadonlySet<ScreenId> = new Set(['preparation', 'journee', 'bilan']);

interface Line {
  el: HTMLElement;
  /** Redraws the number and the bar for a new count. */
  set(count: number, full: number, low: boolean): void;
}

function line(icon: string, name: string, key: string): Line {
  const number = h('strong', { class: 'stock__nombre' });
  const fill = h('div', { class: 'stock__remplissage' });
  const meter = h('div', { class: 'stock__jauge', role: 'meter', 'aria-valuemin': 0 }, fill);
  const el = h(
    'li',
    { class: 'stock__ligne', 'data-supply': key },
    h(
      'div',
      { class: 'stock__entete' },
      h('span', { class: 'stock__icone', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'stock__nom' }, name),
      number,
    ),
    meter,
  );
  return {
    el,
    set(count, full, low) {
      number.textContent = String(count);
      fill.style.width = `${Math.round(Math.min(1, full > 0 ? count / full : 0) * 100)}%`;
      meter.setAttribute('aria-valuemax', String(full));
      meter.setAttribute('aria-valuenow', String(Math.min(count, full)));
      meter.setAttribute('aria-label', `${name} : ${count}`);
      el.classList.toggle('stock__ligne--bas', low);
    },
  };
}

/**
 * The player's supplies: a number and a bar per supply, nothing else.
 * During the selling day it follows the replay live: each sale takes one cup
 * and one glass of lemonade.
 */
export function renderStockPanel(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const lines = new Map<string, Line>();
  const list = h('ul', { class: 'stock__liste' });

  const day = game.phase === 'JOURNEE' ? game.currentDay : null;
  const start = day ? dayStartStock(day.record) : null;
  const gauges = start ? gaugesFor(start.supplies, game, ctx.cfg) : stockGauges(game, ctx.cfg);

  for (const g of gauges) {
    const info = fr.fournitures[g.supply];
    const l = line(info.icone, info.nom, g.supply);
    l.set(g.count, g.full, g.low);
    lines.set(g.supply, l);
    list.append(l.el);
  }

  if (start) {
    const made = start.servings;
    const glasses = line(fr.hud.verresPrets.icone, fr.hud.verresPrets.nom, 'lemonade');
    glasses.set(made, made, made === 0);
    list.prepend(glasses.el);

    let cups = start.supplies.cups;
    let servings = made;
    const cupsLine = lines.get('cups');
    const off = ctx.events.on('day_event', ({ event }) => {
      if (event.type !== 'visitor' || event.outcome !== 'buy') return;
      cups = Math.max(0, cups - 1);
      servings = Math.max(0, servings - 1);
      glasses.set(servings, made, servings === 0);
      const g = gauge('cups', cups, game, ctx.cfg);
      cupsLine?.set(g.count, g.full, g.low);
    });
    ctx.onCleanup(off);
  }

  return h(
    'aside',
    { class: 'stock carte-cote', 'aria-labelledby': 'stock-titre' },
    h('h2', { class: 'stock__titre', id: 'stock-titre' }, `📦 ${fr.hud.stock}`),
    list,
  );
}
