import { fr } from '../../i18n/fr';
import { h, type Child } from '../dom';
import type { ScreenContext } from '../screens/types';

export interface ButtonOptions {
  variant?: 'primary' | 'secondary' | 'ghost';
  large?: boolean;
  disabled?: boolean;
  /** Stable id so focus survives a re-render. */
  focusKey?: string;
  label?: string;
}

export function button(
  text: Child,
  onClick: () => void,
  options: ButtonOptions = {},
): HTMLButtonElement {
  const { variant = 'primary', large = false, disabled = false } = options;
  return h(
    'button',
    {
      type: 'button',
      class: `btn btn--${variant}${large ? ' btn--large' : ''}`,
      disabled,
      'data-focus': options.focusKey,
      'aria-label': options.label,
      onClick: () => {
        if (!disabled) onClick();
      },
    },
    text,
  );
}

export interface StepperOptions {
  id: string;
  /** Full label: shown, and used for the « − » / « + » button names read by screen readers. */
  label: string;
  /** Shorter visible label when the context already says what it is (e.g. « Paquets » in a card). */
  shortLabel?: string;
  icon?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  hint?: Child;
  /** One row: label on the left, « − value + » on the right (issue #44: no scrolling). */
  compact?: boolean;
  onChange: (value: number) => void;
}

/** Big « − value + » control: no typing anywhere (ARCHITECTURE.md §10.1). */
export function stepper(o: StepperOptions): HTMLElement {
  const step = o.step ?? 1;
  const format = o.format ?? String;
  const set = (value: number) => o.onChange(Math.min(o.max, Math.max(o.min, value)));
  const label = h(
    'div',
    { class: 'stepper__label', id: `${o.id}-label` },
    h('span', null, o.icon ? `${o.icon} ` : '', o.shortLabel ?? o.label),
    o.compact && o.hint ? h('small', { class: 'stepper__hint' }, o.hint) : null,
  );
  return h(
    'div',
    { class: `stepper${o.compact ? ' stepper--compact' : ''}` },
    label,
    h(
      'div',
      { class: 'stepper__controls', role: 'group', 'aria-labelledby': `${o.id}-label` },
      button('−', () => set(o.value - step), {
        variant: 'secondary',
        disabled: o.value <= o.min,
        focusKey: `${o.id}-moins`,
        label: `${o.label} : moins`,
      }),
      h('output', { class: 'stepper__value', 'aria-live': 'polite' }, format(o.value)),
      button('+', () => set(o.value + step), {
        variant: 'secondary',
        disabled: o.value >= o.max,
        focusKey: `${o.id}-plus`,
        label: `${o.label} : plus`,
      }),
    ),
    !o.compact && o.hint ? h('div', { class: 'stepper__hint' }, o.hint) : null,
  );
}

export type Tone = 'bon' | 'mauvais' | 'neutre';

export function toneOf(value: number): Tone {
  if (value > 0) return 'bon';
  if (value < 0) return 'mauvais';
  return 'neutre';
}

export function tile(label: string, value: Child, tone: Tone = 'neutre'): HTMLElement {
  return h(
    'div',
    { class: `tuile tuile--${tone}` },
    h('div', { class: 'tuile__valeur' }, value),
    h('div', { class: 'tuile__label' }, label),
  );
}

/** Citronnelle, the lemon mascot, with a speech bubble. */
export function mascot(...lines: Child[]): HTMLElement {
  return h(
    'aside',
    { class: 'mascotte', 'aria-label': fr.mascotte.nom },
    h('div', { class: 'mascotte__avatar', 'aria-hidden': 'true' }, '🍋'),
    h(
      'div',
      { class: 'mascotte__bulle' },
      lines.filter(Boolean).map((line) => h('p', null, line)),
    ),
  );
}

export function screenTitle(text: string): HTMLElement {
  return h('h1', { class: 'ecran__titre' }, text);
}

/** Bottom row of navigation buttons, pinned to the bottom of the panel so it never scrolls away. */
export function actions(...buttons: (HTMLElement | null)[]): HTMLElement {
  return h('div', { class: 'ecran__actions' }, buttons);
}

/** Two columns on wide panels, one on phones (issue #44). */
export function columns(left: Child[], right: Child[]): HTMLElement {
  return h(
    'div',
    { class: 'colonnes' },
    h('div', { class: 'colonnes__col' }, left),
    h('div', { class: 'colonnes__col' }, right),
  );
}

/**
 * Citronnelle's step-by-step tip, shown on the first day of a game while
 * tips are on (ARCHITECTURE.md §10.1: the first day works as a guided tutorial).
 */
export function tutorialTip(ctx: ScreenContext, step: number, text: string): HTMLElement | null {
  const game = ctx.state.game;
  if (!ctx.state.ui.conseils || !game || game.day !== 1) return null;
  const tip = mascot(h('strong', null, fr.tutoriel.etape(step)), text);
  tip.classList.add('mascotte--tuto');
  return tip;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts a number up from zero, for a bit of excitement on the report. */
export function countUp(
  el: HTMLElement,
  to: number,
  format: (value: number) => string,
  ms = 900,
): void {
  el.textContent = format(to);
  if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') return;
  const start = performance.now();
  const step = (now: number) => {
    const f = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - f) ** 3;
    el.textContent = format(Math.round(to * eased));
    if (f < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = format(0);
  requestAnimationFrame(step);
}
