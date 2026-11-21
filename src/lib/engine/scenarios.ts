// Scenarios (spec §5): Primary/Alternative ranking, confidence, direction, invalidation and thesis.
// Pure: valid counts in, scenarios out.
import { DETAIL_DECIMALS, PROJECTION } from '../../config.ts';
import type { Count, Direction, Scenario, Timeframe, WaveLabel, WavePoint } from '../../types.ts';
import { isRule2Pending, project } from './projections.ts';

type LastLabel = '2' | '3' | '4' | '5' | 'A' | 'B';

const WAVE_IN_PROGRESS: Record<LastLabel, string> = {
  '2': 'Wave 3 in progress',
  '3': 'Wave 4 forming',
  '4': 'Wave 5 in progress',
  '5': 'Correction A in progress',
  A: 'Wave B in progress',
  B: 'Wave C in progress',
};

// §5.4: the wave in progress moves with the impulse after (2), (4), (A); against it otherwise.
const WITH_IMPULSE: ReadonlySet<WaveLabel> = new Set(['2', '4', 'A']);
// §5.5: after (5), (A), (B) the scenario dies beyond the Wave 5 extreme.
const IMPULSE_COMPLETE: ReadonlySet<WaveLabel> = new Set(['5', 'A', 'B']);

const INVALIDATION: Record<LastLabel, { point: number; reason: string }> = {
  '2': { point: 0, reason: 'Wave 2 would retrace past the start of Wave 1 (Rule 1)' },
  '3': { point: 1, reason: 'Wave 4 would overlap Wave 1 (Rule 3)' },
  '4': { point: 1, reason: 'Wave 4 would overlap Wave 1 (Rule 3)' },
  '5': { point: 5, reason: 'Price beyond the Wave 5 extreme: the impulse is not over' },
  A: { point: 5, reason: 'Price beyond the Wave 5 extreme: the impulse is not over' },
  B: { point: 5, reason: 'Price beyond the Wave 5 extreme: the impulse is not over' },
};

const fmt = (x: number) => x.toFixed(DETAIL_DECIMALS);
// Fibonacci targets keep their own digits, with at least one decimal (1 → "1.0").
const fib = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));
const sign = (count: Count) => (count.impulseDirection === 'bullish' ? 1 : -1);
const opposite = (d: Direction): Direction => (d === 'bullish' ? 'bearish' : 'bullish');

function thesis(count: Count, projected: readonly WavePoint[], invalidationPrice: number): string {
  const r = count.ratios;
  const next = fmt(projected[0].price);
  const complete = IMPULSE_COMPLETE.has(count.lastLabel);
  const name = count.impulseDirection === 'bullish' ? 'Bullish' : 'Bearish';
  const side = (sign(count) === 1) === complete ? 'above' : 'below';

  const clauses: Record<LastLabel, () => string> = {
    '2': () => `Wave 2 retraced ${fmt(r.w2Retracement!)} of Wave 1; Wave 3 in progress toward ${fib(PROJECTION.w3Extension)} at ${next}`,
    '3': () => `Wave 3 extended ${fmt(r.w3Extension!)} of Wave 1; Wave 4 forming toward ${fib(PROJECTION.w4Retracement)} at ${next}`,
    '4': () =>
      `Wave 4 retraced ${fmt(r.w4Retracement!)} of Wave 3; ` +
      (isRule2Pending(count)
        ? `Wave 5 in progress toward ${next} (capped at Wave 3 length)`
        : `Wave 5 in progress toward ${fib(PROJECTION.w5Extension)} at ${next}`),
    '5': () => `Wave 5 extended ${fmt(r.w5Extension!)} of Wave 1; Correction A in progress toward ${fib(PROJECTION.aRetracement)} at ${next}`,
    A: () => `Wave A retraced ${fmt(r.aRetracement!)} of the impulse; Wave B in progress toward ${fib(PROJECTION.bRetracement)} at ${next}`,
    B: () => `Wave B retraced ${fmt(r.bRetracement!)} of Wave A; Wave C in progress toward ${fib(PROJECTION.cExtension)} at ${next}`,
  };

  const impulse = complete ? `${name} impulse complete` : `${name} impulse`;
  return `${impulse}; ${clauses[count.lastLabel as LastLabel]()}; invalid ${side} ${fmt(invalidationPrice)}.`;
}

function toScenario(
  count: Count,
  rank: Scenario['rank'],
  confidence: number,
  lastClosedIndex: number,
  timeframe: Timeframe,
): Scenario {
  const label = count.lastLabel as LastLabel;
  const projected = project(count, lastClosedIndex, timeframe);
  const { point, reason } = INVALIDATION[label];
  const invalidationPrice = count.points[point].price;
  return {
    rank,
    count,
    direction: WITH_IMPULSE.has(label) ? count.impulseDirection : opposite(count.impulseDirection),
    waveInProgress: WAVE_IN_PROGRESS[label],
    projected,
    confidence,
    invalidationPrice,
    invalidationReason: reason,
    thesis: thesis(count, projected, invalidationPrice),
  };
}

// lastClosedIndex: index of the last closed candle, in the same series as the pivots.
export function buildScenarios(
  counts: readonly Count[],
  lastClosedIndex: number,
  timeframe: Timeframe,
): { primary: Scenario | null; alternative: Scenario | null } {
  const [p, a] = [...counts].sort((x, y) => y.score - x.score || y.points.length - x.points.length);
  if (!p) return { primary: null, alternative: null };
  if (!a) return { primary: toScenario(p, 'primary', p.score * 100, lastClosedIndex, timeframe), alternative: null };

  const total = p.score + a.score;
  const primaryConfidence = total > 0 ? (p.score / total) * 100 : 50;
  return {
    primary: toScenario(p, 'primary', primaryConfidence, lastClosedIndex, timeframe),
    alternative: toScenario(a, 'alternative', 100 - primaryConfidence, lastClosedIndex, timeframe),
  };
}

// §5.5: breach is `s·(price − invalidation) ≤ 0` before the impulse completes, `s·(price − P5) > 0` after.
export function isInvalidated(scenario: Scenario, price: number): boolean {
  const s = sign(scenario.count);
  const d = s * (price - scenario.invalidationPrice);
  return IMPULSE_COMPLETE.has(scenario.count.lastLabel) ? d > 0 : d <= 0;
}
