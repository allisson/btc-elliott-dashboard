// PROTOTYPE ONLY. §9.3 Confluence strip: §8 badge + one card per timeframe (always the Primary Scenario).
import { Layers } from 'lucide-react';
import { TIMEFRAMES, type TimeframeConfig } from '../../src/config.ts';
import { confluence } from '../shared/mock.ts';
import { usePrototype } from '../shared/PrototypeShell.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { DirectionBadge, MutedBadge, SignalsPaused, StatusBadge } from './ui.tsx';

function ConfluenceBadge() {
  const c = confluence();
  const title = c.label === 'strong' ? 'Strong Confluence' : c.label === 'mixed' ? 'Mixed Market' : 'No Confluence';
  const tone =
    c.majority === 'bullish' ? 'text-bullish' : c.majority === 'bearish' ? 'text-bearish' : 'text-slate-400';
  const detail =
    c.majority === null ? 'no votes' : c.majority === 'split' ? 'split' : `${c.majority} majority`;
  return (
    <div className="flex min-w-[168px] shrink-0 flex-col justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">
        <Layers size={12} /> Confluence
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-100">{title}</div>
        <div className={`text-xs capitalize ${tone}`}>{detail}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 w-5 rounded-sm ${i < c.agree ? (c.majority === 'bearish' ? 'bg-bearish' : c.majority === 'bullish' ? 'bg-bullish' : 'bg-slate-400') : 'bg-border'}`} />
          ))}
        </div>
        <span className="font-mono text-xs font-semibold text-slate-200 tabular-nums">{c.agree}/4</span>
      </div>
    </div>
  );
}

function TimeframeCard({ tf }: { tf: TimeframeConfig }) {
  const ui = usePrototype();
  const v = useTimeframeView(tf.id, 'primary');
  const focused = ui.timeframe === tf.id;
  const s = v.scenario;

  return (
    <button
      onClick={() => ui.setTimeframe(tf.id)}
      aria-pressed={focused}
      className={`group flex min-w-[172px] flex-1 shrink-0 flex-col gap-1.5 rounded-md border px-3 py-2 text-left transition-colors ${
        focused ? 'border-accent/70 bg-accent/[0.06] ring-1 ring-accent/30' : 'border-border bg-surface hover:border-slate-600'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-mono text-sm font-bold ${focused ? 'text-accent' : 'text-slate-200'}`}>{tf.label}</span>
        <DirectionBadge direction={s?.direction ?? null} size="xs" />
      </div>
      <div className="truncate text-xs text-slate-400">{s ? s.waveInProgress : 'No valid count'}</div>
      <div className="mt-auto flex items-center justify-between gap-2">
        {!s ? (
          <MutedBadge>NEUTRAL</MutedBadge>
        ) : v.signalsPaused ? (
          <SignalsPaused compact />
        ) : v.signal ? (
          <StatusBadge status={v.signal.status} />
        ) : (
          <MutedBadge>NO SETUP</MutedBadge>
        )}
        <span className="font-mono text-[11px] text-slate-500 tabular-nums">
          {s ? (
            <>
              Primary <span className="text-slate-200">{s.confidence.toFixed(0)}%</span>
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
      <div className="h-0.5 w-full overflow-hidden rounded bg-border">
        {s && (
          <div
            className={`h-full ${s.direction === 'bullish' ? 'bg-bullish/70' : 'bg-bearish/70'}`}
            style={{ width: `${s.confidence}%` }}
          />
        )}
      </div>
    </button>
  );
}

export function ConfluenceStrip() {
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-border bg-background px-4 py-2.5 [scrollbar-width:thin]">
      <ConfluenceBadge />
      {TIMEFRAMES.map((tf) => (
        <TimeframeCard key={tf.id} tf={tf} />
      ))}
    </div>
  );
}
