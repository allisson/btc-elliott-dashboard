// Setups and signals (spec §6.2–§6.4): targets fixed at candle close; stop loss, status, R:R and the
// live rules checklist on every ticker update. Pure. Formulas are written for s = +1 and mirrored.
import { MIN_RR1, SETUP_3B_TP2_EXTENSION, SETUP_TRIGGERS } from '../../config.ts';
import type { Candle, RuleCheck, RuleId, Scenario, Signal, SignalLevels, Timeframe } from '../../types.ts';
import { isRule2Pending } from './projections.ts';
import { hasDivergence } from './rsi.ts';
import { isInvalidated } from './scenarios.ts';

// The open candle of the scenario's timeframe: its extremes cover every trade since the last close.
export type OpenCandle = Pick<Candle, 'high' | 'low'>;

type Range = { readonly min: number; readonly max: number };

const within = (x: number | undefined, r: Range) => x !== undefined && x >= r.min && x <= r.max;
const sign = (scenario: Scenario) => (scenario.count.impulseDirection === 'bullish' ? 1 : -1);
const tradeSign = (levels: SignalLevels) => (levels.side === 'LONG' ? 1 : -1);
const probes = (price: number, candle: OpenCandle) => [price, candle.high, candle.low];

// closes: the closed candles of the scenario's series (Setup 3a reads RSI from them).
export function buildLevels(scenario: Scenario, closes: readonly number[]): SignalLevels | null {
  const { count } = scenario;
  const P = count.points.map((p) => p.price);
  const next = scenario.projected[0]?.price;

  let base: Omit<SignalLevels, 'side'>;
  switch (count.lastLabel) {
    case '2':
      base = {
        setup: 'setup1',
        triggerMet: within(count.ratios.w2Retracement, SETUP_TRIGGERS.setup1W2Retracement),
        takeProfit1: P[1],
        takeProfit2: next,
      };
      break;
    case '4':
      // "Rule 3 holds" is always true for a surviving count (§6.2).
      base = {
        setup: 'setup2',
        triggerMet: within(count.ratios.w4Retracement, SETUP_TRIGGERS.setup2W4Retracement),
        takeProfit1: P[3],
        takeProfit2: next,
      };
      break;
    case '5':
      base = { setup: 'setup3a', triggerMet: hasDivergence(count, closes), takeProfit1: P[4], takeProfit2: next };
      break;
    case 'B':
      base = {
        setup: 'setup3b',
        triggerMet: within(count.ratios.bRetracement, SETUP_TRIGGERS.setup3bBRetracement),
        takeProfit1: P[6],
        takeProfit2: P[7] + SETUP_3B_TP2_EXTENSION * (P[6] - P[5]),
      };
      break;
    default:
      return null;
  }

  const levels: SignalLevels = { ...base, side: scenario.direction === 'bullish' ? 'LONG' : 'SHORT' };
  // TP1 is always the nearer target (§6.2).
  if (tradeSign(levels) * (levels.takeProfit2 - levels.takeProfit1) < 0) {
    return { ...levels, takeProfit1: levels.takeProfit2, takeProfit2: levels.takeProfit1 };
  }
  return levels;
}

// §6.2: the wave whose completion unlocks the next setup, for last points with no setup.
export function noSetupReason(scenario: Scenario): string | null {
  if (scenario.count.lastLabel === '3') return 'No setup: waiting for Wave 4 to complete (then Setup 2)';
  if (scenario.count.lastLabel === 'A') return 'No setup: waiting for Wave B to complete (then Setup 3b)';
  return null;
}

// §6.4: a signal whose two targets the price has already passed has nothing left to trade.
export const TARGETS_PASSED = 'No setup: both targets passed';

// §6.3, §7: the stop sits risk% from the entry, so it moves with it; R:R is signed, ≤ 0 once the
// price has reached or passed the target.
export function priceMetrics(levels: SignalLevels, entry: number, riskPercent: number): { stopLoss: number; rr1: number; rr2: number } {
  const t = tradeSign(levels);
  const risk = (entry * riskPercent) / 100;
  return {
    stopLoss: entry - t * risk,
    rr1: (t * (levels.takeProfit1 - entry)) / risk,
    rr2: (t * (levels.takeProfit2 - entry)) / risk,
  };
}

export const deltaPercent = (x: number, entry: number): number => ((x - entry) / entry) * 100;

// §6.4: status from the live price and the open candle's extremes since the last close. The stop
// moves with the price, so only the scenario's invalidation price invalidates the signal.
export function evaluateSignal(
  scenario: Scenario,
  levels: SignalLevels,
  timeframe: Timeframe,
  price: number,
  openCandle: OpenCandle,
  riskPercent: number,
): Signal {
  const { stopLoss, rr1, rr2 } = priceMetrics(levels, price, riskPercent);
  const invalidated = probes(price, openCandle).some((x) => isInvalidated(scenario, x));
  // The target is the nearest one not yet reached: once TP1 is passed, TP2 (§6.4).
  const rr = rr1 > 0 ? rr1 : rr2;

  let status: Signal['status'] = 'WATCHING';
  if (invalidated) status = 'INVALIDATED';
  else if (levels.triggerMet && rr >= MIN_RR1) status = 'ACTIVE';

  return { ...levels, timeframe, entry: price, stopLoss, rr1, rr2, status };
}

// §4.3: the checklist after breaches since the last close, per scenario with or without a setup.
export function liveRules(scenario: Scenario, price: number, openCandle: OpenCandle): RuleCheck[] {
  const { count } = scenario;
  const s = sign(scenario);
  const P = count.points.map((p) => p.price);
  const xs = probes(price, openCandle);
  const invalidated = xs.some((x) => isInvalidated(scenario, x));

  const violated = new Set<RuleId>();
  if (invalidated && count.lastLabel === '2') violated.add('rule1');
  if (invalidated && (count.lastLabel === '3' || count.lastLabel === '4')) violated.add('rule3');
  if (count.lastLabel === '4' && isRule2Pending(count)) {
    // Wave 5 may not be longer than Wave 3.
    const cap = P[4] + s * Math.abs(P[3] - P[2]);
    if (xs.some((x) => s * (x - cap) > 0)) violated.add('rule2');
  }

  return count.rules.map((r) => (violated.has(r.rule) ? { ...r, status: 'violated' } : r));
}
