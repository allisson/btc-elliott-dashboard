import { describe, expect, it } from 'vitest';
import type { Count, Pivot } from '../../types.ts';
import { findCounts } from './counts.ts';
import { project } from './projections.ts';
import { buildScenarios, isInvalidated } from './scenarios.ts';
import * as fx from './__fixtures__/counts.ts';

const TF = '1h';

const sides = [
  ['bullish', (p: readonly number[]) => fx.pivots('trough', p), (x: number) => x, 'Bullish', 'bearish'],
  ['bearish', (p: readonly number[]) => fx.mirror(fx.pivots('trough', p)), (x: number) => fx.MIRROR - x, 'Bearish', 'bullish'],
] as const;

const countOf = (list: Pivot[]): Count => findCounts(list).find((c) => c.points[0].index === list[0].index)!;
const lastIndex = (c: Count) => c.points[c.points.length - 1].index!;
const primaryOf = (count: Count) => buildScenarios([count], lastIndex(count) + 1, TF).primary!;

describe('buildScenarios ranking and confidence', () => {
  const build = (m: number, score: number) => ({ ...countOf(fx.pivots('trough', fx.BASE.slice(0, m))), score });

  it('is Neutral with no valid count', () => {
    expect(buildScenarios([], 10, TF)).toEqual({ primary: null, alternative: null });
  });

  it('ranks by score and splits confidence between the top two', () => {
    const { primary, alternative } = buildScenarios([build(3, 0.1), build(5, 0.6), build(4, 0.2)], 10, TF);
    expect(primary!.rank).toBe('primary');
    expect(primary!.count.lastLabel).toBe('4');
    expect(primary!.confidence).toBeCloseTo(75, 9);
    expect(alternative!.rank).toBe('alternative');
    expect(alternative!.count.lastLabel).toBe('3');
    expect(alternative!.confidence).toBeCloseTo(25, 9);
  });

  it('gives 50/50 when both scores are zero', () => {
    const { primary, alternative } = buildScenarios([build(3, 0), build(4, 0)], 10, TF);
    expect(primary!.confidence).toBe(50);
    expect(alternative!.confidence).toBe(50);
  });

  it('gives a single scenario its own score as confidence and no Alternative', () => {
    const { primary, alternative } = buildScenarios([build(4, 0.6)], 10, TF);
    expect(primary!.confidence).toBeCloseTo(60, 9);
    expect(alternative).toBeNull();
  });

  it.each([
    ['shorter first', [3, 6]],
    ['longer first', [6, 3]],
  ])('breaks a score tie in favour of the larger m (%s)', (_order, ms) => {
    const { primary, alternative } = buildScenarios(ms.map((m) => build(m, 0.5)), 10, TF);
    expect(primary!.count.lastLabel).toBe('5');
    expect(alternative!.count.lastLabel).toBe('2');
  });

  it('projects from the count with the given candle index and timeframe', () => {
    const count = build(3, 0.5);
    expect(buildScenarios([count], 9, TF).primary!.projected).toEqual(project(count, 9, TF));
  });
});

