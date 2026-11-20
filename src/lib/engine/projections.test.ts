import { describe, expect, it } from 'vitest';
import type { Count, Pivot } from '../../types.ts';
import { findCounts } from './counts.ts';
import { isRule2Pending, project } from './projections.ts';
import * as fx from './__fixtures__/counts.ts';

const TF = 3_600;

const sides = [
  ['bullish', (p: readonly number[]) => fx.pivots('trough', p), (x: number) => x],
  ['bearish', (p: readonly number[]) => fx.mirror(fx.pivots('trough', p)), (x: number) => fx.MIRROR - x],
] as const;

const countOf = (list: Pivot[]): Count => findCounts(list).find((c) => c.points[0].index === list[0].index)!;

// Expected bullish prices for each prefix of BASE (hand-computed, spec §4.5). W1 = 100.
// Ranges are [at the low ratio, at the high ratio] before sorting.
const ROWS: [string, number, [string, number, [number, number]?][]][] = [
  ['(2)', 3, [['3', 301.8, [301.8, 401.8]], ['4', 301.8 - 0.382 * 161.8], ['5', 301.8 - 0.382 * 161.8 + 100]]],
  ['(3)', 4, [['4', 238.88], ['5', 338.88]]],
  ['(4)', 5, [['5', 340]]],
  ['(5)', 6, [['A', 248.32, [248.32, 220]], ['B', 294.16], ['C', 202.48, [202.48, 294.16 - 1.618 * 91.68]]]],
  ['(A)', 7, [['B', 295], ['C', 205, [205, 295 - 1.618 * 90]]]],
  ['(B)', 8, [['C', 210, [210, 300 - 1.618 * 90]]]],
];

describe.each(sides)('project (%s)', (_side, build, map) => {
  it.each(ROWS)('projects the points after %s', (_row, m, expected) => {
    const count = countOf(build(fx.BASE.slice(0, m)));
    const projected = project(count, count.points[m - 1].index! + 1, TF);
    expect(projected.map((p) => p.label)).toEqual(expected.map(([label]) => label));
    projected.forEach((p, i) => {
      const [, price, range] = expected[i];
      expect(p.price).toBeCloseTo(map(price), 6);
      expect(p.projected).toBe(true);
      expect(p.index).toBeNull();
      if (range) {
        const [a, b] = range.map(map);
        expect(p.targetRange!.min).toBeCloseTo(Math.min(a, b), 6);
        expect(p.targetRange!.max).toBeCloseTo(Math.max(a, b), 6);
      } else {
        expect(p.targetRange).toBeUndefined();
      }
    });
  });

  it('caps Wave 5 at len(W3) from the projected P4 when Rule 2 is pending at (3)', () => {
    const count = countOf(build(fx.RULE2_PENDING_M4));
    expect(isRule2Pending(count)).toBe(true);
    const [p4, p5] = project(count, 7, TF);
    expect(p4.price).toBeCloseTo(map(195.62), 6);
    expect(p5.price).toBeCloseTo(map(195.62 + 90), 6);
  });

  it('caps Wave 5 at len(W3) from P4 when Rule 2 is pending at (4)', () => {
    const count = countOf(build(fx.RULE2_PENDING_M5));
    expect(isRule2Pending(count)).toBe(true);
    expect(project(count, 9, TF)[0].price).toBeCloseTo(map(300), 6);
  });

  it('does not cap Wave 5 when Wave 3 is longer than Wave 1', () => {
    const count = countOf(build(fx.BASE.slice(0, 5)));
    expect(isRule2Pending(count)).toBe(false);
  });

  it('spaces projected legs by the mean confirmed leg, starting from the last point', () => {
    const count = countOf(build(fx.BASE.slice(0, 3))); // indices 0, 2, 4: mean leg 2
    const last = count.points[2];
    const times = project(count, last.index! + 1, TF).map((p) => p.time);
    expect(times).toEqual([last.time + 2 * TF, last.time + 4 * TF, last.time + 6 * TF]);
  });

  it('pushes the first projected leg past the last closed candle when the wave in progress is older', () => {
    const count = countOf(build(fx.BASE.slice(0, 3)));
    const last = count.points[2];
    const times = project(count, last.index! + 5, TF).map((p) => p.time); // elapsed 5 > mean 2
    expect(times).toEqual([last.time + 6 * TF, last.time + 8 * TF, last.time + 10 * TF]);
  });

  it('rounds the mean leg duration', () => {
    const list = build(fx.BASE.slice(0, 3)).map((p, i) => ({ ...p, index: [0, 2, 5][i], time: [0, 2, 5][i] * TF }));
    const count = countOf(list); // mean 2.5 → 3
    expect(project(count, 6, TF).map((p) => p.time)).toEqual([8 * TF, 11 * TF, 14 * TF]);
  });
});
