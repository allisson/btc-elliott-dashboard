// Elliott chart (spec §9.0, §9.4): context bar, candles, volume, wave lines, signal price lines and
// overlays. Presentational: what to draw comes from lib/chart.ts; toggle state lives outside.
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef } from 'react';
import { CHART, CHART_COLORS } from '../config.ts';
import { chartModel, type ChartInput, type LineStyleName, type PriceLineSpec, type WaveMarker } from '../lib/chart.ts';

const LINE_STYLES: Record<LineStyleName, LineStyle> = { solid: LineStyle.Solid, dashed: LineStyle.Dashed, dotted: LineStyle.Dotted };
const DASHES: Record<LineStyleName, string | undefined> = { solid: undefined, dashed: '4 3', dotted: '1 3' };

const at = (time: number) => time as UTCTimestamp;
// 18% opacity as a two-digit hex alpha.
const translucent = (hex: string) => hex + Math.round(CHART.volumeOpacity * 255).toString(16).padStart(2, '0');
const toMarkers = (list: readonly WaveMarker[]): SeriesMarker<Time>[] =>
  list.map((m) => ({ time: at(m.time), position: m.position, color: m.color, text: m.text, shape: 'circle', size: 0.5 }));
const priceLineOptions = (l: PriceLineSpec) => ({
  price: l.price,
  title: l.title,
  color: l.color,
  lineStyle: LINE_STYLES[l.style],
  lineWidth: 1 as const,
  axisLabelVisible: true,
});

interface Chart {
  api: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  confirmed: ISeriesApi<'Line'>;
  projected: ISeriesApi<'Line'>;
  confirmedMarkers: ISeriesMarkersPluginApi<Time>;
  projectedMarkers: ISeriesMarkersPluginApi<Time>;
  priceLines: Map<PriceLineSpec['id'], IPriceLine>;
  priceLinePrices: number[]; // kept in the autoscale so no signal level falls off the pane
}

function create(container: HTMLElement): Chart {
  const priceLinePrices: number[] = [];
  const api = createChart(container, {
    autoSize: true,
    layout: { background: { color: CHART_COLORS.background }, textColor: CHART_COLORS.text },
    grid: { vertLines: { color: CHART_COLORS.border }, horzLines: { color: CHART_COLORS.border } },
    rightPriceScale: { borderColor: CHART_COLORS.border },
    timeScale: { borderColor: CHART_COLORS.border, timeVisible: true, secondsVisible: false },
  });
  const candles = api.addSeries(CandlestickSeries, {
    upColor: CHART_COLORS.bullish,
    downColor: CHART_COLORS.bearish,
    borderVisible: false,
    wickUpColor: CHART_COLORS.bullish,
    wickDownColor: CHART_COLORS.bearish,
    autoscaleInfoProvider: (base: () => AutoscaleInfo | null) => {
      const info = base();
      if (!info?.priceRange || priceLinePrices.length === 0) return info;
      const { minValue, maxValue } = info.priceRange;
      return { ...info, priceRange: { minValue: Math.min(minValue, ...priceLinePrices), maxValue: Math.max(maxValue, ...priceLinePrices) } };
    },
  });
  const volume = api.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  api.priceScale('volume').applyOptions({ scaleMargins: { top: 1 - CHART.volumePaneFraction, bottom: 0 } });
  const line = { lineWidth: 2 as const, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
  const confirmed = api.addSeries(LineSeries, { ...line, color: CHART_COLORS.confirmedWave });
  const projected = api.addSeries(LineSeries, { ...line, color: CHART_COLORS.projectedWave, lineStyle: LineStyle.Dashed });
  return {
    api,
    candles,
    volume,
    confirmed,
    projected,
    confirmedMarkers: createSeriesMarkers(confirmed, []),
    projectedMarkers: createSeriesMarkers(projected, []),
    priceLines: new Map(),
    priceLinePrices,
  };
}

export function ElliottChart({ className = '', ...input }: ChartInput & { className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<Chart | null>(null);
  const model = useMemo(() => chartModel(input), [
    input.timeframe,
    input.candles,
    input.scenario,
    input.signal,
    input.showProjections,
    input.showSignalLines,
    input.pausedSince,
  ]);

  useEffect(() => {
    chart.current = create(container.current!);
    return () => {
      chart.current!.api.remove();
      chart.current = null;
    };
  }, []);

  // The model is rebuilt on every ticker; candles are re-set only when they or the future slots change.
  const futureKey = `${model.futureTimes.length}|${model.futureTimes.at(-1)}`;
  useEffect(() => {
    const c = chart.current!;
    c.candles.setData([
      ...input.candles.map((k) => ({ time: at(k.time), open: k.open, high: k.high, low: k.low, close: k.close })),
      ...model.futureTimes.map((t) => ({ time: at(t) })),
    ]);
    c.volume.setData(
      input.candles.map((k) => ({
        time: at(k.time),
        value: k.volume,
        color: translucent(k.close >= k.open ? CHART_COLORS.bullish : CHART_COLORS.bearish),
      })),
    );
  }, [input.candles, futureKey]);

  useEffect(() => {
    const c = chart.current!;
    c.confirmed.setData(model.confirmedLine.map((p) => ({ time: at(p.time), value: p.value })));
    c.projected.setData(model.projectedLine.map((p) => ({ time: at(p.time), value: p.value })));
    c.projected.applyOptions({ visible: model.projectionVisible });
    c.confirmedMarkers.setMarkers(toMarkers(model.confirmedMarkers));
    c.projectedMarkers.setMarkers(toMarkers(model.projectedMarkers));
  }, [model.confirmedLine, model.projectedLine, model.projectionVisible, model.confirmedMarkers, model.projectedMarkers]);

  // Created once, then updated in place on every ticker (§9.4).
  useEffect(() => {
    const c = chart.current!;
    const wanted = new Set(model.priceLines.map((l) => l.id));
    for (const [id, line] of c.priceLines) {
      if (!wanted.has(id)) {
        c.candles.removePriceLine(line);
        c.priceLines.delete(id);
      }
    }
    for (const spec of model.priceLines) {
      const line = c.priceLines.get(spec.id);
      if (line) line.applyOptions(priceLineOptions(spec));
      else c.priceLines.set(spec.id, c.candles.createPriceLine(priceLineOptions(spec)));
    }
    c.priceLinePrices.splice(0, Infinity, ...model.priceLines.map((l) => l.price));
    c.candles.applyOptions({ priceLineVisible: model.showLastPriceLine });
  }, [model.priceLines, model.showLastPriceLine]);

  // Recomputed only when the timeframe or the selected scenario changes, so live data keeps the user's zoom.
  const rangeKey = `${input.timeframe}|${input.scenario?.rank ?? 'primary'}`;
  useEffect(() => {
    chart.current!.api.timeScale().setVisibleLogicalRange(model.visibleRange);
  }, [rangeKey]);

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-surface ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-xs">
        <span className="font-medium text-slate-200">{model.context}</span>
        <ul className="flex flex-wrap items-center gap-3 text-slate-400">
          {model.legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="18" y2="3" stroke={item.color} strokeWidth="2" strokeDasharray={DASHES[item.style]} />
              </svg>
              {item.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={container} className="absolute inset-0" />
        {model.overlays.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center gap-2">
            {model.overlays.map((text) => (
              <p key={text} className="rounded border border-border bg-surface-2/90 px-3 py-1.5 text-sm text-slate-300">
                {text}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
