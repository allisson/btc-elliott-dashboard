// PROTOTYPE ONLY. Hand-written mock data (ADR 0002: never imported by src/).
// Pivots are hand-picked so they respect each timeframe's ZigZag threshold; ratios, scores,
// confidence, projections and levels are derived with the spec formulas so the numbers agree.
import { PROJECTION, RISK_DEFAULTS, SL_MULTIPLIERS, TIMEFRAMES, TOLERANCE, FIB_TARGETS } from '../../src/config.ts';
import type {
  Candle,
  Confluence,
  Count,
  Direction,
  FibRatios,
  PositionSize,
  RiskSettings,
  RuleCheck,
  Scenario,
  Signal,
  SignalLevels,
  Ticker,
  Timeframe,
  TimeframeAnalysis,
  WaveLabel,
  WavePoint,
} from '../../src/types.ts';

export const NOW = 1_795_176_000; // 2026-11-20 12:00 UTC
export const OFFLINE_SINCE = '11:47 UTC';
export const MOCK_PRICE = 96_400;

export const PRICE_PRESETS = [
  { label: 'Default 96,400', price: 96_400 },
  { label: '1H stop breached 95,400', price: 95_400 },
  { label: '1D stop breached 105,200', price: 105_200 },
] as const;

export const TICKER: Ticker = {
  price: MOCK_PRICE,
  change24h: 1_284.5,
  changePercent24h: 1.35,
  high24h: 98_120,
  low24h: 94_870,
  volume24h: 18_342.7,
};

export function tickerAt(price: number): Ticker {
  const open = TICKER.price - TICKER.change24h;
  return {
    ...TICKER,
    price,
    change24h: price - open,
    changePercent24h: ((price - open) / open) * 100,
    high24h: Math.max(TICKER.high24h, price),
    low24h: Math.min(TICKER.low24h, price),
  };
}

// ---------------------------------------------------------------- candles

const N = 300;
type Waypoint = [index: number, price: number];

function lastOpenTime(tf: Timeframe, seconds: number): number {
  if (tf === '1w') {
    const monday = 4 * 86_400; // epoch 0 is a Thursday; Binance weeks open Monday 00:00 UTC
    return Math.floor((NOW - monday) / seconds) * seconds + monday;
  }
  return Math.floor(NOW / seconds) * seconds;
}

function noise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43_758.5453;
  return x - Math.floor(x) - 0.5; // [-0.5, 0.5)
}

function buildCandles(tf: Timeframe, waypoints: Waypoint[], seed: number): Candle[] {
  const seconds = TIMEFRAMES.find((t) => t.id === tf)!.seconds;
  const t0 = lastOpenTime(tf, seconds) - (N - 1) * seconds;
  const closes: number[] = [];
  const bounds: Array<[number, number]> = [];
  for (let w = 0; w < waypoints.length - 1; w++) {
    const [ia, pa] = waypoints[w];
    const [ib, pb] = waypoints[w + 1];
    const lo = Math.min(pa, pb);
    const hi = Math.max(pa, pb);
    for (let i = ia; i < ib; i++) {
      const f = (i - ia) / (ib - ia);
      const raw = pa + (pb - pa) * f + noise(i, seed) * (hi - lo) * 0.35;
      closes[i] = Math.min(hi, Math.max(lo, raw));
      bounds[i] = [lo, hi];
    }
  }
  const [iz, pz] = waypoints[waypoints.length - 1];
  closes[iz] = pz;
  bounds[iz] = bounds[iz - 1];
  const pivotAt = new Map(waypoints.map(([i, p]) => [i, p]));

  return closes.map((close, i) => {
    const open = i === 0 ? close : closes[i - 1];
    const [lo, hi] = bounds[i];
    const wick = Math.abs(noise(i, seed + 1)) * close * 0.004;
    let high = Math.min(hi, Math.max(open, close) + wick);
    let low = Math.max(lo, Math.min(open, close) - wick);
    const p = pivotAt.get(i);
    if (p !== undefined && i !== iz) {
      if (p >= Math.max(open, close)) high = p;
      if (p <= Math.min(open, close)) low = p;
    }
    const volume = (0.6 + Math.abs(noise(i, seed + 2))) * (tf === '1h' ? 900 : tf === '4h' ? 3_600 : tf === '1d' ? 21_000 : 140_000);
    return { time: t0 + i * seconds, open, high, low, close, volume };
  });
}

