import type { CloudState } from '../core/types';

/**
 * Pure helpers for the scene, kept apart from three.js objects so they can be
 * unit-tested without WebGL.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: number): Rgb {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}

export function rgbToHex({ r, g, b }: Rgb): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function mixHex(a: number, b: number, f: number): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const k = Math.min(1, Math.max(0, f));
  return rgbToHex({ r: x.r + (y.r - x.r) * k, g: x.g + (y.g - x.g) * k, b: x.b + (y.b - x.b) * k });
}

/** Sky colours through the day: soft morning, bright noon, warm evening. */
const SKY_KEYS: [number, number][] = [
  [0, 0xbfe3ff],
  [0.5, 0x8fd0ff],
  [0.85, 0xbfd8f0],
  [1, 0xffc59e],
];
const OVERCAST = 0xb7c3cf;
const RAINY = 0x8e9aa8;

/** Sky colour for a moment of the day (0 = opening, 1 = closing) and weather. */
export function skyColor(t: number, cloud: CloudState, raining: boolean): number {
  let color = SKY_KEYS[0]?.[1] ?? 0xbfe3ff;
  for (let i = 1; i < SKY_KEYS.length; i++) {
    const [t0, c0] = SKY_KEYS[i - 1] ?? [0, color];
    const [t1, c1] = SKY_KEYS[i] ?? [1, color];
    if (t <= t1) {
      color = mixHex(c0, c1, (t - t0) / (t1 - t0));
      break;
    }
    color = c1;
  }
  if (raining) return mixHex(color, RAINY, 0.75);
  if (cloud === 'couvert') return mixHex(color, OVERCAST, 0.6);
  if (cloud === 'nuageux') return mixHex(color, OVERCAST, 0.2);
  return color;
}

/** The sun's position on its arc, from the left (morning) to the right (evening). */
export function sunPosition(t: number): { x: number; y: number; z: number } {
  return { x: -14 + 28 * t, y: 4 + 10 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))), z: -25 };
}

/** How many clouds drift in the sky for a given sky state. */
export function cloudCount(cloud: CloudState, raining: boolean): number {
  if (raining) return 9;
  return { soleil: 1, nuageux: 4, couvert: 8 }[cloud];
}

/** Number of props to draw for a stock: one per `perItem` units, at most `max`. */
export function propCount(quantity: number, perItem: number, max: number): number {
  if (quantity <= 0) return 0;
  return Math.min(max, Math.ceil(quantity / perItem));
}

/** Customer walk: from one side of the sidewalk to the stand, a short stop, then out the other side. */
export const CUSTOMER_TIMING = { walkIn: 1.6, atStand: 0.9, walkOut: 1.6 } as const;
export const CUSTOMER_TOTAL =
  CUSTOMER_TIMING.walkIn + CUSTOMER_TIMING.atStand + CUSTOMER_TIMING.walkOut;

export type CustomerPhase = 'arrive' | 'stand' | 'leave' | 'done';

export interface CustomerPath {
  /** +1 walks left to right, −1 right to left. */
  direction: 1 | -1;
  /** Where along the counter the customer stops. */
  standX: number;
}

const SIDEWALK_Z = 2.6;
const COUNTER_Z = 1.15;
const SIDEWALK_HALF_LENGTH = 14;

export function customerPhase(age: number): CustomerPhase {
  if (age < CUSTOMER_TIMING.walkIn) return 'arrive';
  if (age < CUSTOMER_TIMING.walkIn + CUSTOMER_TIMING.atStand) return 'stand';
  if (age < CUSTOMER_TOTAL) return 'leave';
  return 'done';
}

function ease(f: number): number {
  const k = Math.min(1, Math.max(0, f));
  return k * k * (3 - 2 * k);
}

/** Position of a customer `age` seconds after arriving on screen. */
export function customerPosition(path: CustomerPath, age: number): { x: number; z: number } {
  const startX = -path.direction * SIDEWALK_HALF_LENGTH;
  const endX = path.direction * SIDEWALK_HALF_LENGTH;
  const phase = customerPhase(age);
  if (phase === 'arrive') {
    const f = ease(age / CUSTOMER_TIMING.walkIn);
    return {
      x: startX + (path.standX - startX) * f,
      z: SIDEWALK_Z + (COUNTER_Z - SIDEWALK_Z) * Math.max(0, (f - 0.6) / 0.4),
    };
  }
  if (phase === 'stand') return { x: path.standX, z: COUNTER_Z };
  const f = ease(
    (age - CUSTOMER_TIMING.walkIn - CUSTOMER_TIMING.atStand) / CUSTOMER_TIMING.walkOut,
  );
  return {
    x: path.standX + (endX - path.standX) * f,
    z: COUNTER_Z + (SIDEWALK_Z - COUNTER_Z) * Math.min(1, f / 0.4),
  };
}

/** Free slot in a fixed-size pool, or null if every slot is busy (the visit is then not drawn). */
export function freeSlot(busy: readonly boolean[]): number | null {
  const index = busy.indexOf(false);
  return index === -1 ? null : index;
}
