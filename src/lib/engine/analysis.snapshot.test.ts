// Regression on real Binance klines recorded 2026-11-20 13:38 UTC, plus 15m and 1M recorded 2026-11-21 16:32 UTC (spec §11). The expected values are
// what the engine produced when the snapshots were recorded: a change here is a behaviour change.
import { describe, expect, it } from 'vitest';
import { TIMEFRAMES } from '../../config.ts';
import type { SignalLevels, Timeframe } from '../../types.ts';
import { parseKlines } from '../binance/rest.ts';
import { analyseTimeframe } from './analysis.ts';
import { zigzag } from './zigzag.ts';
import klines1d from './__fixtures__/binance/klines-1d.json';
import klines1h from './__fixtures__/binance/klines-1h.json';
import klines15m from './__fixtures__/binance/klines-15m.json';
import klines1M from './__fixtures__/binance/klines-1M.json';
import klines1w from './__fixtures__/binance/klines-1w.json';
import klines4h from './__fixtures__/binance/klines-4h.json';

const RAW: Record<Timeframe, unknown> = { '15m': klines15m, '1h': klines1h, '4h': klines4h, '1d': klines1d, '1w': klines1w, '1M': klines1M };

interface Expected {
  pivots: number;
  primary: { label: string; direction: string; confidence: number } | null;
  alternative: { label: string; direction: string } | null;
  primaryLevels: SignalLevels | null;
  alternativeLevels: SignalLevels | null;
}

const EXPECTED: Record<Timeframe, Expected> = {
  '15m': {
    pivots: 87,
    primary: { label: '3', direction: 'bearish', confidence: 4.79 },
    alternative: null,
    primaryLevels: null, // (3): no setup
    alternativeLevels: null,
  },
  '1h': {
    pivots: 68,
    primary: { label: '2', direction: 'bearish', confidence: 32.61 },
    alternative: null,
    primaryLevels: { setup: 'setup1', side: 'SHORT', triggerMet: true, takeProfit1: 61290.58, takeProfit2: 57889.04404 },
    alternativeLevels: null,
  },
  '4h': {
    pivots: 66,
    primary: { label: '2', direction: 'bearish', confidence: 83.2 },
    alternative: { label: 'A', direction: 'bearish' },
    primaryLevels: { setup: 'setup1', side: 'SHORT', triggerMet: true, takeProfit1: 62062.97, takeProfit2: 57497.09328 },
    alternativeLevels: null, // (A): no setup
  },
  '1d': {
    pivots: 162,
    primary: { label: '4', direction: 'bearish', confidence: 100 },
    alternative: { label: '2', direction: 'bearish' },
    primaryLevels: { setup: 'setup2', side: 'SHORT', triggerMet: false, takeProfit1: 62006, takeProfit2: 58276.16 },
    alternativeLevels: { setup: 'setup1', side: 'SHORT', triggerMet: false, takeProfit1: 62006, takeProfit2: 28656.904 },
  },
  '1w': { pivots: 185, primary: null, alternative: null, primaryLevels: null, alternativeLevels: null }, // Neutral
  '1M': {
    pivots: 41,
    primary: { label: '3', direction: 'bullish', confidence: 44.84 },
    alternative: null,
    primaryLevels: null, // (3): no setup
    alternativeLevels: null,
  },
};

const expectLevels = (actual: SignalLevels | null, expected: SignalLevels | null) => {
  if (expected === null) return expect(actual).toBeNull();
  const { takeProfit1, takeProfit2, ...rest } = expected;
  expect(actual).toMatchObject(rest);
  expect(actual!.takeProfit1).toBeCloseTo(takeProfit1, 4);
  expect(actual!.takeProfit2).toBeCloseTo(takeProfit2, 4);
};

describe.each(TIMEFRAMES.map((t) => t.id))('real snapshot %s', (tf) => {
  const { closed } = parseKlines(RAW[tf]);
  const threshold = TIMEFRAMES.find((t) => t.id === tf)!.zigzagThreshold;
  const e = EXPECTED[tf];
  const a = analyseTimeframe(closed, tf);

  it('pivot count', () => {
    expect(zigzag(closed, threshold)).toHaveLength(e.pivots);
  });

  it('scenarios', () => {
    expect(a.primary && { label: a.primary.count.lastLabel, direction: a.primary.direction }).toEqual(
      e.primary && { label: e.primary.label, direction: e.primary.direction },
    );
    if (e.primary) expect(a.primary!.confidence).toBeCloseTo(e.primary.confidence, 2);
    expect(a.alternative && { label: a.alternative.count.lastLabel, direction: a.alternative.direction }).toEqual(e.alternative);
  });

  it('signal levels', () => {
    expectLevels(a.primaryLevels, e.primaryLevels);
    expectLevels(a.alternativeLevels, e.alternativeLevels);
  });
});

// §3.1 candle step on real data: monthly candles open on the first of the month, and so do the
// analysed close and the projected points.
it('1M snapshot: analysedAt and projected times fall on the first of a month', () => {
  const a = analyseTimeframe(parseKlines(RAW['1M']).closed, '1M');
  const iso = (t: number) => new Date(t * 1000).toISOString();
  expect(iso(a.analysedAt)).toBe('2026-11-01T00:00:00.000Z');
  expect(a.primary!.projected.map((p) => iso(p.time))).toEqual(['2026-11-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z']);
});
