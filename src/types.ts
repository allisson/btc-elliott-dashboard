// Domain types: spec §10. Vocabulary follows GLOSSARY.md.

export type Timeframe = '1h' | '4h' | '1d' | '1w';
export type Direction = 'bullish' | 'bearish';
export type WaveLabel = '0' | '1' | '2' | '3' | '4' | '5' | 'A' | 'B' | 'C';

export interface Candle {
  time: number; // seconds UTC, candle open
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Pivot {
  index: number;
  time: number;
  price: number;
  type: 'peak' | 'trough';
}

export interface WavePoint {
  label: WaveLabel;
  time: number;
  price: number;
  index: number | null; // null for projected points
  projected: boolean;
  targetRange?: { min: number; max: number };
}

export type RuleId = 'rule1' | 'rule2' | 'rule3';
export interface RuleCheck {
  rule: RuleId;
  status: 'valid' | 'violated' | 'not_yet';
  detail: string;
}

export interface FibRatios {
  w2Retracement?: number;
  w3Extension?: number;
  w4Retracement?: number;
  w5Extension?: number;
  aRetracement?: number;
  bRetracement?: number;
}

export interface Count {
  impulseDirection: Direction; // s
  points: WavePoint[];         // confirmed only
  lastLabel: WaveLabel;
  ratios: FibRatios;
  rules: RuleCheck[];
  score: number;               // 0..1
}

export interface Scenario {
  rank: 'primary' | 'alternative';
  count: Count;
  direction: Direction;        // direction of the wave in progress (§5.4)
  waveInProgress: string;      // UI label (§4.2)
  projected: WavePoint[];
  confidence: number;          // 0..100
  invalidationPrice: number;
  invalidationReason: string;
  thesis: string;
}

export type SetupId = 'setup1' | 'setup2' | 'setup3a' | 'setup3b';

export interface SignalLevels {   // fixed at candle close
  setup: SetupId;
  side: 'LONG' | 'SHORT';
  triggerMet: boolean;
  takeProfit1: number;
  takeProfit2: number;
}

export interface Signal extends SignalLevels {  // recomputed on every ticker update
  timeframe: Timeframe;
  entry: number;
  stopLoss: number;            // entry ∓ risk per trade (§7): it moves with the entry
  rr1: number;
  rr2: number;
  status: 'ACTIVE' | 'WATCHING' | 'INVALIDATED';
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  analysedAt: number;          // close time of the last analysed candle
  primary: Scenario | null;    // null = Neutral
  alternative: Scenario | null;
  primaryLevels: SignalLevels | null;
  alternativeLevels: SignalLevels | null;
}

export interface RiskSettings {
  capital: number;
  riskPercent: number;
}

export interface PositionSize {
  positionUsd: number;
  positionBtc: number;
  riskUsd: number;
  riskPercent: number;
}

export interface Confluence {
  agree: number;               // 0..4
  majority: Direction | 'split' | null;
  label: 'strong' | 'mixed' | 'none';
}

export interface Ticker {
  price: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}
