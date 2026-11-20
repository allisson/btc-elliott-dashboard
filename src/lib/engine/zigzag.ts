// ZigZag pivots (spec §4.1). Pure: candles and θ in, confirmed pivots out.
import type { Candle, Pivot } from '../../types.ts';

interface RunningExtreme {
  index: number;
  price: number;
}

// 'peak' while tracking the running high, 'trough' while tracking the running low,
// null before the first pivot (both are tracked).
type Tracking = Pivot['type'] | null;

export function zigzag(candles: readonly Candle[], threshold: number): Pivot[] {
  const pivots: Pivot[] = [];
  if (candles.length < 2) return pivots;

  let high: RunningExtreme = { index: 0, price: candles[0].high };
  let low: RunningExtreme = { index: 0, price: candles[0].low };
  let tracking: Tracking = null;

  const emit = (extreme: RunningExtreme, type: Pivot['type']) => {
    pivots.push({ index: extreme.index, time: candles[extreme.index].time, price: extreme.price, type });
  };

  for (let j = 1; j < candles.length; j++) {
    const c = candles[j];

    if (tracking === null) {
      // Extend first; a candle never confirms an extreme it just set.
      if (c.high > high.price) high = { index: j, price: c.high };
      if (c.low < low.price) low = { index: j, price: c.low };
      const fall = high.index !== j && c.low <= high.price * (1 - threshold);
      const rise = low.index !== j && c.high >= low.price * (1 + threshold);
      if (fall && !rise) {
        emit(high, 'peak');
        tracking = 'trough';
        low = { index: j, price: c.low };
      } else if (rise && !fall) {
        emit(low, 'trough');
        tracking = 'peak';
        high = { index: j, price: c.high };
      }
      // Both met: ambiguous start, wait for a candle that meets only one.
    } else if (tracking === 'peak') {
      if (c.high > high.price) {
        high = { index: j, price: c.high };
      } else if (c.low <= high.price * (1 - threshold)) {
        emit(high, 'peak');
        tracking = 'trough';
        low = { index: j, price: c.low };
      }
    } else {
      if (c.low < low.price) {
        low = { index: j, price: c.low };
      } else if (c.high >= low.price * (1 + threshold)) {
        emit(low, 'trough');
        tracking = 'peak';
        high = { index: j, price: c.high };
      }
    }
  }

  return pivots;
}
