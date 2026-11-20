// Confluence fixtures (spec §8): minimal analyses where only the scenarios' directions matter.
import type { Direction, Scenario, Timeframe, TimeframeAnalysis } from '../../../types.ts';

const scenario = (rank: Scenario['rank'], direction: Direction): Scenario => ({
  rank,
  count: { impulseDirection: direction, points: [], lastLabel: '2', ratios: {}, rules: [], score: 0 },
  direction,
  waveInProgress: '',
  projected: [],
  confidence: rank === 'primary' ? 100 : 0,
  invalidationPrice: 0,
  invalidationReason: '',
  thesis: '',
});

// `null` primary = Neutral timeframe.
export const analysis = (
  timeframe: Timeframe,
  primary: Direction | null,
  alternative: Direction | null = null,
): TimeframeAnalysis => ({
  timeframe,
  analysedAt: 0,
  primary: primary && scenario('primary', primary),
  alternative: alternative && scenario('alternative', alternative),
  primaryLevels: null,
  alternativeLevels: null,
});

type Vote = Direction | null;

// Votes in the order 1h, 4h, 1d, 1w.
export const analyses = ([h1, h4, d1, w1]: [Vote, Vote, Vote, Vote]): Record<Timeframe, TimeframeAnalysis> => ({
  '1h': analysis('1h', h1),
  '4h': analysis('4h', h4),
  '1d': analysis('1d', d1),
  '1w': analysis('1w', w1),
});