// ---------------------------------------------------------------- counts

const LABELS: WaveLabel[] = ['0', '1', '2', '3', '4', '5', 'A', 'B'];
const WAVE_IN_PROGRESS: Record<string, string> = {
  '2': 'Wave 3 in progress',
  '3': 'Wave 4 forming',
  '4': 'Wave 5 in progress',
  '5': 'Correction A in progress',
  A: 'Wave B in progress',
  B: 'Wave C in progress',
};

function grade(value: number, targets: readonly number[]): number {
  const d = Math.min(...targets.map((t) => Math.abs(value - t)));
  return Math.max(0, 1 - d / TOLERANCE);
}

function buildCount(candles: Candle[], pivotIdx: number[], impulse: Direction): Count {
  const points: WavePoint[] = pivotIdx.map((index, k) => {
    const c = candles[index];
    const peak = (impulse === 'bullish') === (k % 2 === 1);
    return { label: LABELS[k], time: c.time, price: peak ? c.high : c.low, index, projected: false };
  });
  const p = points.map((x) => x.price);
  const len = (n: number) => Math.abs(p[n] - p[n - 1]);
  const m = points.length;
  const ratios: FibRatios = {};
  if (m >= 3) ratios.w2Retracement = len(2) / len(1);
  if (m >= 4) ratios.w3Extension = len(3) / len(1);
  if (m >= 5) ratios.w4Retracement = len(4) / len(3);
  if (m >= 6) ratios.w5Extension = len(5) / len(1);
  if (m >= 7) ratios.aRetracement = Math.abs(p[5] - p[6]) / Math.abs(p[5] - p[0]);
  if (m >= 8) ratios.bRetracement = Math.abs(p[7] - p[6]) / Math.abs(p[5] - p[6]);
  const grades = (Object.keys(ratios) as (keyof FibRatios)[]).map((k) => grade(ratios[k]!, FIB_TARGETS[k]));
  const s = impulse === 'bullish' ? 1 : -1;
  const f = (x: number) => x.toFixed(0);

  const rules: RuleCheck[] = [
    {
      rule: 'rule1',
      status: s * (p[2] - p[0]) > 0 ? 'valid' : 'violated',
      detail: `Wave 2 ${impulse === 'bullish' ? 'low' : 'high'} ${f(p[2])} vs Wave 1 start ${f(p[0])}`,
    },
    m >= 6
      ? {
          rule: 'rule2',
          status: len(3) >= Math.min(len(1), len(5)) ? 'valid' : 'violated',
          detail: `len(W3) ${f(len(3))} ≥ min(len(W1) ${f(len(1))}, len(W5) ${f(len(5))})`,
        }
      : m >= 4 && len(3) < len(1)
        ? { rule: 'rule2', status: 'valid', detail: `Pending: requires Wave 5 ≤ Wave 3 (${f(len(3))})` }
        : { rule: 'rule2', status: 'not_yet', detail: 'Needs Wave 5' },
    m >= 5
      ? {
          rule: 'rule3',
          status: s * (p[4] - p[1]) > 0 ? 'valid' : 'violated',
          detail: `Wave 4 ${impulse === 'bullish' ? 'low' : 'high'} ${f(p[4])} vs Wave 1 end ${f(p[1])}`,
        }
      : { rule: 'rule3', status: 'not_yet', detail: 'Needs Wave 4' },
  ];

  return {
    impulseDirection: impulse,
    points,
    lastLabel: points[m - 1].label,
    ratios,
    rules,
    score: grades.reduce((a, b) => a + b, 0) / grades.length,
  };
}

