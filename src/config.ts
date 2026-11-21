// Every tunable constant lives here (spec §4.6). No magic numbers elsewhere.
import type { Timeframe } from './types.ts';

export const SYMBOL = 'BTCUSDT';

// §3.1
export interface TimeframeConfig {
  id: Timeframe;
  label: string;
  interval: string;
  seconds: number | null; // null = calendar month (1M); see candleStep
  zigzagThreshold: number; // fraction, e.g. 0.018 = 1.8%
}

export const TIMEFRAMES: readonly TimeframeConfig[] = [
  { id: '15m', label: '15M', interval: '15m', seconds: 900, zigzagThreshold: 0.01 },
  { id: '1h', label: '1H', interval: '1h', seconds: 3_600, zigzagThreshold: 0.018 },
  { id: '4h', label: '4H', interval: '4h', seconds: 14_400, zigzagThreshold: 0.032 },
  { id: '1d', label: '1D', interval: '1d', seconds: 86_400, zigzagThreshold: 0.055 },
  { id: '1w', label: '1W', interval: '1w', seconds: 604_800, zigzagThreshold: 0.095 },
  { id: '1M', label: '1M', interval: '1M', seconds: null, zigzagThreshold: 0.17 },
];

// §3.2, §3.3
export const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';
export const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/stream';
export const KLINES_LIMIT = 1000;
export const RECONNECT_DELAY_MS = 3_000;
export const STREAM_STALE_MS = 10_000; // no message for this long = dropped (the ticker arrives ~1/s)

// §4.2
export const K = 8;
export const MIN_COUNT_PIVOTS = 3;
export const MAX_COUNT_PIVOTS = 8;

// §4.3: decimals for prices and wave lengths in rule check details
export const DETAIL_DECIMALS = 2;

// §4.4
export const TOLERANCE = 0.15;
export const FIB_TARGETS = {
  w2Retracement: [0.5, 0.618, 0.786],
  w3Extension: [1.618, 2.618],
  w4Retracement: [0.382, 0.5],
  w5Extension: [1.0],
  aRetracement: [0.382, 0.5],
  bRetracement: [0.5, 0.618],
} as const;

// §4.5
export const PROJECTION = {
  w3Extension: 1.618,
  w3Range: { min: 1.618, max: 2.618 },
  w4Retracement: 0.382,
  w5Extension: 1.0,
  aRetracement: 0.382,
  aRange: { min: 0.382, max: 0.5 },
  bRetracement: 0.5,
  cExtension: 1.0,
  cRange: { min: 1.0, max: 1.618 },
} as const;

// §6.1
export const RSI_PERIOD = 14;

// §6.2 (written for s = +1; mirrored for s = −1)
export const SETUP_TRIGGERS = {
  setup1W2Retracement: { min: 0.382, max: 0.886 },
  setup2W4Retracement: { min: 0.236, max: 0.5 },
  setup3bBRetracement: { min: 0.45, max: 0.668 },
} as const;

export const SETUP_3B_TP2_EXTENSION = 1.618;

// §6.4
export const MIN_RR1 = 1;

// §6.4: below this confidence a scenario shows as 0% (§9.5) and has no signal
export const MIN_SIGNAL_CONFIDENCE = 0.5;

// §8: smallest agreeing group that counts as Mixed Market (Strong = every timeframe agrees)
export const CONFLUENCE_MIN_MIXED = 3;

// §9.5, §9.6: decimals shown for each kind of number
export const DISPLAY_DECIMALS = { price: 2, percent: 2, rr: 1, btc: 5, usdt: 2, confidence: 0 } as const;

// §7
export const RISK_DEFAULTS = { capital: 1000, riskPercent: 1 } as const;
export const RISK_LIMITS = { minCapital: 0, minRiskPercent: 0.1, maxRiskPercent: 10 } as const;
export const RISK_STORAGE_KEY = 'btc-elliott-dashboard:risk';

// §9.0: focused timeframe on load
export const DEFAULT_TIMEFRAME: Timeframe = '4h';

// §9.5
export const FIB_DECIMALS = 3;
export const COPY_FEEDBACK_MS = 2_000;

// §9.2: how long the header price stays green or red after a change
export const PRICE_FLASH_MS = 600;

// §9.1 (the chart draws on canvas, so it needs the hex values; the CSS tokens live in index.css)
export const CHART_COLORS = {
  background: '#0b0e14',
  border: '#233047',
  text: '#94a3b8',
  bullish: '#00c087',
  bearish: '#f6465d',
  confirmedWave: '#38bdf8',
  projectedWave: '#f59e0b',
  entry: '#3b82f6',
  stopLoss: '#f6465d',
  invalidation: '#a855f7',
  takeProfit1: '#00c087',
  takeProfit2: '#0f7a5a',
} as const;

// §9.4
export const CHART = {
  volumeOpacity: 0.18,
  volumePaneFraction: 0.2, // bottom share of the pane the volume histogram fills
  rangeMarginCandles: 5, // empty candles on each side of the initial visible range
  neutralVisibleCandles: 150, // initial visible range on a Neutral timeframe
} as const;
