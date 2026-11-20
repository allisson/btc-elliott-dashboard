import { describe, expect, it } from 'vitest';
import type { Count, Pivot } from '../../types.ts';
import { findCounts } from './counts.ts';
import * as fx from './__fixtures__/counts.ts';

const LABELS = ['0', '1', '2', '3', '4', '5', 'A', 'B'];

const sides = [
  ['bullish', (p: readonly number[]) => fx.pivots('trough', p)],
  ['bearish', (p: readonly number[]) => fx.mirror(fx.pivots('trough', p))],
] as const;

// The count anchored at the first pivot of the list.
const anchoredAtFirst = (list: Pivot[], counts: Count[]) =>
  counts.find((c) => c.points[0].index === list[0].index);

describe.each(sides)('findCounts (%s)', (side, build) => {
  it.each([3, 4, 5, 6, 7, 8])('labels a count of m = %i ending at the latest pivot', (m) => {
    const list = build(fx.BASE.slice(0, m));
    const count = anchoredAtFirst(list, findCounts(list));
    expect(count).toBeDefined();
    expect(count!.impulseDirection).toBe(side);
    expect(count!.lastLabel).toBe(LABELS[m - 1]);
    expect(count!.points).toEqual(
      list.map((p, i) => ({ label: LABELS[i], time: p.time, price: p.price, index: p.index, projected: false })),
    );
    expect(count!.score).toBeGreaterThan(0);
  });

  it.each([
    ['Rule 1', fx.RULE1_VIOLATED],
    ['W3 beyond W1', fx.W3_NOT_BEYOND_W1],
    ['Rule 3', fx.RULE3_VIOLATED],
    ['Rule 2 (W1 minimum)', fx.RULE2_W1_SHORTEST_OTHER],
    ['Rule 2 (W5 minimum)', fx.RULE2_W5_MIN],
    ['B before P5', fx.B_AT_P5],
  ])('discards a candidate that fails %s', (_name, prices) => {
    const list = build(prices);
    expect(anchoredAtFirst(list, findCounts(list))).toBeUndefined();
  });

  it('keeps a candidate where W3 equals the minimum', () => {
    const list = build(fx.RULE2_EQUAL);
    expect(anchoredAtFirst(list, findCounts(list))).toBeDefined();
  });

  it.each([['m = 4', fx.RULE2_PENDING_M4], ['m = 5', fx.RULE2_PENDING_M5]] as const)('keeps a Rule 2 pending candidate at %s', (_m, prices) => {
    const list = build(prices);
    const count = anchoredAtFirst(list, findCounts(list));
    expect(count?.rules.find((r) => r.rule === 'rule2')?.status).toBe('not_yet');
  });

  it('only anchors among the last K pivots', () => {
    const list = build([60, 120, ...fx.BASE]);
    const counts = findCounts(list);
    expect(Math.max(...counts.map((c) => c.points.length))).toBe(8);
    expect(counts.every((c) => (c.points[0].index ?? -1) >= list[2].index)).toBe(true);
  });

  it('carries the measured ratios and every rule check', () => {
    const list = build(fx.BASE);
    const count = anchoredAtFirst(list, findCounts(list))!;
    expect(Object.keys(count.ratios)).toHaveLength(6);
    expect(count.rules.map((r) => r.rule)).toEqual(['rule1', 'rule2', 'rule3']);
    expect(count.score).toBeCloseTo(0.882716, 5);
  });
});

describe('findCounts', () => {
  it('returns nothing with fewer than three pivots', () => {
    expect(findCounts([])).toEqual([]);
    expect(findCounts(fx.pivots('trough', [100, 200]))).toEqual([]);
  });

  it('gives a trough anchor a bullish count and a peak anchor a bearish one', () => {
    // Trough 100 anchors a bullish m = 6 with a truncated Wave 5 (290 < 300);
    // peak 300 anchors a bearish m = 3 whose Wave 2 (290) stays below 300.
    const counts = findCounts(fx.pivots('trough', [100, 200, 140, 300, 240, 290]));
    expect(counts.map((c) => [c.points[0].price, c.impulseDirection])).toEqual([
      [100, 'bullish'],
      [300, 'bearish'],
    ]);
  });
});
