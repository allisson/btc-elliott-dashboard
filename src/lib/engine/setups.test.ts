import { describe, expect, it } from 'vitest';
import type { Count, Pivot, Scenario } from '../../types.ts';
import { findCounts } from './counts.ts';
import { buildScenarios } from './scenarios.ts';
import { buildLevels, deltaPercent, evaluateSignal, liveRules, noSetupReason, priceMetrics } from './setups.ts';
import * as fx from './__fixtures__/counts.ts';
import * as sx from './__fixtures__/setups.ts';

// Bullish trades are written by hand; the bearish side mirrors prices (p → MIRROR − p), flips the
// trade side and uses the mirrored SL multipliers.
const sides = [
  {
    side: 'bullish', s: 1, flip: (list: Pivot[]) => list, flipCloses: (c: number[]) => c, map: (x: number) => x,
    below: 0.995, above: 1.008, withImpulse: 'LONG', against: 'SHORT',
  },
  {
    side: 'bearish', s: -1, flip: fx.mirror, flipCloses: sx.mirrorCloses, map: (x: number) => fx.MIRROR - x,
    below: 1.005, above: 0.992, withImpulse: 'SHORT', against: 'LONG',
  },
] as const;

const lastIndex = (c: Count) => c.points[c.points.length - 1].index!;
const scenarioFrom = (list: Pivot[]): Scenario => {
  const count = findCounts(list).find((c) => c.points[0].index === list[0].index)!;
  return buildScenarios([count], lastIndex(count) + 1, 3_600).primary!;
};
const candle = (price: number) => ({ high: price, low: price });

describe.each(sides)('buildLevels ($side)', ({ s, flip, flipCloses, map, below, above, withImpulse, against }) => {
  const scenarioOf = (prices: readonly number[]) => scenarioFrom(flip(fx.pivots('trough', prices)));
  const levelsOf = (prices: readonly number[]) => buildLevels(scenarioOf(prices), [])!;

  describe('Setup 1: Wave 2→3', () => {
    it('meets the trigger with W2 0.6 and sets SL, TP1 = P1, TP2 = P3′', () => {
      const levels = levelsOf([100, 200, 140]);
      expect(levels).toMatchObject({ setup: 'setup1', side: withImpulse, triggerMet: true, takeProfit1: map(200) });
      expect(levels.stopLoss).toBeCloseTo(map(100) * below, 9);
      expect(levels.takeProfit2).toBeCloseTo(map(301.8), 9);
    });

    it('misses the trigger with W2 0.2', () => {
      expect(levelsOf([100, 200, 180]).triggerMet).toBe(false);
    });
  });

  describe('Setup 2: Wave 4→5', () => {
    it('meets the trigger with W4 0.375 and sets SL, TP1 = P3, TP2 = P5′', () => {
      const levels = levelsOf(fx.BASE.slice(0, 5));
      expect(levels).toMatchObject({ setup: 'setup2', side: withImpulse, triggerMet: true, takeProfit1: map(300) });
      expect(levels.stopLoss).toBeCloseTo(map(200) * below, 9);
      expect(levels.takeProfit2).toBeCloseTo(map(340), 9);
    });

    it('misses the trigger with W4 0.125', () => {
      expect(levelsOf([100, 200, 140, 300, 280]).triggerMet).toBe(false);
    });

    it('swaps TP1 and TP2 when P5′ falls short of P3 (W1 50 < W4 80)', () => {
      const levels = levelsOf([100, 150, 120, 300, 220]);
      expect(levels.triggerMet).toBe(true);
      expect(levels.takeProfit1).toBeCloseTo(map(270), 9);
      expect(levels.takeProfit2).toBeCloseTo(map(300), 9);
    });

    it('uses the capped P5′ when Rule 2 is pending', () => {
      // W1 100, W3 90: P5′ capped at P4 + 90 = 300.
      expect(levelsOf(fx.RULE2_PENDING_M5).takeProfit2).toBeCloseTo(map(300), 9);
    });
  });

  describe('Setup 3a: Wave 5 exhaustion', () => {
    const wave5 = (prices: readonly number[], indices: readonly number[]) => {
      const list = sx.pivotsAt('trough', prices, indices);
      return buildLevels(scenarioFrom(flip(list)), flipCloses(sx.closesThrough(list)))!;
    };

    it('meets the trigger on RSI divergence and swaps TP1 = PA′, TP2 = P4 when PA′ is short of P4', () => {
      const levels = wave5(sx.W5_PRICES, sx.W5_DIVERGENT);
      expect(levels).toMatchObject({ setup: 'setup3a', side: against, triggerMet: true });
      expect(levels.stopLoss).toBeCloseTo(map(340) * above, 9);
      expect(levels.takeProfit1).toBeCloseTo(map(248.32), 9);
      expect(levels.takeProfit2).toBeCloseTo(map(240), 9);
    });

    it('misses the trigger without divergence', () => {
      expect(wave5(sx.W5_PRICES, sx.W5_CONFIRMED).triggerMet).toBe(false);
    });

    it('keeps TP1 = P4 and TP2 = PA′ when PA′ is beyond P4', () => {
      const levels = wave5(sx.W5_NO_SWAP_PRICES, sx.W5_DIVERGENT);
      expect(levels.takeProfit1).toBeCloseTo(map(290), 9);
      expect(levels.takeProfit2).toBeCloseTo(map(279.22), 9);
    });
  });

  describe('Setup 3b: Wave B→C', () => {
    it('meets the trigger with B 0.556 and sets SL, TP1 = PA, TP2 = PB + 1.618·A', () => {
      const levels = levelsOf(fx.BASE);
      expect(levels).toMatchObject({ setup: 'setup3b', side: against, triggerMet: true, takeProfit1: map(250) });
      expect(levels.stopLoss).toBeCloseTo(map(300) * above, 9);
      expect(levels.takeProfit2).toBeCloseTo(map(154.38), 9);
    });

    it('misses the trigger with B 0.222', () => {
      expect(levelsOf([100, 200, 140, 300, 240, 340, 250, 270]).triggerMet).toBe(false);
    });
  });

  it.each([
    [4, 'No setup: waiting for Wave 4 to complete (then Setup 2)'],
    [7, 'No setup: waiting for Wave B to complete (then Setup 3b)'],
  ])('m = %i has no setup and says what unlocks the next one', (m, reason) => {
    const scenario = scenarioOf(fx.BASE.slice(0, m));
    expect(buildLevels(scenario, [])).toBeNull();
    expect(noSetupReason(scenario)).toBe(reason);
  });

  it.each([3, 5, 6, 8])('m = %i has a setup and no "no setup" reason', (m) => {
    expect(noSetupReason(scenarioOf(fx.BASE.slice(0, m)))).toBeNull();
  });

  it('keeps s in the mirrored SL multiplier', () => {
    expect(Math.sign(map(100) - levelsOf([100, 200, 140]).stopLoss)).toBe(s);
  });
});

