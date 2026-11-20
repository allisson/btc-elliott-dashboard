// PROTOTYPE ONLY. Lightweight Charts v5 wrapper drawing §9.4 from mock data.
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';
import type { Candle, Scenario, Signal } from '../../src/types.ts';

const C = {
  bg: '#0b0e14',
  grid: '#151c2a',
  border: '#233047',
  text: '#8a97ad',
  bull: '#00c087',
  bear: '#f6465d',
  confirmed: '#38bdf8',
  projected: '#f59e0b',
  entry: '#3b82f6',
  tp2: '#00805a',
};

export interface WaveChartProps {
  candles: Candle[];
  scenario: Scenario | null;
  signal: Signal | null; // null: no setup, or signals hidden
  showProjections: boolean;
  showTrade: boolean;
  compact?: boolean; // smaller labels and no volume, for mini charts
  className?: string;
}

const t = (s: number) => s as UTCTimestamp;

export function WaveChart({ candles, scenario, signal, showProjections, showTrade, compact = false, className = '' }: WaveChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<{
    chart: IChartApi;
    candle: ISeriesApi<'Candlestick'>;
    volume: ISeriesApi<'Histogram'>;
    confirmed: ISeriesApi<'Line'>;
    projected: ISeriesApi<'Line'>;
    confirmedMarkers: ISeriesMarkersPluginApi<Time>;
    projectedMarkers: ISeriesMarkersPluginApi<Time>;
    lines: IPriceLine[];
  } | null>(null);

  useEffect(() => {
    const chart = createChart(el.current!, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text, fontSize: compact ? 10 : 12, attributionLogo: false },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: C.border },
      timeScale: { borderColor: C.border, timeVisible: true, rightOffset: compact ? 4 : 8 },
      crosshair: { mode: 1 },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: C.bull, downColor: C.bear, borderVisible: false, wickUpColor: C.bull, wickDownColor: C.bear,
    });
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    const lineOpts = { lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, lineWidth: 2 as const };
    const confirmed = chart.addSeries(LineSeries, { ...lineOpts, color: C.confirmed });
    const projected = chart.addSeries(LineSeries, { ...lineOpts, color: C.projected, lineStyle: LineStyle.Dashed });
    api.current = {
      chart, candle, volume, confirmed, projected,
      confirmedMarkers: createSeriesMarkers(confirmed, []),
      projectedMarkers: createSeriesMarkers(projected, []),
      lines: [],
    };
    return () => {
      chart.remove();
      api.current = null;
    };
  }, [compact]);

  useEffect(() => {
    const a = api.current;
    if (!a) return;
    // Whitespace bars up to the last projected point, so projected times land on their real dates.
    const step = candles.length > 1 ? candles[1].time - candles[0].time : 0;
    const lastTime = candles[candles.length - 1].time;
    const until = scenario?.projected.reduce((m, p) => Math.max(m, p.time), lastTime) ?? lastTime;
    const future: { time: UTCTimestamp }[] = [];
    for (let x = lastTime + step; step > 0 && x <= until; x += step) future.push({ time: t(x) });
    a.candle.setData([
      ...candles.map((c) => ({ time: t(c.time), open: c.open, high: c.high, low: c.low, close: c.close })),
      ...future,
    ]);
    a.volume.setData(
      compact
        ? []
        : candles.map((c) => ({ time: t(c.time), value: c.volume, color: c.close >= c.open ? 'rgba(0,192,135,0.18)' : 'rgba(246,70,93,0.18)' })),
    );

    const pts = scenario?.count.points ?? [];
    a.confirmed.setData(pts.map((p) => ({ time: t(p.time), value: p.price })));
    const up = (i: number, arr: { price: number }[]) =>
      i > 0 ? arr[i].price > arr[i - 1].price : arr.length > 1 && arr[0].price > arr[1].price;
    a.confirmedMarkers.setMarkers(
      pts.map((p, i): SeriesMarker<Time> => ({
        time: t(p.time), position: up(i, pts) ? 'aboveBar' : 'belowBar', color: C.confirmed, shape: 'circle', text: `(${p.label})`, size: compact ? 0.5 : 1,
      })),
    );

    const last = pts[pts.length - 1];
    const proj = showProjections && scenario && last ? [last, ...scenario.projected] : [];
    a.projected.setData(proj.map((p) => ({ time: t(p.time), value: p.price })));
    a.projectedMarkers.setMarkers(
      proj.slice(1).map((p, i): SeriesMarker<Time> => ({
        time: t(p.time), position: up(i + 1, proj) ? 'aboveBar' : 'belowBar', color: C.projected, shape: 'circle', text: `(${p.label})`, size: compact ? 0.5 : 1,
      })),
    );

    a.lines.forEach((l) => a.candle.removePriceLine(l));
    a.lines = [];
    if (showTrade && signal) {
      const add = (price: number, color: string, lineStyle: LineStyle, title: string) =>
        a.lines.push(a.candle.createPriceLine({ price, color, lineStyle, lineWidth: 1, axisLabelVisible: true, title: compact ? '' : title }));
      add(signal.entry, C.entry, LineStyle.Solid, 'ENTRY 1x');
      add(signal.stopLoss, C.bear, LineStyle.Dashed, 'STOP LOSS');
      add(signal.takeProfit1, C.bull, LineStyle.Dashed, `TP1 [R:R 1:${signal.rr1.toFixed(1)}]`);
      add(signal.takeProfit2, C.tp2, LineStyle.Dotted, `TP2 [R:R 1:${signal.rr2.toFixed(1)}]`);
    }
  }, [candles, scenario, signal, showProjections, showTrade, compact]);

  const firstIndex = scenario?.count.points[0].index ?? null;
  useEffect(() => {
    const fallback = candles.length - (compact ? 140 : 180);
    const from = firstIndex === null ? fallback : Math.min(fallback, firstIndex - 10);
    api.current?.chart.timeScale().setVisibleLogicalRange({ from, to: candles.length + (compact ? 12 : 30) });
  }, [candles, compact, firstIndex]);

  return <div ref={el} className={`min-h-0 min-w-0 ${className}`} />;
}
