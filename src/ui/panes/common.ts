import { fr } from '../../i18n/fr';
import { h, type Child } from '../dom';
import type { ScreenContext } from '../screens/types';

/** One independent pane of the planning dashboard. */
export function pane(
  kind: string,
  title: string | { text: string; extra: Child },
  ...children: Child[]
): HTMLElement {
  const id = `volet-${kind}`;
  const heading =
    typeof title === 'string'
      ? h('h2', { class: 'volet__titre', id }, title)
      : h(
          'div',
          { class: 'volet__entete' },
          h('h2', { class: 'volet__titre', id }, title.text),
          title.extra,
        );
  return h('section', { class: `volet volet--${kind}`, 'aria-labelledby': id }, heading, children);
}

/**
 * Citronnelle's first-day step, as one short line under a pane's title
 * (the dashboard has no room for a bubble on every pane).
 */
export function tutorialHint(ctx: ScreenContext, step: number, text: string): HTMLElement | null {
  const game = ctx.state.game;
  if (!ctx.state.ui.conseils || !game || game.day !== 1) return null;
  return h(
    'p',
    { class: 'volet__astuce' },
    h('strong', null, `🍋 ${fr.tutoriel.etape(step)} · `),
    text,
  );
}
