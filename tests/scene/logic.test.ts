import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_TIMING,
  CUSTOMER_TOTAL,
  cloudCount,
  customerPhase,
  customerPosition,
  freeSlot,
  hexToRgb,
  mixHex,
  propCount,
  skyColor,
  sunPosition,
} from '../../src/scene/logic';

const brightness = (hex: number) => {
  const { r, g, b } = hexToRgb(hex);
  return r + g + b;
};

describe('scene logic', () => {
  it('mixes colours', () => {
    expect(mixHex(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixHex(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mixHex(0x000000, 0x0000ff, 0.5)).toBe(0x000080);
  });

  it('darkens the sky with clouds and rain, and warms it in the evening', () => {
    const sunny = skyColor(0.5, 'soleil', false);
    expect(brightness(skyColor(0.5, 'couvert', false))).toBeLessThan(brightness(sunny));
    expect(brightness(skyColor(0.5, 'soleil', true))).toBeLessThan(
      brightness(skyColor(0.5, 'couvert', false)),
    );
    const evening = hexToRgb(skyColor(1, 'soleil', false));
    expect(evening.r).toBeGreaterThan(evening.b); // orange
  });

  it('moves the sun from left to right, highest at midday', () => {
    expect(sunPosition(0).x).toBeLessThan(sunPosition(1).x);
    expect(sunPosition(0.5).y).toBeGreaterThan(sunPosition(0).y);
    expect(sunPosition(0.5).y).toBeGreaterThan(sunPosition(1).y);
  });

  it('shows more clouds on grey and rainy days', () => {
    expect(cloudCount('soleil', false)).toBeLessThan(cloudCount('nuageux', false));
    expect(cloudCount('nuageux', false)).toBeLessThan(cloudCount('couvert', false));
    expect(cloudCount('soleil', true)).toBeGreaterThanOrEqual(cloudCount('couvert', false));
  });

  it('draws one prop per group of units, capped', () => {
    expect(propCount(0, 5, 8)).toBe(0);
    expect(propCount(1, 5, 8)).toBe(1);
    expect(propCount(25, 5, 8)).toBe(5);
    expect(propCount(500, 5, 8)).toBe(8);
  });

  it('walks customers in, stops them at the counter, then out the other side', () => {
    const path = { direction: 1 as const, standX: 0.4 };
    expect(customerPhase(0)).toBe('arrive');
    expect(customerPhase(CUSTOMER_TIMING.walkIn + 0.1)).toBe('stand');
    expect(customerPhase(CUSTOMER_TOTAL - 0.1)).toBe('leave');
    expect(customerPhase(CUSTOMER_TOTAL + 0.1)).toBe('done');

    const start = customerPosition(path, 0);
    const atStand = customerPosition(path, CUSTOMER_TIMING.walkIn + 0.2);
    const end = customerPosition(path, CUSTOMER_TOTAL);
    expect(start.x).toBeLessThan(-10);
    expect(atStand).toEqual({ x: 0.4, z: 1.15 });
    expect(end.x).toBeGreaterThan(10);
    expect(start.z).toBeGreaterThan(atStand.z); // comes from the sidewalk

    const leftward = customerPosition({ direction: -1, standX: 0 }, 0);
    expect(leftward.x).toBeGreaterThan(10);
  });

  it('finds a free customer slot or none', () => {
    expect(freeSlot([true, false, true])).toBe(1);
    expect(freeSlot([true, true])).toBeNull();
  });
});
