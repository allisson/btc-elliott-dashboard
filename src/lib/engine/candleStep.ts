// Candle step (spec §3.1): the open time of the candle n steps after the one opening at `time`. Pure.
import { TIMEFRAMES } from '../../config.ts';
import type { Timeframe } from '../../types.ts';

export function candleStep(timeframe: Timeframe, time: number, n: number): number {
  const { seconds } = TIMEFRAMES.find((t) => t.id === timeframe)!;
  if (seconds !== null) return time + n * seconds;
  // Calendar month: 00:00 UTC on the first day (Date.UTC carries month overflow into the year).
  const d = new Date(time * 1000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1) / 1000;
}
