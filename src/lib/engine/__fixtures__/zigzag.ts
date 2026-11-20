// Hand-built candle sequences for zigzag tests (spec §4.1). Only highs and lows matter.
import type { Candle } from '../../../types.ts';

export const THETA = 0.05;
const STEP_SECONDS = 3_600;

export function fromHighLow(rows: readonly (readonly [number, number])[]): Candle[] {
  return rows.map(([high, low], i) => ({
    time: i * STEP_SECONDS,
    open: (high + low) / 2,
    high,
    low,
    close: (high + low) / 2,
    volume: 0,
  }));
}

// Trough first: trough@0 99, peak@2 110, trough@4 98, peak@6 112; running low 104@8 unconfirmed.
export const risingFirst = fromHighLow([
  [101, 99], [104, 100], [110, 106], [108, 103], [102, 98],
  [104, 100], [112, 107], [109, 105], [108, 104], [107, 105],
]);

// Peak first: peak@0 101, trough@2 90, peak@4 100, trough@6 88; running high 96@8 unconfirmed.
export const fallingFirst = fromHighLow([
  [101, 99], [100, 95], [96, 90], [95, 91], [100, 96],
  [97, 94], [93, 88], [93, 90], [96, 92], [95, 93],
]);

// Total range 99–102: never moves θ.
export const neverReaches = fromHighLow([[101, 99], [102, 100], [101.5, 99.5], [100.5, 99]]);

// One-way trends: the only pivot is the start; the running extreme at the end is never emitted.
export const risingOnly = fromHighLow([[100, 99], [103, 101], [106, 104], [109, 107]]);
export const fallingOnly = fromHighLow([[101, 100], [100, 95], [96, 92], [93, 89]]);

// Confirmation at exactly θ, and one ulp-ish step short of it.
export const peakAtBoundary = (nudge: number) =>
  fromHighLow([[100, 99], [105, 100], [110, 106], [109, 110 * (1 - THETA) * nudge]]);
export const troughAtBoundary = (nudge: number) =>
  fromHighLow([[101, 100], [100, 95], [94, 90], [90 * (1 + THETA) * nudge, 91]]);
// Same, for the first pivot (before any direction is set).
export const firstPeakAtBoundary = (nudge: number) =>
  fromHighLow([[100, 99], [99.5, 100 * (1 - THETA) * nudge]]);
export const firstTroughAtBoundary = (nudge: number) =>
  fromHighLow([[101, 100], [100 * (1 + THETA) * nudge, 100.5]]);

// Outside candle at index 3: new extreme and a θ counter-move inside the same candle.
export const outsideUp = fromHighLow([[100, 99], [105, 100], [110, 106], [112, 104], [111, 106]]);
export const outsideDown = fromHighLow([[101, 100], [100, 95], [94, 90], [95, 88], [93, 89]]);

// Equal extremes at indexes 2 and 3: the pivot stays at 2.
export const equalHighs = fromHighLow([[100, 99], [105, 100], [110, 106], [110, 107], [108, 104]]);
export const equalLows = fromHighLow([[101, 100], [100, 95], [94, 90], [93, 90], [95, 92]]);

// Candle 0 spans more than θ; candle 1 meets both the fall and the rise; candle 2 decides.
export const ambiguousStart = fromHighLow([[110, 100], [106, 104]]);
export const ambiguousThenFall = fromHighLow([[110, 100], [106, 104], [104, 102]]);
export const ambiguousThenRise = fromHighLow([[110, 100], [106, 104], [107, 105]]);