function project(count: Count, seconds: number): WavePoint[] {
  const p = count.points.map((x) => x.price);
  const last = count.points[count.points.length - 1];
  const span = last.index! - count.points[0].index!;
  const legCandles = Math.max(1, Math.round(span / (count.points.length - 1)));
  const W1 = p.length > 1 ? p[1] - p[0] : 0;
  // §4.3 Rule 2 pending: |P5' − P4| capped at len(W3)
  const lenW3 = p.length > 3 ? Math.abs(p[3] - p[2]) : Infinity;
  const capW5 = (leg: number) => (lenW3 < Math.abs(W1) ? Math.sign(leg) * Math.min(Math.abs(leg), lenW3) : leg);
  const pts: Array<[WaveLabel, number, { min: number; max: number }?]> = [];
  const P = PROJECTION;
  switch (count.lastLabel) {
    case '2': {
      const p3 = p[2] + P.w3Extension * W1;
      const p4 = p3 - P.w4Retracement * (p3 - p[2]);
      const r = [p[2] + P.w3Range.min * W1, p[2] + P.w3Range.max * W1];
      pts.push(['3', p3, { min: Math.min(...r), max: Math.max(...r) }], ['4', p4], ['5', p4 + P.w5Extension * W1]);
      break;
    }
    case '3': {
      const p4 = p[3] - P.w4Retracement * (p[3] - p[2]);
      pts.push(['4', p4], ['5', p4 + capW5(P.w5Extension * W1)]);
      break;
    }
    case '4':
      pts.push(['5', p[4] + capW5(P.w5Extension * W1)]);
      break;
    case '5': {
      const pa = p[5] - P.aRetracement * (p[5] - p[0]);
      const pb = pa + P.bRetracement * (p[5] - pa);
      pts.push(['A', pa], ['B', pb], ['C', pb - P.cExtension * (p[5] - pa)]);
      break;
    }
    case 'A': {
      const A = p[6] - p[5];
      const pb = p[6] + P.bRetracement * (p[5] - p[6]);
      pts.push(['B', pb], ['C', pb + P.cExtension * A]);
      break;
    }
    default:
      break;
  }
  return pts.map(([label, price, targetRange], n) => ({
    label,
    price,
    time: last.time + (n + 1) * legCandles * seconds,
    index: null,
    projected: true,
    ...(targetRange ? { targetRange } : {}),
  }));
}

function invalidation(count: Count): { price: number; reason: string } {
  const p = count.points.map((x) => x.price);
  switch (count.lastLabel) {
    case '2':
      return { price: p[0], reason: 'Wave 2 would retrace past the start of Wave 1 (Rule 1)' };
    case '3':
    case '4':
      return { price: p[1], reason: 'Wave 4 would overlap Wave 1 (Rule 3)' };
    default:
      return { price: p[5], reason: 'Price beyond the Wave 5 extreme: the impulse is not over' };
  }
}

function scenarioDirection(count: Count): Direction {
  const withImpulse = ['2', '4', 'A'].includes(count.lastLabel);
  if (withImpulse) return count.impulseDirection;
  return count.impulseDirection === 'bullish' ? 'bearish' : 'bullish';
}

function buildScenario(
  rank: 'primary' | 'alternative',
  count: Count,
  seconds: number,
  confidence: number,
  thesis: string,
): Scenario {
  const inv = invalidation(count);
  return {
    rank,
    count,
    direction: scenarioDirection(count),
    waveInProgress: WAVE_IN_PROGRESS[count.lastLabel],
    projected: project(count, seconds),
    confidence,
    invalidationPrice: inv.price,
    invalidationReason: inv.reason,
    thesis,
  };
}

function confidences(pP: number, pA: number | null): [number, number | null] {
  if (pA === null) return [pP * 100, null];
  if (pP + pA === 0) return [50, 50];
  const primary = (pP / (pP + pA)) * 100;
  return [primary, 100 - primary];
}

// ---------------------------------------------------------------- timeframes

export interface TimeframeMock {
  candles: Candle[];
  analysis: TimeframeAnalysis;
  rsiDivergence?: boolean;
}

function seconds(tf: Timeframe): number {
  return TIMEFRAMES.find((t) => t.id === tf)!.seconds;
}

