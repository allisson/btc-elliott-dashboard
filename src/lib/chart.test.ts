import { describe, expect, it } from 'vitest';
import { CHART, CHART_COLORS } from '../config.ts';
import type { Candle, Scenario, Signal } from '../types.ts';
import { chartModel, type ChartInput } from './chart.ts';
import { findCounts } from './engine/counts.ts';
import { buildScenarios } from './engine/scenarios.ts';
import * as fx from './engine/__fixtures__/counts.ts';

const H = 3_600;

// Pivots at indices 0, 2, 4 (fixture), last closed candle 5, open candle 6.
const scenarioOf = (prices: readonly number[], mirrored: boolean): Scenario => {
  const list = fx.pivots('trough', prices);
  return buildScenarios(findCounts(mirrored ? fx.mirror(list) : list), 5, H).primary!;
};
const candles: Candle[] = Array.from({ length: 7 }, (_, i) => ({ time: i * H, open: 1, high: 1, low: 1, close: 1, volume: 1 }));

const bullish = scenarioOf(fx.BASE.slice(0, 3), false); // (0)(1)(2): Wave 3 in progress
const bearish = scenarioOf(fx.BASE.slice(0, 3), true);

const signal: Signal = {
  setup: 'setup1',
  side: 'LONG',
  triggerMet: true,
  takeProfit1: 200,
  takeProfit2: 301.8,
  timeframe: '1h',
  entry: 150,
  stopLoss: 148.5,
  rr1: 50 / 1.5,
  rr2: 151.8 / 1.5,
  status: 'ACTIVE',
};

const input = (over: Partial<ChartInput> = {}): ChartInput => ({
  timeframe: '1h',
  candles,
  scenario: bullish,
  signal,
  showProjections: true,
  showSignalLines: true,
  pausedSince: null,
  ...over,
});

describe('chartModel context bar', () => {
  it('names the pair, timeframe, scenario with confidence and the wave in progress', () => {
    expect(chartModel(input()).context).toBe(`BTC/USDT · 1H · Primary Scenario (${Math.round(bullish.confidence)}%) · Wave 3 in progress`);
    const alternative = { ...bullish, rank: 'alternative' as const, confidence: 17.4 };
    expect(chartModel(input({ scenario: alternative })).context).toBe('BTC/USDT · 1H · Alternative Scenario (17%) · Wave 3 in progress');
  });

  it('reads Neutral when there is no scenario', () => {
    expect(chartModel(input({ timeframe: '1w', scenario: null, signal: null })).context).toBe('BTC/USDT · 1W · Neutral');
  });
});

describe('chartModel wave lines and markers', () => {
  it('draws the confirmed line through the count points', () => {
    const m = chartModel(input());
    expect(m.confirmedLine).toEqual(bullish.count.points.map((p) => ({ time: p.time, value: p.price })));
  });

  it.each([
    ['bullish', bullish, ['belowBar', 'aboveBar', 'belowBar'], ['aboveBar', 'belowBar', 'aboveBar']],
    ['bearish', bearish, ['aboveBar', 'belowBar', 'aboveBar'], ['belowBar', 'aboveBar', 'belowBar']],
  ] as const)('puts %s markers above peaks and below troughs, same text for projected points', (_, scenario, confirmed, projected) => {
    const m = chartModel(input({ scenario }));
    expect(m.confirmedMarkers.map((k) => [k.position, k.text, k.color])).toEqual(
      ['(0)', '(1)', '(2)'].map((text, i) => [confirmed[i], text, CHART_COLORS.confirmedWave]),
    );
    expect(m.projectedMarkers.map((k) => [k.position, k.text, k.color])).toEqual(
      ['(3)', '(4)', '(5)'].map((text, i) => [projected[i], text, CHART_COLORS.projectedWave]),
    );
  });

  it('starts the projected line at the last confirmed point', () => {
    const m = chartModel(input());
    expect(m.projectionVisible).toBe(true);
    const last = bullish.count.points[2];
    expect(m.projectedLine).toEqual([last, ...bullish.projected].map((p) => ({ time: p.time, value: p.price })));
  });

  it('hides the projection and its legend entry when Projections is off', () => {
    const m = chartModel(input({ showProjections: false }));
    expect(m.projectionVisible).toBe(false);
    expect(m.projectedLine).toHaveLength(4); // kept, so the time scale's right edge stays put
    expect(m.projectedMarkers).toEqual([]);
    expect(m.legend.map((l) => l.label)).toEqual(['Confirmed', 'Entry', 'Stop', 'Invalidation', 'TP1', 'TP2']);
  });

  it('draws nothing but candles on a Neutral timeframe', () => {
    const m = chartModel(input({ timeframe: '1w', scenario: null, signal: null }));
    expect([m.confirmedLine, m.confirmedMarkers, m.projectedLine, m.projectedMarkers, m.priceLines, m.legend]).toEqual([[], [], [], [], [], []]);
    expect(m.overlays).toEqual(['1W is Neutral: no valid count to draw.']);
  });
});