describe('price metrics', () => {
  const levels = { setup: 'setup1', side: 'LONG', triggerMet: true, stopLoss: 99.5, takeProfit1: 200, takeProfit2: 301.8 } as const;

  it('computes risk and R:R from the entry', () => {
    const { risk, rr1, rr2 } = priceMetrics(levels, 140);
    expect(risk).toBeCloseTo(40.5, 9);
    expect(rr1).toBeCloseTo(60 / 40.5, 9);
    expect(rr2).toBeCloseTo(161.8 / 40.5, 9);
  });

  it('computes Δ% from the entry', () => {
    expect(deltaPercent(99.5, 140)).toBeCloseTo(-28.928571, 5);
    expect(deltaPercent(200, 140)).toBeCloseTo(42.857143, 5);
  });

  it('computes the SHORT side the same way', () => {
    const short = { ...levels, side: 'SHORT', stopLoss: 904.5, takeProfit1: 800, takeProfit2: 698.2 } as const;
    const { risk, rr1, rr2 } = priceMetrics(short, 860);
    expect(risk).toBeCloseTo(44.5, 9);
    expect(rr1).toBeCloseTo(60 / 44.5, 9);
    expect(rr2).toBeCloseTo(161.8 / 44.5, 9);
  });
});

describe.each(sides)('evaluateSignal ($side)', ({ s, flip, map }) => {
  const scenarioOf = (prices: readonly number[]) => scenarioFrom(flip(fx.pivots('trough', prices)));
  const statusAt = (prices: readonly number[], price: number, openCandle = candle(map(price))) => {
    const scenario = scenarioOf(prices);
    return evaluateSignal(scenario, buildLevels(scenario, [])!, '4h', map(price), openCandle);
  };
  // Setup 1 on (100, 200, 140): SL 99.5 (or its mirror), TP1 200, invalidation P0 100.
  const SETUP1 = [100, 200, 140] as const;

  it('is ACTIVE with the trigger met, price between SL and TP1 and rr1 ≥ 1', () => {
    const signal = statusAt(SETUP1, 140);
    expect(signal).toMatchObject({ status: 'ACTIVE', timeframe: '4h', entry: map(140), setup: 'setup1' });
  });

  it('is WATCHING when the trigger is not met', () => {
    expect(statusAt([100, 200, 180], 130).status).toBe('WATCHING');
  });

  it.each([200, 205])('is WATCHING at or past TP1 (%i)', (price) => {
    expect(statusAt(SETUP1, price).status).toBe('WATCHING');
  });

  it('is WATCHING when rr1 < 1', () => {
    const signal = statusAt(SETUP1, 160);
    expect(signal.rr1).toBeLessThan(1);
    expect(signal.status).toBe('WATCHING');
  });

  it('is INVALIDATED when price reaches the invalidation price', () => {
    expect(statusAt(SETUP1, 100).status).toBe('INVALIDATED');
  });

  it('is INVALIDATED when the open candle breached earlier, though price came back', () => {
    const openCandle = { high: Math.max(map(141), map(99)), low: Math.min(map(141), map(99)) };
    expect(statusAt(SETUP1, 140, openCandle).status).toBe('INVALIDATED');
  });

  it('is INVALIDATED on a stop-loss breach alone, inclusive (Setup 3b)', () => {
    const scenario = scenarioOf(fx.BASE);
    const levels = buildLevels(scenario, [])!;
    const at = (price: number) => evaluateSignal(scenario, levels, '4h', price, candle(price)).status;
    expect(at(levels.stopLoss)).toBe('INVALIDATED');
    expect(at(levels.stopLoss - s * 0.1)).toBe('ACTIVE');
    // Still short of the invalidation price P5.
    expect(s * (levels.stopLoss - map(340))).toBeLessThan(0);
  });
});

