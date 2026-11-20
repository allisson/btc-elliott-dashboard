import { describe, expect, it } from 'vitest';
import type { Count, Pivot } from '../../types.ts';
import { findCounts } from './counts.ts';
import { hasDivergence, rsi } from './rsi.ts';
import { mirror, pivots } from './__fixtures__/counts.ts';
import * as fx from './__fixtures__/setups.ts';

describe('rsi', () => {
  it('matches Wilder smoothing computed by hand (period 2)', () => {
    // d: +1, −1, +2, −1 → seed 0.5/0.5 = 50; then 1.25/0.25 = 83.33; then 0.625/0.625 = 50.
    const values = rsi([1, 2, 1, 3, 2], 2);
    expect(values.slice(0, 2)).toEqual([undefined, undefined]);
    expect(values[2]).toBe(50);
    expect(values[3]).toBeCloseTo(100 - 100 / 6, 9);
    expect(values[4]).toBe(50);
  });

  it('starts at index 14 with the default period', () => {
    const values = rsi(Array.from({ length: 16 }, (_, i) => 100 + i));
    expect(values[13]).toBeUndefined();
    expect(values[14]).toBe(100);
  });

  it('is 100 with no losses and 50 with no movement', () => {
    expect(rsi([1, 2, 3], 2)[2]).toBe(100);
    expect(rsi([5, 5, 5], 2)[2]).toBe(50);
  });

  it('is all undefined with too few closes', () => {
    expect(rsi([1, 2], 2)).toEqual([undefined, undefined]);
  });
});

const sides = [
  ['bullish', (list: Pivot[]) => list, (c: number[]) => c],
  ['bearish', mirror, fx.mirrorCloses],
] as const;

describe.each(sides)('hasDivergence (%s)', (_side, flip, flipCloses) => {
  const wave5 = (prices: readonly number[], indices: readonly number[]) => {
    const list = fx.pivotsAt('trough', prices, indices);
    const count = findCounts(flip(list)).find((c) => c.lastLabel === '5')!;
    return { count, closes: flipCloses(fx.closesThrough(list)) };
  };

  it('finds it when price passes P3 and RSI does not', () => {
    const { count, closes } = wave5(fx.W5_PRICES, fx.W5_DIVERGENT);
    expect(hasDivergence(count, closes)).toBe(true);
  });

  it('rejects it when RSI confirms the new extreme', () => {
    const { count, closes } = wave5(fx.W5_PRICES, fx.W5_CONFIRMED);
    expect(hasDivergence(count, closes)).toBe(false);
  });

  it('rejects it when RSI is undefined at P3', () => {
    const { count, closes } = wave5(fx.W5_PRICES, fx.W5_EARLY);
    expect(hasDivergence(count, closes)).toBe(false);
  });

  it('rejects it when Wave 5 does not pass P3', () => {
    // W5 50 < W3 160 but ≥ min(W1, W5): a valid truncated fifth.
    const { count, closes } = wave5([100, 200, 140, 300, 240, 290], fx.W5_DIVERGENT);
    expect(hasDivergence(count, closes)).toBe(false);
  });

  it('is false for a count not ending at (5)', () => {
    const count: Count = findCounts(flip(pivots('trough', [100, 200, 140])))[0];
    expect(hasDivergence(count, [])).toBe(false);
  });
});
