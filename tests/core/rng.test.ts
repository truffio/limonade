import { describe, expect, it } from 'vitest';
import {
  chance,
  clamp,
  createRng,
  int,
  lerpClamped,
  normal,
  pickWeighted,
  poisson,
} from '../../src/core/rng';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('resumes exactly from a saved state', () => {
    const a = createRng(7);
    a.next();
    a.next();
    const resumed = createRng(a.state);
    expect(resumed.next()).toBe(a.next());
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('stays in [0, 1)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int covers both ends', () => {
    const rng = createRng(4);
    const seen = new Set(Array.from({ length: 1000 }, () => int(rng, 1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('normal has the requested mean and spread', () => {
    const rng = createRng(5);
    const xs = Array.from({ length: 20_000 }, () => normal(rng, 10, 2));
    const m = mean(xs);
    const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
    expect(m).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
  });

  it.each([3, 15, 60])('poisson(%d) has the right mean', (lambda) => {
    const rng = createRng(6);
    const xs = Array.from({ length: 20_000 }, () => poisson(rng, lambda));
    expect(mean(xs)).toBeCloseTo(lambda, 0);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });

  it('chance and pickWeighted follow their probabilities', () => {
    const rng = createRng(8);
    const n = 20_000;
    const hits = Array.from({ length: n }, () => chance(rng, 0.3)).filter(Boolean).length;
    expect(hits / n).toBeCloseTo(0.3, 1);

    const picks = Array.from({ length: n }, () => pickWeighted(rng, { a: 0.7, b: 0.2, c: 0.1 }));
    expect(picks.filter((p) => p === 'a').length / n).toBeCloseTo(0.7, 1);
    expect(picks.filter((p) => p === 'c').length / n).toBeCloseTo(0.1, 1);
  });

  it('clamp and lerpClamped', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(lerpClamped(25, 20, 30, 0, 10)).toBe(5);
    expect(lerpClamped(40, 20, 30, 0, 10)).toBe(10);
    expect(lerpClamped(0, 20, 30, 0, 10)).toBe(0);
  });
});
