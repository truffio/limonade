/** Seeded PRNG (mulberry32). Its whole state is one 32-bit integer, so games can be saved and resumed. */
export interface Rng {
  next(): number;
  readonly state: number;
}

export function createRng(state: number): Rng {
  let a = state | 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() {
      return a;
    },
  };
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng.next();
}

/** Integer in [min, max], both included. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export function chance(rng: Rng, probability: number): boolean {
  return rng.next() < probability;
}

/** Normal distribution (Box–Muller). */
export function normal(rng: Rng, mean: number, sd: number): number {
  if (sd === 0) return mean;
  const u = 1 - rng.next(); // (0, 1], avoids log(0)
  const v = rng.next();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson-distributed count: exact for small means, normal approximation above 30. */
export function poisson(rng: Rng, mean: number): number {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(normal(rng, mean, Math.sqrt(mean))));
  const limit = Math.exp(-mean);
  let k = 0;
  let p = rng.next();
  while (p > limit) {
    k++;
    p *= rng.next();
  }
  return k;
}

/** Picks a key with probability proportional to its weight. */
export function pickWeighted<K extends string>(rng: Rng, weights: Readonly<Record<K, number>>): K {
  const entries = Object.entries(weights) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  const last = entries[entries.length - 1];
  if (!last) throw new Error('pickWeighted needs at least one entry');
  return last[0];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear interpolation of `x` between (x0, y0) and (x1, y1), clamped to the end values. */
export function lerpClamped(x: number, x0: number, x1: number, y0: number, y1: number): number {
  const f = clamp((x - x0) / (x1 - x0), 0, 1);
  return y0 + (y1 - y0) * f;
}
