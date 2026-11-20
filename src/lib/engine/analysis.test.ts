import { describe, expect, it } from 'vitest';
import { analyseTimeframe } from './analysis.ts';
import type { Candle } from '../../types.ts';
import { closesThrough, mirrorCloses, pivotsAt, W5_CONFIRMED, W5_DIVERGENT, W5_PRICES } from './__fixtures__/setups.ts';
import { fallingFirst, neverReaches, risingFirst } from './__fixtures__/zigzag.ts';

// Candles whose high and low are the close; each opens at the previous close.
const fromCloses = (closes: readonly number[]): Candle[] =>
  closes.map((close, i) => ({ time: i * 3_600, open: i ? closes[i - 1] : close, high: close, low: close, close, volume: 0 }));

// At the 1h threshold (1.8%) the fixtures give these pivots:
// risingFirst: T99@0 P110@2 T98@4 P112@6 T104@8 → only the bullish (0)(1)(2) from T98 survives.
// fallingFirst: P101@0 T90@2 P100@4 T88@6 P96@8 → only the bearish (0)(1)(2) from P100 survives.
describe('analyseTimeframe', () => {
  it('bullish: Primary at (2) with Setup 1 LONG levels', () => {
    const a = analyseTimeframe(risingFirst, '1h');
    expect(a.timeframe).toBe('1h');
    expect(a.analysedAt).toBe(10 * 3_600); // close of candle 9
    expect(a.primary?.count.lastLabel).toBe('2');
    expect(a.primary?.direction).toBe('bullish');
    expect(a.alternative).toBeNull();
    expect(a.alternativeLevels).toBeNull();
    expect(a.primaryLevels).toMatchObject({ setup: 'setup1', side: 'LONG', triggerMet: true, takeProfit1: 112 });
    expect(a.primaryLevels?.stopLoss).toBeCloseTo(98 * 0.995, 9);
    expect(a.primaryLevels?.takeProfit2).toBeCloseTo(104 + 1.618 * 14, 9);
  });

  it('bearish: Primary at (2) with Setup 1 SHORT levels', () => {
    const a = analyseTimeframe(fallingFirst, '1h');
    expect(a.primary?.count.lastLabel).toBe('2');
    expect(a.primary?.direction).toBe('bearish');
    expect(a.primaryLevels).toMatchObject({ setup: 'setup1', side: 'SHORT', triggerMet: true, takeProfit1: 88 });
    expect(a.primaryLevels?.stopLoss).toBeCloseTo(100 * 1.005, 9);
    expect(a.primaryLevels?.takeProfit2).toBeCloseTo(96 - 1.618 * 12, 9);
  });

  it('uses the timeframe interval for analysedAt', () => {
    expect(analyseTimeframe(risingFirst, '4h').analysedAt).toBe(9 * 3_600 + 14_400);
  });

  // Setup 3a reads RSI from the closes: the same Wave 5 prices diverge or not depending on timing.
  it.each([
    ['diverging', W5_DIVERGENT, true],
    ['confirming', W5_CONFIRMED, false],
  ] as const)('Wave 5 %s RSI sets the Setup 3a trigger, both directions', (_, indices, met) => {
    // One more close confirms P5 at the 1h threshold in both directions (340 → 320, mirrored 660 → 680).
    const bull = [...closesThrough(pivotsAt('trough', W5_PRICES, indices)), 320];
    for (const closes of [bull, mirrorCloses(bull)]) {
      const a = analyseTimeframe(fromCloses(closes), '1h');
      expect(a.primary?.count.lastLabel).toBe('5');
      expect(a.primaryLevels).toMatchObject({ setup: 'setup3a', triggerMet: met });
    }
  });

  it('no pivots: Neutral', () => {
    const a = analyseTimeframe(neverReaches, '1h');
    expect(a).toMatchObject({ primary: null, alternative: null, primaryLevels: null, alternativeLevels: null });
  });
});
