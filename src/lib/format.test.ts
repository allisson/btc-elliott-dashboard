import { describe, expect, it } from 'vitest';
import type { Signal } from '../types.ts';
import { positionSize } from './engine/risk.ts';
import {
  copySetupText,
  formatBtc,
  formatConfidence,
  formatDeltaPercent,
  formatPrice,
  formatRR,
  formatUsdt,
  formatUtc,
  type CopySetupInput,
} from './format.ts';

describe('number formatting', () => {
  it('groups prices in the UI and not in plain text', () => {
    expect(formatPrice(97234.5)).toBe('97,234.50');
    expect(formatPrice(97234.5, false)).toBe('97234.50');
    expect(formatUsdt(1000)).toBe('1,000.00');
  });

  it('signs Δ% with ASCII + and -', () => {
    expect(formatDeltaPercent(2.84415)).toBe('+2.84%');
    expect(formatDeltaPercent(-2.29805)).toBe('-2.30%');
    expect(formatDeltaPercent(-0.001)).toBe('+0.00%');
  });

  it('formats R:R, BTC, confidence and UTC time', () => {
    expect(formatRR(1.2376)).toBe('R:R 1:1.2');
    expect(formatRR(0)).toBe('passed');
    expect(formatRR(-0.29)).toBe('passed');
    expect(formatBtc(0.0044753)).toBe('0.00448');
    expect(formatConfidence(62.4)).toBe('62%');
    expect(formatUtc(Date.UTC(2026, 10, 20, 14, 5, 59))).toBe('2026-11-20 14:05 UTC');
  });
});

describe('copySetupText', () => {
  const entry = 97234.5;
  const signal: Signal = {
    setup: 'setup1',
    side: 'LONG',
    triggerMet: true,
    stopLoss: 95000,
    takeProfit1: 100000,
    takeProfit2: 104000,
    timeframe: '4h',
    entry,
    rr1: 2765.5 / 2234.5,
    rr2: 6765.5 / 2234.5,
    status: 'ACTIVE',
  };
  const input: CopySetupInput = {
    signal,
    scenario: {
      rank: 'primary',
      confidence: 62.4,
      invalidationReason: 'Wave 2 would retrace past the start of Wave 1 (Rule 1)',
      invalidationPrice: 95500,
    },
    position: positionSize({ capital: 1000, riskPercent: 1 }, entry, 95000),
    capital: 1000,
    generatedAt: Date.UTC(2026, 10, 20, 14, 5),
  };

  it('matches the golden text', () => {
    expect(copySetupText(input)).toBe(
      [
        'BTC/USDT · 4H · LONG 1x · Setup 1 (Wave 2→3)',
        'Status: ACTIVE · Primary Scenario (62%)',
        'Entry:       97234.50',
        'Stop Loss:   95000.00  (-2.30%)',
        'TP1:         100000.00  (+2.84%)  R:R 1:1.2',
        'TP2:         104000.00  (+6.96%)  R:R 1:3.0',
        'Position:    435.15 USDT (0.00448 BTC) of 1000.00 USDT',
        'Risk:        10.00 USDT (1.00% of capital)',
        'Invalidation: Wave 2 would retrace past the start of Wave 1 (Rule 1) at 95500.00',
        'Generated: 2026-11-20 14:05 UTC',
        'Not financial advice. 1x, no leverage.',
      ].join('\n'),
    );
  });

  it('notes a capped position on the Risk line', () => {
    const capped = { ...input, position: positionSize({ capital: 1000, riskPercent: 10 }, entry, 95000) };
    const risk = copySetupText(capped)!.split('\n')[7];
    expect(risk).toBe('Risk:        22.98 USDT (2.30% of capital) (capped by capital)');
  });

  it('names the Alternative Scenario and a WATCHING status', () => {
    const watching = { ...input, signal: { ...signal, status: 'WATCHING' as const }, scenario: { ...input.scenario, rank: 'alternative' as const } };
    expect(copySetupText(watching)!.split('\n')[1]).toBe('Status: WATCHING · Alternative Scenario (62%)');
  });

  it('reads "passed" for a target behind the entry', () => {
    const passed = { ...input, signal: { ...signal, status: 'WATCHING' as const, rr1: -0.3 } };
    expect(copySetupText(passed)!.split('\n')[4]).toBe('TP1:         100000.00  (+2.84%)  passed');
  });

  it('is not available for an Invalidated signal', () => {
    expect(copySetupText({ ...input, signal: { ...signal, status: 'INVALIDATED' } })).toBeNull();
  });
});
