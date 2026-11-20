// What the Elliott chart draws (spec §9.0, §9.4): scenario and signal → wave lines, markers, price
// lines, legend, overlays and the initial visible range. Pure; ElliottChart.tsx only hands it to the chart.
import { CHART, CHART_COLORS, TIMEFRAMES } from '../config.ts';
import type { Candle, Scenario, Signal, Timeframe, WavePoint } from '../types.ts';
import { formatConfidence, formatRR, pausedNotice } from './format.ts';

export interface ChartInput {
  timeframe: Timeframe;
  candles: readonly Candle[]; // closed candles and the open one, oldest first
  scenario: Scenario | null; // the one selected in the scenario tabs; null = Neutral
  signal: Signal | null; // null = the scenario has no setup
  showProjections: boolean;
  showSignalLines: boolean; // `Trade 1x` toggle
  pausedSince: number | null; // ms since epoch of the last real update, while the stream is down
}

export type LineStyleName = 'solid' | 'dashed' | 'dotted';

export interface LinePoint {
  time: number;
  value: number;
}

export interface WaveMarker {
  time: number;
  position: 'aboveBar' | 'belowBar';
  color: string;
  text: string;
}

export interface PriceLineSpec {
  id: 'entry' | 'stopLoss' | 'invalidation' | 'takeProfit1' | 'takeProfit2';
  price: number;
  title: string;
  color: string;
  style: LineStyleName;
}

export interface LegendItem {
  label: string;
  color: string;
  style: LineStyleName;
}

export interface ChartModel {
  context: string;
  confirmedLine: LinePoint[];
  confirmedMarkers: WaveMarker[];
  projectedLine: LinePoint[]; // kept while Projections is off: emptying it would move the chart's right edge
  projectionVisible: boolean;
  projectedMarkers: WaveMarker[];
  priceLines: PriceLineSpec[]; // empty when hidden (§9.4)
  showLastPriceLine: boolean; // the candle series' own line, hidden while ENTRY 1x sits on it
  legend: LegendItem[]; // only the lines drawn
  overlays: string[];
  futureTimes: number[]; // empty candle slots after the open candle, up to the last projected point
  visibleRange: { from: number; to: number }; // logical indices on the time scale
}

const point = (p: WavePoint): LinePoint => ({ time: p.time, value: p.price });

// Pivots alternate, so a point is a peak when it sits above its neighbour.
function markers(chain: readonly WavePoint[], from: number, color: string): WaveMarker[] {
  return chain.slice(from).map((p, k) => {
    const i = from + k;
    const neighbour = chain[i === 0 ? 1 : i - 1];
    return { time: p.time, position: p.price > neighbour.price ? 'aboveBar' : 'belowBar', color, text: `(${p.label})` };
  });
}

// §6.4: a target the price already passed has no line. The stop sits risk% from the entry (§7), so
// the scenario's invalidation price gets its own line.
function priceLines(signal: Signal, scenario: Scenario): PriceLineSpec[] {
  const lines: PriceLineSpec[] = [
    { id: 'entry', price: signal.entry, title: 'ENTRY 1x', color: CHART_COLORS.entry, style: 'solid' },
    { id: 'stopLoss', price: signal.stopLoss, title: 'STOP LOSS', color: CHART_COLORS.stopLoss, style: 'dashed' },
    { id: 'invalidation', price: scenario.invalidationPrice, title: 'INVALIDATION', color: CHART_COLORS.invalidation, style: 'dashed' },
    { id: 'takeProfit1', price: signal.takeProfit1, title: `TP1 [${formatRR(signal.rr1)}]`, color: CHART_COLORS.takeProfit1, style: 'dashed' },
    { id: 'takeProfit2', price: signal.takeProfit2, title: `TP2 [${formatRR(signal.rr2)}]`, color: CHART_COLORS.takeProfit2, style: 'dotted' },
  ];
  return lines.filter((l) => (l.id === 'takeProfit1' ? signal.rr1 > 0 : l.id === 'takeProfit2' ? signal.rr2 > 0 : true));
}

const LEGEND_NAMES: Record<PriceLineSpec['id'], string> = {
  entry: 'Entry',
  stopLoss: 'Stop',
  invalidation: 'Invalidation',
  takeProfit1: 'TP1',
  takeProfit2: 'TP2',
};

export function chartModel(input: ChartInput): ChartModel {
  const { timeframe, candles, scenario, signal, showProjections, showSignalLines, pausedSince } = input;
  const tf = TIMEFRAMES.find((t) => t.id === timeframe)!;

  const context = scenario
    ? `BTC/USDT · ${tf.label} · ${scenario.rank === 'primary' ? 'Primary' : 'Alternative'} Scenario (${formatConfidence(scenario.confidence)}) · ${scenario.waveInProgress}`
    : `BTC/USDT · ${tf.label} · Neutral`;

  const confirmed = scenario?.count.points ?? [];
  const chain = [...confirmed, ...(scenario?.projected ?? [])];
  const drawProjection = showProjections && chain.length > confirmed.length;

  const lines =
    scenario && signal && showSignalLines && signal.status !== 'INVALIDATED' && pausedSince === null ? priceLines(signal, scenario) : [];

  const legend: LegendItem[] = [
    ...(confirmed.length ? [{ label: 'Confirmed', color: CHART_COLORS.confirmedWave, style: 'solid' as const }] : []),
    ...(drawProjection ? [{ label: 'Projected', color: CHART_COLORS.projectedWave, style: 'dashed' as const }] : []),
    ...lines.map((l) => ({ label: LEGEND_NAMES[l.id], color: l.color, style: l.style })),
  ];

  const overlays = [
    ...(scenario ? [] : [`${tf.label} is Neutral: no valid count to draw.`]),
    ...(pausedSince === null ? [] : [pausedNotice(pausedSince)]),
  ];

  // Projected times sit on the timeframe's grid (§4.5); fill every slot so legs keep their length.
  const lastCandleTime = candles[candles.length - 1].time;
  const lastTime = chain.length ? chain[chain.length - 1].time : lastCandleTime;
  const futureTimes: number[] = [];
  for (let t = lastCandleTime + tf.seconds; t <= lastTime; t += tf.seconds) futureTimes.push(t);

  const times = [...candles.map((c) => c.time), ...futureTimes];
  const indexOf = (time: number) => times.indexOf(time);
  const lastCandleIndex = candles.length - 1;
  const visibleRange = scenario
    ? { from: indexOf(chain[0].time) - CHART.rangeMarginCandles, to: indexOf(lastTime) + CHART.rangeMarginCandles }
    : { from: lastCandleIndex - CHART.neutralVisibleCandles, to: lastCandleIndex + CHART.rangeMarginCandles };

  return {
    context,
    confirmedLine: confirmed.map(point),
    confirmedMarkers: markers(chain, 0, CHART_COLORS.confirmedWave).slice(0, confirmed.length),
    projectedLine: chain.length > confirmed.length ? chain.slice(confirmed.length - 1).map(point) : [],
    projectionVisible: drawProjection,
    projectedMarkers: drawProjection ? markers(chain, confirmed.length, CHART_COLORS.projectedWave) : [],
    priceLines: lines,
    showLastPriceLine: lines.length === 0,
    legend,
    overlays,
    futureTimes,
    visibleRange,
  };
}