describe('chartModel price lines', () => {
  it("draws the signal lines and the scenario's invalidation price, with R:R in the TP titles", () => {
    const m = chartModel(input());
    expect(m.priceLines).toEqual([
      { id: 'entry', price: 150, title: 'ENTRY 1x', color: CHART_COLORS.entry, style: 'solid' },
      { id: 'stopLoss', price: 148.5, title: 'STOP LOSS', color: CHART_COLORS.stopLoss, style: 'dashed' },
      { id: 'invalidation', price: bullish.invalidationPrice, title: 'INVALIDATION', color: CHART_COLORS.invalidation, style: 'dashed' },
      { id: 'takeProfit1', price: 200, title: 'TP1 [R:R 1:33.3]', color: CHART_COLORS.takeProfit1, style: 'dashed' },
      { id: 'takeProfit2', price: 301.8, title: 'TP2 [R:R 1:101.2]', color: CHART_COLORS.takeProfit2, style: 'dotted' },
    ]);
    expect(bullish.invalidationPrice).toBe(100);
    expect(m.showLastPriceLine).toBe(false);
    expect(m.legend.map((l) => l.label)).toEqual(['Confirmed', 'Projected', 'Entry', 'Stop', 'Invalidation', 'TP1', 'TP2']);
  });

  it('drops the line of a target the price already passed', () => {
    const m = chartModel(input({ signal: { ...signal, status: 'WATCHING', rr1: -0.2 } }));
    expect(m.priceLines.map((l) => l.id)).toEqual(['entry', 'stopLoss', 'invalidation', 'takeProfit2']);
    expect(m.legend.map((l) => l.label)).toEqual(['Confirmed', 'Projected', 'Entry', 'Stop', 'Invalidation', 'TP2']);
  });

  it('keeps the lines for a Watching signal', () => {
    expect(chartModel(input({ signal: { ...signal, status: 'WATCHING' } })).priceLines).toHaveLength(5);
  });

  it.each([
    ['Trade 1x is off', { showSignalLines: false }],
    ['the scenario has no setup', { signal: null }],
    ['the signal is Invalidated', { signal: { ...signal, status: 'INVALIDATED' as const } }],
    ['signals are paused', { pausedSince: Date.UTC(2026, 10, 20, 13, 38) }],
  ])('hides them, and their legend entries, when %s', (_, over) => {
    const m = chartModel(input(over));
    expect(m.priceLines).toEqual([]);
    expect(m.showLastPriceLine).toBe(true);
    expect(m.legend.map((l) => l.label)).toEqual(['Confirmed', 'Projected']);
  });

  it('shows the paused overlay with the time of the last real update', () => {
    expect(chartModel(input({ pausedSince: Date.UTC(2026, 10, 20, 13, 38) })).overlays).toEqual([
      'Signals paused: data stale since 13:38 UTC',
    ]);
  });
});

describe('chartModel time scale', () => {
  it('adds one empty slot per candle up to the last projected point', () => {
    // Open candle at index 6; projected (3)(4)(5) at indices 6, 8, 10.
    expect(chartModel(input()).futureTimes).toEqual([7, 8, 9, 10].map((i) => i * H));
  });

  it('adds no slots without a projection', () => {
    expect(chartModel(input({ scenario: null, signal: null })).futureTimes).toEqual([]);
  });

  it('opens on the count from (0) to the last projected point, with a margin', () => {
    expect(chartModel(input()).visibleRange).toEqual({ from: 0 - CHART.rangeMarginCandles, to: 10 + CHART.rangeMarginCandles });
  });

  it('opens on the last candles on a Neutral timeframe', () => {
    expect(chartModel(input({ scenario: null, signal: null })).visibleRange).toEqual({
      from: 6 - CHART.neutralVisibleCandles,
      to: 6 + CHART.rangeMarginCandles,
    });
  });
});
