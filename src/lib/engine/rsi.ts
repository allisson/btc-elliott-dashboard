// RSI (spec §6.1): Wilder RSI over closes and the Wave 5 divergence. Pure: closes in, values out.
import { RSI_PERIOD } from '../../config.ts';
import type { Count } from '../../types.ts';

// RSI from the smoothed averages: 100 with no losses, 50 when price did not move at all.
const value = (gain: number, loss: number): number => {
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
};

// One value per close; undefined before index `period` (fewer than period + 1 closes up to it).
export function rsi(closes: readonly number[], period: number = RSI_PERIOD): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(closes.length).fill(undefined);
  if (closes.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }
  gain /= period;
  loss /= period;
  out[period] = value(gain, loss);

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = value(gain, loss);
  }
  return out;
}

// §6.1: for a count ending at (5), price makes a new extreme past P3 while RSI does not.
// closes: the closed candles of the same series as the count's points.
export function hasDivergence(count: Count, closes: readonly number[]): boolean {
  if (count.lastLabel !== '5') return false;
  const s = count.impulseDirection === 'bullish' ? 1 : -1;
  const [p3, p5] = [count.points[3], count.points[5]];
  const values = rsi(closes);
  const r3 = values[p3.index!];
  const r5 = values[p5.index!];
  if (r3 === undefined || r5 === undefined) return false;
  return s * (p5.price - p3.price) > 0 && s * (r5 - r3) < 0;
}
