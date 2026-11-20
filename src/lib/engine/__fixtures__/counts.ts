// Hand-built pivot sequences for counts, rules and ratios tests (spec §4.2–§4.4).
// Prices are integers; the bearish side is the mirror p → MIRROR − p, which keeps every length.
import type { Pivot } from '../../../types.ts';

const STEP_SECONDS = 3_600;
export const MIRROR = 1000;

// Alternating pivots starting with `firstType`; index and time are sequential.
export function pivots(firstType: Pivot['type'], prices: readonly number[]): Pivot[] {
  return prices.map((price, i) => ({
    index: i * 2,
    time: i * 2 * STEP_SECONDS,
    price,
    type: (i % 2 === 0) === (firstType === 'trough') ? 'trough' : 'peak',
  }));
}

export function mirror(list: readonly Pivot[]): Pivot[] {
  return list.map((p) => ({ ...p, price: MIRROR - p.price, type: p.type === 'peak' ? 'trough' : 'peak' }));
}

// Bullish impulse and correction, P0…P5, PA, PB:
// W1 100, W2 60 (0.6), W3 160 (1.6), W4 60 (0.375), W5 100 (1.0), A 90/240 (0.375), B 50/90 (0.5556).
export const BASE = [100, 200, 140, 300, 240, 340, 250, 300] as const;

// Hand-computed grades for BASE with TOLERANCE 0.15.
export const BASE_GRADES = {
  w2Retracement: 1 - 0.018 / 0.15, // 0.6 vs 0.618
  w3Extension: 1 - 0.018 / 0.15, // 1.6 vs 1.618
  w4Retracement: 1 - 0.007 / 0.15, // 0.375 vs 0.382
  w5Extension: 1, // 1.0 vs 1.0
  aRetracement: 1 - 0.007 / 0.15, // 0.375 vs 0.382
  bRetracement: 1 - (50 / 90 - 0.5) / 0.15, // 0.5556 vs 0.5
} as const;

// Rule 1: P2 equal to P0 violates.
export const RULE1_VIOLATED = [100, 200, 100] as const;
// Structural W3 > W1: P3 equal to P1 violates.
export const W3_NOT_BEYOND_W1 = [100, 200, 140, 200] as const;
// Rule 3: P4 equal to P1 violates.
export const RULE3_VIOLATED = [100, 200, 140, 300, 200] as const;
// Rule 2 at m = 6. W1 100, W3 90; W5 varies.
export const RULE2_W1_SHORTEST_OTHER = [100, 200, 140, 230, 210, 320] as const; // W5 110: W3 < W1 = min
export const RULE2_W5_MIN = [100, 200, 140, 230, 210, 305] as const; // W5 95: W3 < W5 = min
export const RULE2_EQUAL = [100, 200, 140, 230, 210, 300] as const; // W5 90: W3 = min, passes
// Rule 2 pending: W3 90 < W1 100 before Wave 5 exists.
export const RULE2_PENDING_M4 = [100, 200, 140, 230] as const;
export const RULE2_PENDING_M5 = [100, 200, 140, 230, 210] as const;
// Structural B check: PB equal to P5 violates.
export const B_AT_P5 = [100, 200, 140, 300, 240, 340, 250, 340] as const;
