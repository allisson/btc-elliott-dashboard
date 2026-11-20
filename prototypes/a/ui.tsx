// PROTOTYPE ONLY. Small visual atoms shared by the Terminal layout.
import { ArrowDownRight, ArrowUpRight, Minus, PauseCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Direction, Signal } from '../../src/types.ts';
import { OFFLINE_SINCE } from '../shared/mock.ts';

export function DirectionBadge({ direction, size = 'sm' }: { direction: Direction | null; size?: 'xs' | 'sm' }) {
  const pad = size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]';
  if (direction === null) {
    return (
      <span className={`inline-flex items-center gap-1 rounded font-semibold tracking-wide bg-slate-500/15 text-slate-400 ${pad}`}>
        <Minus size={11} /> NEUTRAL
      </span>
    );
  }
  const bull = direction === 'bullish';
  const Icon = bull ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold tracking-wide ${pad} ${
        bull ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'
      }`}
    >
      <Icon size={12} strokeWidth={2.5} /> {bull ? 'BULLISH' : 'BEARISH'}
    </span>
  );
}

const STATUS_STYLE: Record<Signal['status'], string> = {
  ACTIVE: 'bg-bullish text-black',
  WATCHING: 'border border-accent/70 text-accent',
  INVALIDATED: 'bg-bearish/20 text-bearish line-through decoration-1',
};

export function StatusBadge({ status }: { status: Signal['status'] }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

export function MutedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-border px-1.5 py-px font-mono text-[10px] font-bold tracking-wider text-slate-500">
      {children}
    </span>
  );
}

export function SideBadge({ side }: { side: Signal['side'] }) {
  const long = side === 'LONG';
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
        long ? 'bg-bullish text-black' : 'bg-bearish text-white'
      }`}
    >
      {side} 1x
    </span>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">{children}</h3>
      {right}
    </div>
  );
}

export function SignalsPaused({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-slate-500">
        <PauseCircle size={11} /> PAUSED
      </span>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-accent/30 bg-accent/5 px-3 py-2.5 text-sm text-slate-300">
      <PauseCircle size={16} className="mt-0.5 shrink-0 text-accent" />
      <span>
        Signals paused: data stale since <span className="font-mono tabular-nums text-slate-100">{OFFLINE_SINCE}</span>
      </span>
    </div>
  );
}