function assemble(
  tf: Timeframe,
  candles: Candle[],
  primary: { idx: number[]; impulse: Direction; thesis: (s: Scenario) => string; levels: (c: Count, proj: WavePoint[]) => SignalLevels | null },
  alternative: { idx: number[]; impulse: Direction; thesis: (s: Scenario) => string; levels: (c: Count, proj: WavePoint[]) => SignalLevels | null } | null,
): TimeframeAnalysis {
  const sec = seconds(tf);
  const cP = buildCount(candles, primary.idx, primary.impulse);
  const cA = alternative ? buildCount(candles, alternative.idx, alternative.impulse) : null;
  const [confP, confA] = confidences(cP.score, cA ? cA.score : null);
  const sP = buildScenario('primary', cP, sec, confP, '');
  sP.thesis = primary.thesis(sP);
  let sA: Scenario | null = null;
  if (cA && alternative && confA !== null) {
    sA = buildScenario('alternative', cA, sec, confA, '');
    sA.thesis = alternative.thesis(sA);
  }
  return {
    timeframe: tf,
    analysedAt: candles[candles.length - 1].time,
    primary: sP,
    alternative: sA,
    primaryLevels: primary.levels(cP, sP.projected),
    alternativeLevels: sA && alternative ? alternative.levels(cA!, sA.projected) : null,
  };
}

const usd = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 0 });
const noSetup = () => null;

// 1H: Primary bullish (0)(1)(2) → Setup 1, ACTIVE, position capped by capital.
//     Alternative bullish (0)…(5)(A) → no setup.
const c1h = buildCandles(
  '1h',
  [
    [0, 93_000], [30, 89_800], [62, 92_900], [85, 91_100], [150, 98_000],
    [175, 96_000], [205, 98_600], [240, 96_300], [268, 98_100], [299, MOCK_PRICE],
  ],
  1,
);
const a1h = assemble(
  '1h',
  c1h,
  {
    idx: [175, 205, 240],
    impulse: 'bullish',
    thesis: (s) =>
      `Bullish impulse; Wave 2 retraced ${s.count.ratios.w2Retracement!.toFixed(2)} of Wave 1; Wave 3 in progress toward 1.618 at ${usd(s.projected[0].price)}; invalid below ${usd(s.invalidationPrice)}.`,
    levels: (c, proj) => ({
      setup: 'setup1',
      side: 'LONG',
      triggerMet: true,
      stopLoss: c.points[0].price * SL_MULTIPLIERS.belowLevel,
      takeProfit1: c.points[1].price,
      takeProfit2: proj[0].price,
    }),
  },
  {
    idx: [30, 62, 85, 150, 175, 205, 240],
    impulse: 'bullish',
    thesis: (s) =>
      `Bullish impulse complete at ${usd(s.count.points[5].price)}; Wave A retraced ${s.count.ratios.aRetracement!.toFixed(2)}; Wave B in progress; invalid above ${usd(s.invalidationPrice)}.`,
    levels: noSetup,
  },
);

// 4H: Primary bullish (0)…(4) → Setup 2, WATCHING (price already past TP1).
//     Alternative bullish (0)…(5)(A) → no setup.
const c4h = buildCandles(
  '4h',
  [
    [0, 76_000], [25, 72_000], [60, 80_500], [85, 77_500], [130, 86_500],
    [155, 82_100], [215, 95_800], [250, 91_200], [285, 97_300], [299, MOCK_PRICE],
  ],
  2,
);
const a4h = assemble(
  '4h',
  c4h,
  {
    idx: [85, 130, 155, 215, 250],
    impulse: 'bullish',
    thesis: (s) =>
      `Bullish impulse; Wave 4 retraced ${s.count.ratios.w4Retracement!.toFixed(2)} of Wave 3; Wave 5 in progress toward ${usd(s.projected[0].price)}; invalid below ${usd(s.invalidationPrice)}.`,
    levels: (c, proj) => ({
      setup: 'setup2',
      side: 'LONG',
      triggerMet: true,
      stopLoss: c.points[1].price * SL_MULTIPLIERS.belowLevel,
      takeProfit1: c.points[3].price,
      takeProfit2: proj[0].price,
    }),
  },
  {
    idx: [25, 60, 85, 130, 155, 215, 250],
    impulse: 'bullish',
    thesis: (s) =>
      `Bullish impulse complete at ${usd(s.count.points[5].price)}; Wave A retraced ${s.count.ratios.aRetracement!.toFixed(2)}; Wave B in progress; invalid above ${usd(s.invalidationPrice)}.`,
    levels: noSetup,
  },
);

