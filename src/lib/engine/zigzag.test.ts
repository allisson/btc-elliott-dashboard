import { describe, expect, it } from 'vitest';
import type { Candle, Pivot } from '../../types.ts';
import { zigzag } from './zigzag.ts';
import * as fx from './__fixtures__/zigzag.ts';

const run = (candles: Candle[]) => zigzag(candles, fx.THETA);
const summary = (pivots: Pivot[]) => pivots.map((p) => [p.type, p.index, p.price]);

function expectAlternation(pivots: Pivot[]) {
  for (let i = 1; i < pivots.length; i++) {
    expect(pivots[i].type).not.toBe(pivots[i - 1].type);
  }
}

describe('zigzag', () => {
  it('finds known pivots starting with a trough', () => {
    const pivots = run(fx.risingFirst);
    expect(summary(pivots)).toEqual([
      ['trough', 0, 99], ['peak', 2, 110], ['trough', 4, 98], ['peak', 6, 112],
    ]);
    expectAlternation(pivots);
  });

  it('finds known pivots starting with a peak', () => {
    const pivots = run(fx.fallingFirst);
    expect(summary(pivots)).toEqual([
      ['peak', 0, 101], ['trough', 2, 90], ['peak', 4, 100], ['trough', 6, 88],
    ]);
    expectAlternation(pivots);
  });

  it('takes time from the pivot candle', () => {
    const pivots = run(fx.risingFirst);
    expect(pivots.map((p) => p.time)).toEqual(pivots.map((p) => fx.risingFirst[p.index].time));
  });

  it('emits nothing when the threshold is never reached', () => {
    expect(run(fx.neverReaches)).toEqual([]);
  });

  it('returns no pivots for fewer than two candles', () => {
    expect(run([])).toEqual([]);
    expect(run(fx.risingFirst.slice(0, 1))).toEqual([]);
  });

  it('never emits the last, unconfirmed extreme', () => {
    expect(summary(run(fx.risingOnly))).toEqual([['trough', 0, 99]]);
    expect(summary(run(fx.fallingOnly))).toEqual([['peak', 0, 101]]);
    expect(run(fx.risingFirst).at(-1)?.index).toBe(6);
    expect(run(fx.fallingFirst).at(-1)?.index).toBe(6);
  });

  it('confirms a peak at exactly θ and not just short of it', () => {
    expect(summary(run(fx.peakAtBoundary(1)))).toEqual([['trough', 0, 99], ['peak', 2, 110]]);
    expect(summary(run(fx.peakAtBoundary(1 + 1e-12)))).toEqual([['trough', 0, 99]]);
  });

  it('confirms a trough at exactly θ and not just short of it', () => {
    expect(summary(run(fx.troughAtBoundary(1)))).toEqual([['peak', 0, 101], ['trough', 2, 90]]);
    expect(summary(run(fx.troughAtBoundary(1 - 1e-12)))).toEqual([['peak', 0, 101]]);
  });

  it('confirms the first pivot at exactly θ and not just short of it', () => {
    expect(summary(run(fx.firstPeakAtBoundary(1)))).toEqual([['peak', 0, 100]]);
    expect(run(fx.firstPeakAtBoundary(1 + 1e-12))).toEqual([]);
    expect(summary(run(fx.firstTroughAtBoundary(1)))).toEqual([['trough', 0, 100]]);
    expect(run(fx.firstTroughAtBoundary(1 - 1e-12))).toEqual([]);
  });

  it('lets an outside candle extend the peak instead of confirming the old one', () => {
    expect(summary(run(fx.outsideUp.slice(0, 4)))).toEqual([['trough', 0, 99]]);
    expect(summary(run(fx.outsideUp))).toEqual([['trough', 0, 99], ['peak', 3, 112]]);
  });

  it('lets an outside candle extend the trough instead of confirming the old one', () => {
    expect(summary(run(fx.outsideDown.slice(0, 4)))).toEqual([['peak', 0, 101]]);
    expect(summary(run(fx.outsideDown))).toEqual([['peak', 0, 101], ['trough', 3, 88]]);
  });

  it('keeps the first of equal highs', () => {
    expect(summary(run(fx.equalHighs))).toEqual([['trough', 0, 99], ['peak', 2, 110]]);
  });

  it('keeps the first of equal lows', () => {
    expect(summary(run(fx.equalLows))).toEqual([['peak', 0, 101], ['trough', 2, 90]]);
  });

  it('waits on an ambiguous start until one side alone is met', () => {
    expect(run(fx.ambiguousStart)).toEqual([]);
    expect(summary(run(fx.ambiguousThenFall))).toEqual([['peak', 0, 110]]);
    expect(summary(run(fx.ambiguousThenRise))).toEqual([['trough', 0, 100]]);
  });
});
