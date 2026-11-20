// Hand-built pivots with chosen candle indices, and the closes that join them (spec §6.1–§6.2).
import type { Pivot } from '../../../types.ts';
import { MIRROR } from './counts.ts';

const STEP_SECONDS = 3_600;

// Alternating pivots starting with `firstType`, at the given candle indices.
export function pivotsAt(firstType: Pivot['type'], prices: readonly number[], indices: readonly number[]): Pivot[] {
  return prices.map((price, i) => ({
    index: indices[i],
    time: indices[i] * STEP_SECONDS,
    price,
    type: (i % 2 === 0) === (firstType === 'trough') ? 'trough' : 'peak',
  }));
}

// Closes flat at the first pivot's price up to its index, then linear between pivots.
export function closesThrough(list: readonly Pivot[]): number[] {
  const closes: number[] = new Array(list[0].index + 1).fill(list[0].price);
  for (let k = 1; k < list.length; k++) {
    const [a, b] = [list[k - 1], list[k]];
    for (let i = a.index + 1; i <= b.index; i++) {
      closes.push(a.price + ((b.price - a.price) * (i - a.index)) / (b.index - a.index));
    }
  }
  return closes;
}

export const mirrorCloses = (closes: readonly number[]): number[] => closes.map((c) => MIRROR - c);

// Wave 5 counts for Setup 3a. Indices put P3 past the RSI warm-up (index ≥ 14).
// BASE prices: PA' 248.32 is not beyond P4 240, so TP1 and TP2 swap.
export const W5_PRICES = [100, 200, 140, 300, 240, 340] as const;
// Steep Wave 3 (2 candles), slow Wave 5 (10 candles): new high, lower RSI.
export const W5_DIVERGENT = [20, 24, 28, 30, 34, 44] as const;
// One-candle Wave 3 after a long Wave 2, long steady Wave 5: new high and higher RSI.
export const W5_CONFIRMED = [20, 24, 34, 35, 36, 80] as const;
// P3 at index 13: RSI is undefined there.
export const W5_EARLY = [1, 4, 7, 13, 16, 26] as const;
// PA' 279.22 is beyond P4 290 for the SHORT: no swap.
export const W5_NO_SWAP_PRICES = [100, 200, 140, 300, 290, 390] as const;
