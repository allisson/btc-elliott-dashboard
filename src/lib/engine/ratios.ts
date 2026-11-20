// Ratios, grades and score (spec §4.4). Pure: a count's prices in, numbers out.
import { FIB_TARGETS, TOLERANCE } from '../../config.ts';
import type { FibRatios } from '../../types.ts';

// prices = P0, P1, … in count order (P0…P5, PA, PB).
export function measureRatios(prices: readonly number[]): FibRatios {
  const len = (n: number) => Math.abs(prices[n] - prices[n - 1]);
  const m = prices.length;
  const r: FibRatios = {};
  if (m >= 3) r.w2Retracement = len(2) / len(1);
  if (m >= 4) r.w3Extension = len(3) / len(1);
  if (m >= 5) r.w4Retracement = len(4) / len(3);
  if (m >= 6) r.w5Extension = len(5) / len(1);
  if (m >= 7) r.aRetracement = Math.abs(prices[5] - prices[6]) / Math.abs(prices[5] - prices[0]);
  if (m >= 8) r.bRetracement = Math.abs(prices[7] - prices[6]) / Math.abs(prices[5] - prices[6]);
  return r;
}

export function grade(ratio: number, targets: readonly number[]): number {
  const d = Math.min(...targets.map((t) => Math.abs(ratio - t)));
  return Math.max(0, 1 - d / TOLERANCE);
}

export function score(ratios: FibRatios): number {
  const grades = (Object.keys(ratios) as (keyof FibRatios)[]).map((k) => grade(ratios[k]!, FIB_TARGETS[k]));
  return grades.length === 0 ? 0 : grades.reduce((a, b) => a + b, 0) / grades.length;
}