// 1D: Primary bullish (0)…(5) → Setup 3a SHORT, ACTIVE, TP1/TP2 swapped (PA' not beyond P4).
//     Alternative bullish (0)…(3) → no setup.
const c1d = buildCandles(
  '1d',
  [
    [0, 58_000], [20, 49_000], [70, 73_800], [105, 56_500], [180, 95_000],
    [215, 81_000], [270, 104_200], [290, 95_100], [299, MOCK_PRICE],
  ],
  3,
);
const a1d = assemble(
  '1d',
  c1d,
  {
    idx: [20, 70, 105, 180, 215, 270],
    impulse: 'bullish',
    thesis: (s) =>
      `Bullish impulse complete at ${usd(s.count.points[5].price)} with RSI divergence; Correction A in progress toward ${usd(s.projected[0].price)}; invalid above ${usd(s.invalidationPrice)}.`,
    levels: (c, proj) => {
      const p4 = c.points[4].price;
      const pa = proj[0].price;
      const [tp1, tp2] = pa < p4 ? [p4, pa] : [pa, p4]; // §6.2: TP1 is always the nearer target
      return {
        setup: 'setup3a',
        side: 'SHORT',
        triggerMet: true,
        stopLoss: c.points[5].price * SL_MULTIPLIERS.aboveLevel,
        takeProfit1: tp1,
        takeProfit2: tp2,
      };
    },
  },
  {
    idx: [105, 180, 215, 270],
    impulse: 'bullish',
    thesis: (s) =>
      `Bullish impulse from ${usd(s.count.points[0].price)}; Wave 3 topped at ${usd(s.count.points[3].price)}; Wave 4 forming toward ${usd(s.projected[0].price)}; invalid below ${usd(s.invalidationPrice)}.`,
    levels: noSetup,
  },
);

// 1W: Neutral (no valid count).
const c1w = buildCandles(
  '1w',
  [
    [0, 21_000], [40, 15_800], [110, 31_000], [130, 25_000], [175, 73_800],
    [200, 56_500], [235, 99_800], [250, 82_600], [280, 104_200], [299, MOCK_PRICE],
  ],
  4,
);

export const TIMEFRAME_MOCKS: Record<Timeframe, TimeframeMock> = {
  '1h': { candles: c1h, analysis: a1h },
  '4h': { candles: c4h, analysis: a4h },
  '1d': { candles: c1d, analysis: a1d, rsiDivergence: true },
  '1w': {
    candles: c1w,
    analysis: {
      timeframe: '1w',
      analysedAt: c1w[c1w.length - 1].time,
      primary: null,
      alternative: null,
      primaryLevels: null,
      alternativeLevels: null,
    },
  },
};

// ---------------------------------------------------------------- price-dependent (§6.3, §6.4, §7, §8)

export const SETUP_NAMES: Record<SignalLevels['setup'], string> = {
  setup1: 'Setup 1 (Wave 2→3)',
  setup2: 'Setup 2 (Wave 4→5)',
  setup3a: 'Setup 3a (Wave 5 exhaustion)',
  setup3b: 'Setup 3b (Wave B→C)',
};

export const NEXT_WAVE: Record<string, string> = { '3': 'Wave 4', A: 'Wave B' };

/** Prototype stand-in for §6.4: evaluated against the given price only. */
export function signalAt(tf: Timeframe, levels: SignalLevels, scenario: Scenario, price: number): Signal {
  const long = levels.side === 'LONG';
  const risk = Math.abs(price - levels.stopLoss);
  const rr1 = Math.abs(levels.takeProfit1 - price) / risk;
  const rr2 = Math.abs(levels.takeProfit2 - price) / risk;
  const slBreached = long ? price <= levels.stopLoss : price >= levels.stopLoss;
  const s = scenario.count.impulseDirection === 'bullish' ? 1 : -1;
  const invBreached = ['5', 'A', 'B'].includes(scenario.count.lastLabel)
    ? s * (price - scenario.invalidationPrice) > 0
    : s * (price - scenario.invalidationPrice) <= 0;
  const between = long ? price > levels.stopLoss && price < levels.takeProfit1 : price < levels.stopLoss && price > levels.takeProfit1;
  const status: Signal['status'] =
    slBreached || invBreached ? 'INVALIDATED' : levels.triggerMet && between && rr1 >= 1 ? 'ACTIVE' : 'WATCHING';
  return { ...levels, timeframe: tf, entry: price, rr1, rr2, status };
}

