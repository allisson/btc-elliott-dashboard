// One timeframe's analysis at candle close (spec §6.5): pivots, counts, scenarios and setup levels. Pure.
import { TIMEFRAMES } from '../../config.ts';
import type { Candle, Timeframe, TimeframeAnalysis } from '../../types.ts';
import { findCounts } from './counts.ts';
import { buildScenarios } from './scenarios.ts';
import { buildLevels } from './setups.ts';
import { zigzag } from './zigzag.ts';

// closed: the timeframe's closed candles only, oldest first (the open candle is never analysed).
export function analyseTimeframe(closed: readonly Candle[], timeframe: Timeframe): TimeframeAnalysis {
  const tf = TIMEFRAMES.find((t) => t.id === timeframe)!;
  const lastClosedIndex = closed.length - 1;
  const closes = closed.map((c) => c.close);
  const { primary, alternative } = buildScenarios(findCounts(zigzag(closed, tf.zigzagThreshold)), lastClosedIndex, tf.seconds);
  return {
    timeframe,
    analysedAt: closed[lastClosedIndex].time + tf.seconds,
    primary,
    alternative,
    primaryLevels: primary && buildLevels(primary, closes),
    alternativeLevels: alternative && buildLevels(alternative, closes),
  };
}
