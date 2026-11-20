import { describe, expect, it } from 'vitest';
import { grade, measureRatios, score } from './ratios.ts';
import { BASE, BASE_GRADES, MIRROR } from './__fixtures__/counts.ts';

const sides = [
  ['bullish', [...BASE]],
  ['bearish', BASE.map((p) => MIRROR - p)],
] as const;

describe('grade', () => {
  it('is 1 on a target', () => {
    expect(grade(0.618, [0.5, 0.618, 0.786])).toBe(1);
  });

  it('uses the absolute distance to the nearest target', () => {
    expect(grade(0.7, [0.5, 0.618, 0.786])).toBeCloseTo(1 - 0.082 / 0.15, 10);
  });

  it('is 0 at or beyond the tolerance', () => {
    expect(grade(1.15, [1.0])).toBeCloseTo(0, 10);
    expect(grade(1.5, [1.0])).toBe(0);
  });
});

describe.each(sides)('measureRatios (%s)', (_side, prices) => {
  it('measures only the ratios that exist for each m', () => {
    expect(Object.keys(measureRatios(prices.slice(0, 3)))).toEqual(['w2Retracement']);
    expect(Object.keys(measureRatios(prices.slice(0, 5)))).toEqual([
      'w2Retracement', 'w3Extension', 'w4Retracement',
    ]);
  });

  it('measures all six ratios at m = 8', () => {
    const r = measureRatios(prices);
    expect(r.w2Retracement).toBeCloseTo(0.6, 10);
    expect(r.w3Extension).toBeCloseTo(1.6, 10);
    expect(r.w4Retracement).toBeCloseTo(0.375, 10);
    expect(r.w5Extension).toBeCloseTo(1.0, 10);
    expect(r.aRetracement).toBeCloseTo(0.375, 10);
    expect(r.bRetracement).toBeCloseTo(50 / 90, 10);
  });
});

describe.each(sides)('score (%s)', (_side, prices) => {
  it('is the mean of the hand-computed grades at m = 8', () => {
    const g = Object.values(BASE_GRADES);
    const expected = g.reduce((a, b) => a + b, 0) / g.length;
    expect(score(measureRatios(prices))).toBeCloseTo(expected, 10);
    expect(score(measureRatios(prices))).toBeCloseTo(0.882716, 5);
  });

  it('is the single grade at m = 3', () => {
    expect(score(measureRatios(prices.slice(0, 3)))).toBeCloseTo(BASE_GRADES.w2Retracement, 10);
  });
});
