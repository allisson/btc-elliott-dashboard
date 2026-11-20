// PROTOTYPE ONLY. C · Multi-timeframe grid: shared badges and the timeframe cells (= confluence cards).
import { CirclePause, Maximize2, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { TIMEFRAMES } from '../../src/config.ts';
import type { Confluence, Direction, Signal, Timeframe } from '../../src/types.ts';
import { NEXT_WAVE, OFFLINE_SINCE, fmt } from '../shared/mock.ts';
import { usePrototype } from '../shared/PrototypeShell.tsx';
import { useTimeframeView, type TimeframeView } from '../shared/view.ts';
import { WaveChart } from '../shared/WaveChart.tsx';

export const tfLabel = (tf: Timeframe) => TIMEFRAMES.find((t) => t.id === tf)!.label;

export function DirectionBadge({ direction, size = 'sm' }: { direction: Direction | null; size?: 'sm' | 'md' }) {
  const pad = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[10px]';
  if (!direction) {
    return (
      <span className={`inline-flex items-center gap-1 rounded border border-slate-600/60 font-semibold tracking-wide text-slate-400 ${pad}`}>
        <Minus size={11} /> NEUTRAL
      </span>
    );
  }
  const bull = direction === 'bullish';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold tracking-wide ${pad} ${
        bull ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'
      }`}
    >
      {bull ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {bull ? 'BULLISH' : 'BEARISH'}
    </span>
  );
}

const STATUS_STYLE: Record<Signal['status'], string> = {
  ACTIVE: 'bg-bullish text-black',
  WATCHING: 'bg-accent/15 text-accent ring-1 ring-inset ring-accent/40',
  INVALIDATED: 'bg-bearish/15 text-bearish ring-1 ring-inset ring-bearish/50 line-through decoration-1',
};

export function StatusPill({ status }: { status: Signal['status'] }) {
  return <span className={`rounded px-1.5 py-px text-[10px] font-bold tracking-wider ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function confluenceText(c: Confluence): { title: string; detail: string; tone: string } {
  const dir = c.majority === 'bullish' ? 'Bullish' : c.majority === 'bearish' ? 'Bearish' : c.majority === 'split' ? 'split' : '';
  const tone =
    c.label === 'none' || c.majority === 'split' || c.majority === null
      ? 'text-slate-300 border-slate-600/60 bg-white/5'
      : c.majority === 'bullish'
        ? 'text-bullish border-bullish/40 bg-bullish/10'
        : 'text-bearish border-bearish/40 bg-bearish/10';
  if (c.label === 'strong') return { title: 'Strong Confluence', detail: `${dir} · ${c.agree}/4`, tone };
  if (c.label === 'mixed') return { title: 'Mixed Market', detail: `${dir} · ${c.agree}/4`, tone };
  return { title: 'No Confluence', detail: `${c.agree}/4`, tone };
}

/** One line under the summary: status + levels, or the reason there are none. */
function SignalLine({ v, compact }: { v: TimeframeView; compact?: boolean }) {
  if (!v.scenario) return <span className="text-slate-500">No valid count · no vote</span>;
  if (v.signalsPaused) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400">
        <CirclePause size={12} /> {compact ? 'Signals paused' : `Signals paused: data stale since ${OFFLINE_SINCE}`}
      </span>
    );
  }
  if (!v.signal) {
    return (
      <span className="text-slate-400">
        <span className="mr-1.5 rounded bg-white/5 px-1.5 py-px text-[10px] font-bold tracking-wider text-slate-400">NO SETUP</span>
        waiting for {NEXT_WAVE[v.scenario.count.lastLabel]}
      </span>
    );
  }
  const s = v.signal;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StatusPill status={s.status} />
      <span className={`shrink-0 text-[10px] font-bold whitespace-nowrap ${s.side} === 'LONG' ? 'text-bullish' : 'text-bearish'}`}>{s.side} 1x</span>
      {!compact && (
        <span className="truncate tabular-nums text-slate-400">
          <span className="text-slate-500">E</span> {fmt.price(s.entry)} <span className="text-slate-600">·</span>{' '}
          <span className="text-bearish/80">SL</span> {fmt.price(s.stopLoss)} <span className="text-slate-600">·</span>{' '}
          <span className="text-bullish/80">TP1</span> {fmt.price(s.takeProfit1)}
        </span>
      )}
    </span>
  );
}

/** Grid cell: mini chart framed by the confluence-card summary. Always the Primary Scenario. */
export function TimeframeCell({ tf, onFocus }: { tf: Timeframe; onFocus: (tf: Timeframe) => void }) {
  const ui = usePrototype();
  const v = useTimeframeView(tf, 'primary');
  const sc = v.scenario;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Focus ${tfLabel(tf)}`}
      onClick={() => onFocus(tf)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onFocus(tf))}
      className="group flex h-[280px] min-h-0 cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-surface transition hover:border-accent/60 focus-visible:border-accent focus-visible:outline-none md:h-auto"
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <span className="text-base font-bold tracking-tight text-slate-100">{tfLabel(tf)}</span>
        <DirectionBadge direction={sc?.direction ?? null} />
        <span className="truncate text-xs text-slate-400">{sc ? sc.waveInProgress : 'Neutral'}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {sc && (
            <span className="text-[11px] text-slate-500">
              Primary <span className="font-semibold tabular-nums text-slate-200">{sc.confidence.toFixed(0)}%</span>
            </span>
          )}
          <Maximize2 size={13} className="text-slate-600 transition group-hover:text-accent" />
        </span>
      </div>
      <div className="relative flex min-h-0 flex-1">
        <WaveChart
          candles={v.mock.candles}
          scenario={sc}
          signal={v.signalsPaused ? null : v.signal}
          showProjections={ui.showProjections}
          showTrade={ui.showTrade}
          compact
          className="pointer-events-none flex-1"
        />
      </div>
      <div className="flex h-8 items-center border-t border-border/70 px-3 text-[11px]">
        <SignalLine v={v} />
      </div>
    </div>
  );
}

/** Rail card in focus mode: the same confluence-card content without the chart. */
export function RailCard({ tf, active, onFocus }: { tf: Timeframe; active: boolean; onFocus: (tf: Timeframe) => void }) {
  const v = useTimeframeView(tf, 'primary');
  const sc = v.scenario;
  return (
    <button
      onClick={() => onFocus(tf)}
      aria-pressed={active}
      className={`flex min-w-[168px] flex-1 flex-col gap-1 rounded-md border px-2.5 py-1.5 text-left transition ${
        active ? 'border-accent bg-accent/5' : 'border-border bg-surface hover:border-slate-500'
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={`text-sm font-bold ${active ? 'text-accent' : 'text-slate-100'}`}>{tfLabel(tf)}</span>
        <DirectionBadge direction={sc?.direction ?? null} />
        {sc && <span className="ml-auto text-[11px] tabular-nums text-slate-400">{sc.confidence.toFixed(0)}%</span>}
      </span>
      <span className="truncate text-[11px] text-slate-500">{sc ? sc.waveInProgress : 'Neutral'}</span>
      <span className="text-[11px]">
        <SignalLine v={v} compact />
      </span>
    </button>
  );
}
