// Confluence (spec §8): each non-Neutral timeframe votes with its Primary Scenario's direction.
// Pure: analyses in, confluence out.
import { CONFLUENCE_MIN_MIXED, TIMEFRAMES } from '../../config.ts';
import type { Confluence, Timeframe, TimeframeAnalysis } from '../../types.ts';

export function confluence(analyses: Record<Timeframe, TimeframeAnalysis>): Confluence {
  let bullish = 0;
  let bearish = 0;
  for (const { id } of TIMEFRAMES) {
    const direction = analyses[id].primary?.direction;
    if (direction === 'bullish') bullish++;
    else if (direction === 'bearish') bearish++;
  }

  const agree = Math.max(bullish, bearish);
  if (agree < CONFLUENCE_MIN_MIXED) return { agree, majority: null, label: 'none' };

  const majority = bullish === bearish ? 'split' : bullish > bearish ? 'bullish' : 'bearish';
  return { agree, majority, label: agree === TIMEFRAMES.length ? 'strong' : 'mixed' };
}
