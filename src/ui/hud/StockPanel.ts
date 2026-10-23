import { fr } from '../../i18n/fr';
import { h } from '../dom';
import type { ScreenContext, ScreenId } from '../screens/types';
import { dayStartStock, gauge, gaugesFor, stockGauges, type StockGauge } from './stockGauges';

/** Screens where the stock drives the decisions, plus the selling day where it runs down live (#45). */
export const STOCK_SCREENS: ReadonlySet<ScreenId> = new Set([
  'meteo',
  'magasin',
  'recette',
  'journee',
  'bilan',
]);

/** A warning in words, with a shorter version for the compact strip on smaller screens. */
function alert(text: string, short: string): HTMLElement {
  return h(
    'small',
    { class: 'stock__alerte', title: text },
    h('span', { class: 'stock__alerte-long' }, text),
    h('span', { class: 'stock__alerte-court', 'aria-hidden': 'true' }, short),
  );
}

interface Line {
  el: HTMLElement;
  /** Redraws the number, bar and warning for a new count. */
  set(count: number, full: number, low: boolean, warning: [string, string] | null): void;
}

function line(icon: string, name: string, key: string): Line {
  const number = h('strong', { class: 'stock__nombre' });
  const fill = h('div', { class: 'stock__remplissage' });
  const meter = h('div', { class: 'stock__jauge', role: 'meter', 'aria-valuemin': 0 }, fill);
  const warnings = h('div', { class: 'stock__alertes' });
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
    warnings,
  );
  return {
    el,
    set(count, full, low, warning) {
      number.textContent = String(count);
      fill.style.width = `${Math.round(Math.min(1, full > 0 ? count / full : 0) * 100)}%`;
      meter.setAttribute('aria-valuemax', String(full));
      meter.setAttribute('aria-valuenow', String(Math.min(count, full)));
      meter.setAttribute('aria-label', `${name} : ${count}`);
      el.classList.toggle('stock__ligne--bas', low);
      warnings.replaceChildren(...(warning ? [alert(...warning)] : []));
    },
  };
}

function warningFor(g: StockGauge): [string, string] | null {
  if (g.expiring > 0) return [fr.hud.pourrissent(g.expiring), fr.hud.pourrissentCourt(g.expiring)];
  if (g.low) return [fr.hud.stockBas, fr.hud.stockBasCourt];
  return null;
}

/**
 * The player's supplies on the left of the screen: a big number and a bar per
 * supply, with warnings in words (never colour alone) when stock is too low
 * for one pitcher or lemons spoil tonight. During the selling day it follows
 * the replay live: each sale takes one cup and one glass of lemonade.
 */
export function renderStockPanel(ctx: ScreenContext): HTMLElement {
  const game = ctx.game();
  const lines = new Map<string, Line>();
  const list = h('ul', { class: 'stock__liste' });

  const day = game.phase === 'JOURNEE' ? game.currentDay : null;
  const start = day ? dayStartStock(day.record) : null;
  const gauges = start
    ? gaugesFor(start.supplies, game, ctx.cfg, start.expiringLemons)
    : stockGauges(game, ctx.cfg);

  for (const g of gauges) {
    const info = fr.fournitures[g.supply];
    const l = line(info.icone, info.nom, g.supply);
    l.set(g.count, g.full, g.low, warningFor(g));
    lines.set(g.supply, l);
    list.append(l.el);
  }

  if (start) {
    const made = start.servings;
    const glasses = line(fr.hud.verresPrets.icone, fr.hud.verresPrets.nom, 'lemonade');
    const showGlasses = (left: number) =>
      glasses.set(
        left,
        made,
        left === 0,
        left === 0 ? [fr.hud.plusDeLimonade, fr.hud.plusDeLimonadeCourt] : null,
      );
    showGlasses(made);
    list.prepend(glasses.el);

    let cups = start.supplies.cups;
    let servings = made;
    const cupsLine = lines.get('cups');
    const off = ctx.events.on('day_event', ({ event }) => {
      if (event.type !== 'visitor' || event.outcome !== 'buy') return;
      cups = Math.max(0, cups - 1);
      servings = Math.max(0, servings - 1);
      showGlasses(servings);
      const g = gauge('cups', cups, game, ctx.cfg);
      cupsLine?.set(g.count, g.full, g.low, warningFor(g));
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
