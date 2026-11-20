// PROTOTYPE ONLY. Confluence badge + one card per timeframe; the cards are the timeframe selector (§9.3).
import { Layers } from 'lucide-react';
import { TIMEFRAMES } from '../../src/config.ts';
import type { Timeframe } from '../../src/types.ts';
import { confluence } from '../shared/mock.ts';
import { usePrototype } from '../shared/PrototypeShell.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { DirectionBadge, MutedPill, StatusPill } from './ui.tsx';

export function ConfluencePanel() {
  const c = confluence();
  const title = c.label === 'strong' ? 'Strong Confluence' : c.label === 'mixed' ? 'Mixed Market' : 'No Confluence';
  const majority =
    c.majority === 'bullish' ? 'bullish majority' : c.majority === 'bearish' ? 'bearish majority' : c.majority === 'split' ? 'split' : null;
  const tone =
    c.label === 'none' || c.majority === 'split' || c.majority === null
      ? 'text-slate-300 ring-slate-600'
      : c.majority === 'bullish'
        ? 'text-bullish ring-bullish/40 bg-bullish/10'
        : 'text-bearish ring-bearish/40 bg-bearish/10';

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Layers size={15} className="text-slate-500" />
        <span className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Confluence</span>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tone}`}>
          {title}
          {majority && c.label !== 'strong' && <span className="font-normal opacity-80">· {majority}</span>}
          <span className="tabular-nums opacity-80">· {c.agree}/4</span>
        </span>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2">
        {TIMEFRAMES.map((t) => (
          <TimeframeCard key={t.id} tf={t.id} label={t.label} />
        ))}
      </div>
      <p className="mt-2.5 text-[11px] text-slate-500">Votes use each Primary Scenario. Select a card to focus that timeframe.</p>
    </section>
  );
}

function TimeframeCard({ tf, label }: { tf: Timeframe; label: string }) {
  const ui = usePrototype();
  const { scenario, signal, signalsPaused } = useTimeframeView(tf, 'primary');
  const focused = ui.timeframe === tf;
  return (
    <button
      onClick={() => ui.setTimeframe(tf)}
      aria-pressed={focused}
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        focused ? 'border-accent bg-accent/[0.06] shadow-[inset_0_0_0_1px_var(--color-accent)]' : 'border-border bg-surface-2/60 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-base font-bold ${focused ? 'text-accent' : 'text-slate-100'}`}>{label}</span>
        <DirectionBadge direction={scenario?.direction ?? null} />
      </div>
      <div className="min-h-[1rem] truncate text-xs text-slate-400">{scenario ? scenario.waveInProgress : 'No valid count'}</div>
      <div className="mt-auto flex items-center gap-2">
        {scenario === null ? (
          <MutedPill>NEUTRAL</MutedPill>
        ) : signalsPaused ? (
          <MutedPill>PAUSED</MutedPill>
        ) : signal ? (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className={`text-[10px] font-bold ${signal.side === 'LONG' ? 'text-bullish' : 'text-bearish'}`}>{signal.side}</span>
            <StatusPill status={signal.status} />
          </span>
        ) : (
          <MutedPill>NO SETUP</MutedPill>
        )}
      </div>
      {scenario && (
        <div className="flex items-center gap-2" title="Primary Scenario confidence">
          <div className="h-0.5 flex-1 overflow-hidden rounded bg-border">
            <div className="h-full bg-slate-400/70" style={{ width: `${scenario.confidence}%` }} />
          </div>
          <span className="text-[11px] text-slate-500 tabular-nums">{scenario.confidence.toFixed(0)}%</span>
        </div>
      )}
    </button>
  );
}