// Hand-computed for BASE (bullish); bearish mirrors prices and swaps below/above.
describe.each(sides)('scenario per last point (%s)', (side, build, map, word, against) => {
  const P = (n: number) => map(fx.BASE[n]).toFixed(2);
  const rows = [
    {
      m: 3, wave: 'Wave 3 in progress', direction: side, inv: 0, reason: 'Wave 2 would retrace past the start of Wave 1 (Rule 1)',
      thesis: (b: string) => `${word} impulse; Wave 2 retraced 0.60 of Wave 1; Wave 3 in progress toward 1.618 at ${map(301.8).toFixed(2)}; invalid ${b} ${P(0)}.`,
    },
    {
      m: 4, wave: 'Wave 4 forming', direction: against, inv: 1, reason: 'Wave 4 would overlap Wave 1 (Rule 3)',
      thesis: (b: string) => `${word} impulse; Wave 3 extended 1.60 of Wave 1; Wave 4 forming toward 0.382 at ${map(238.88).toFixed(2)}; invalid ${b} ${P(1)}.`,
    },
    {
      m: 5, wave: 'Wave 5 in progress', direction: side, inv: 1, reason: 'Wave 4 would overlap Wave 1 (Rule 3)',
      thesis: (b: string) => `${word} impulse; Wave 4 retraced 0.38 of Wave 3; Wave 5 in progress toward 1.0 at ${map(340).toFixed(2)}; invalid ${b} ${P(1)}.`,
    },
    {
      m: 6, wave: 'Correction A in progress', direction: against, inv: 5, reason: 'Price beyond the Wave 5 extreme: the impulse is not over',
      thesis: (b: string) => `${word} impulse complete; Wave 5 extended 1.00 of Wave 1; Correction A in progress toward 0.382 at ${map(248.32).toFixed(2)}; invalid ${b} ${P(5)}.`,
    },
    {
      m: 7, wave: 'Wave B in progress', direction: side, inv: 5, reason: 'Price beyond the Wave 5 extreme: the impulse is not over',
      thesis: (b: string) => `${word} impulse complete; Wave A retraced 0.38 of the impulse; Wave B in progress toward 0.5 at ${map(295).toFixed(2)}; invalid ${b} ${P(5)}.`,
    },
    {
      m: 8, wave: 'Wave C in progress', direction: against, inv: 5, reason: 'Price beyond the Wave 5 extreme: the impulse is not over',
      thesis: (b: string) => `${word} impulse complete; Wave B retraced 0.56 of Wave A; Wave C in progress toward 1.0 at ${map(210).toFixed(2)}; invalid ${b} ${P(5)}.`,
    },
  ];
  const below = side === 'bullish' ? 'below' : 'above';
  const above = side === 'bullish' ? 'above' : 'below';

  it.each(rows)('m = $m: $wave', ({ m, wave, direction, inv, reason, thesis }) => {
    const scenario = primaryOf(countOf(build(fx.BASE.slice(0, m))));
    expect(scenario.waveInProgress).toBe(wave);
    expect(scenario.direction).toBe(direction);
    expect(scenario.invalidationPrice).toBe(map(fx.BASE[inv]));
    expect(scenario.invalidationReason).toBe(reason);
    expect(scenario.thesis).toBe(thesis(m >= 6 ? above : below));
  });

  it('notes the Wave 3 cap in the thesis when Rule 2 is pending at (4)', () => {
    const scenario = primaryOf(countOf(build(fx.RULE2_PENDING_M5)));
    expect(scenario.thesis).toBe(
      `${word} impulse; Wave 4 retraced 0.22 of Wave 3; Wave 5 in progress toward ${map(300).toFixed(2)} (capped at Wave 3 length); invalid ${below} ${map(200).toFixed(2)}.`,
    );
  });

  it.each([3, 4, 5])('m = %i is invalidated at and past the invalidation price', (m) => {
    const scenario = primaryOf(countOf(build(fx.BASE.slice(0, m))));
    const inv = scenario.invalidationPrice;
    const s = side === 'bullish' ? 1 : -1;
    expect(isInvalidated(scenario, inv + s)).toBe(false);
    expect(isInvalidated(scenario, inv)).toBe(true);
    expect(isInvalidated(scenario, inv - s)).toBe(true);
  });

  it.each([6, 7, 8])('m = %i is invalidated only beyond the Wave 5 extreme', (m) => {
    const scenario = primaryOf(countOf(build(fx.BASE.slice(0, m))));
    const inv = scenario.invalidationPrice;
    const s = side === 'bullish' ? 1 : -1;
    expect(isInvalidated(scenario, inv - s)).toBe(false);
    expect(isInvalidated(scenario, inv)).toBe(false);
    expect(isInvalidated(scenario, inv + s)).toBe(true);
  });
});
