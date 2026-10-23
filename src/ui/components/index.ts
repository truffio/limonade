import { fr } from '../../i18n/fr';
import { h, type Child } from '../dom';

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
  label: string;
  icon?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  hint?: Child;
  onChange: (value: number) => void;
}

/** Big « − value + » control: no typing anywhere (ARCHITECTURE.md §10.1). */
export function stepper(o: StepperOptions): HTMLElement {
  const step = o.step ?? 1;
  const format = o.format ?? String;
  const set = (value: number) => o.onChange(Math.min(o.max, Math.max(o.min, value)));
  return h(
    'div',
    { class: 'stepper' },
    h('div', { class: 'stepper__label', id: `${o.id}-label` }, o.icon ? `${o.icon} ` : '', o.label),
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
    o.hint ? h('div', { class: 'stepper__hint' }, o.hint) : null,
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

/** Bottom row of navigation buttons. */
export function actions(...buttons: (HTMLElement | null)[]): HTMLElement {
  return h('div', { class: 'ecran__actions' }, buttons);
}