export function positionSize(risk: RiskSettings, entry: number, stopLoss: number): PositionSize {
  const riskUsd = (risk.capital * risk.riskPercent) / 100;
  const stopDistance = Math.abs(entry - stopLoss) / entry;
  const positionUsd = Math.min(riskUsd / stopDistance, risk.capital);
  const actualRiskUsd = positionUsd * stopDistance;
  return {
    positionUsd,
    positionBtc: positionUsd / entry,
    actualRiskUsd,
    actualRiskPercent: (actualRiskUsd / risk.capital) * 100,
    capped: positionUsd === risk.capital,
  };
}

export function parseRisk(capital: string, riskPercent: string): RiskSettings {
  const c = Number(capital);
  const r = Number(riskPercent);
  return {
    capital: capital.trim() !== '' && Number.isFinite(c) && c > 0 ? c : RISK_DEFAULTS.capital,
    riskPercent: riskPercent.trim() !== '' && Number.isFinite(r) && r >= 0.1 && r <= 10 ? r : RISK_DEFAULTS.riskPercent,
  };
}

export function confluence(): Confluence {
  const votes = Object.values(TIMEFRAME_MOCKS)
    .map((m) => m.analysis.primary?.direction)
    .filter((d): d is Direction => d !== undefined);
  const bull = votes.filter((d) => d === 'bullish').length;
  const bear = votes.length - bull;
  const agree = Math.max(bull, bear);
  const majority: Confluence['majority'] = agree === 0 ? null : bull === bear ? 'split' : bull > bear ? 'bullish' : 'bearish';
  const label: Confluence['label'] = agree === 4 ? 'strong' : agree >= 2 ? 'mixed' : 'none';
  return { agree, majority, label };
}

// ---------------------------------------------------------------- formatting (§9.6 precision)

export const fmt = {
  price: (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  pct: (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`,
  rr: (x: number) => `1:${x.toFixed(1)}`,
  btc: (x: number) => x.toFixed(5),
  usdt: (x: number) => x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  delta: (x: number, entry: number) => fmt.pct(((x - entry) / entry) * 100),
};

export function copySetupText(
  tf: Timeframe,
  signal: Signal,
  scenario: Scenario,
  size: PositionSize,
  risk: RiskSettings,
): string {
  const label = TIMEFRAMES.find((t) => t.id === tf)!.label;
  const rank = scenario.rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario';
  const e = signal.entry;
  return [
    `BTC/USDT · ${label} · ${signal.side} 1x · ${SETUP_NAMES[signal.setup]}`,
    `Status: ${signal.status} · ${rank} (${scenario.confidence.toFixed(0)}%)`,
    `Entry:       ${fmt.price(e)}`,
    `Stop Loss:   ${fmt.price(signal.stopLoss)}  (${fmt.delta(signal.stopLoss, e)})`,
    `TP1:         ${fmt.price(signal.takeProfit1)}  (${fmt.delta(signal.takeProfit1, e)})  R:R ${fmt.rr(signal.rr1)}`,
    `TP2:         ${fmt.price(signal.takeProfit2)}  (${fmt.delta(signal.takeProfit2, e)})  R:R ${fmt.rr(signal.rr2)}`,
    `Position:    ${fmt.usdt(size.positionUsd)} USDT (${fmt.btc(size.positionBtc)} BTC) of ${fmt.usdt(risk.capital)} USDT`,
    `Risk:        ${fmt.usdt(size.actualRiskUsd)} USDT (${size.actualRiskPercent.toFixed(2)}% of capital)${size.capped ? ' (capped by capital)' : ''}`,
    `Invalidation: ${scenario.invalidationReason} at ${fmt.price(scenario.invalidationPrice)}`,
    `Generated: 2026-11-20 12:00 UTC`,
    `Not financial advice. 1x, no leverage.`,
  ].join('\n');
}