describe.each(sides)('liveRules ($side)', ({ s, flip, map }) => {
  const scenarioOf = (prices: readonly number[]) => scenarioFrom(flip(fx.pivots('trough', prices)));
  const statuses = (prices: readonly number[], price: number, openCandle = candle(map(price))) =>
    liveRules(scenarioOf(prices), map(price), openCandle).map((r) => r.status);

  it('keeps the close-time checklist without a breach', () => {
    const scenario = scenarioOf(fx.BASE.slice(0, 5));
    expect(liveRules(scenario, map(250), candle(map(250)))).toEqual(scenario.count.rules);
  });

  it('(2) breaching P0 violates Rule 1', () => {
    expect(statuses(fx.BASE.slice(0, 3), 100)).toEqual(['violated', 'not_yet', 'not_yet']);
  });

  it('(3) breaching P1 turns Rule 3 from NOT YET to VIOLATED', () => {
    expect(statuses(fx.BASE.slice(0, 4), 200)).toEqual(['valid', 'not_yet', 'violated']);
  });

  it('(4) breaching P1 violates Rule 3', () => {
    expect(statuses(fx.BASE.slice(0, 5), 200)).toEqual(['valid', 'not_yet', 'violated']);
  });

  it('(4) with Rule 2 pending violates Rule 2 only beyond P4 + len(W3)', () => {
    // P4 210, W3 90: cap 300.
    expect(statuses(fx.RULE2_PENDING_M5, 300)).toEqual(['valid', 'not_yet', 'valid']);
    expect(statuses(fx.RULE2_PENDING_M5, 280, { high: Math.max(map(301), map(280)), low: Math.min(map(301), map(280)) })).toEqual([
      'valid',
      'violated',
      'valid',
    ]);
  });

  it.each([6, 7, 8])('m = %i breaching P5 violates no rule', (m) => {
    const prices = fx.BASE.slice(0, m);
    expect(statuses(prices, 341)).toEqual(scenarioOf(prices).count.rules.map((r) => r.status));
  });

  it('marks the breach in the right direction only', () => {
    expect(s * (map(100) - map(140))).toBeLessThan(0);
    expect(statuses(fx.BASE.slice(0, 3), 140)).toEqual(['valid', 'not_yet', 'not_yet']);
  });
});
