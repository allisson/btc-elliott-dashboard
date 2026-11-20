// PROTOTYPE ONLY. Small presentational pieces shared by prototype B.
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleX, Eye, Minus, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Direction, Signal } from '../../src/types.ts';

export function DirectionBadge({ direction, size = 'sm' }: { direction: Direction | null; size?: 'sm' | 'md' }) {
  const pad = size === 'md' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-px text-[10px]';
  if (direction === null) {
    return (
      <span className={`inline-flex items-center gap-1 rounded font-semibold tracking-wide text-slate-400 ring-1 ring-slate-600 ${pad}`}>
        <Minus size={11} /> NEUTRAL
      </span>
    );
  }
  const bull = direction === 'bullish';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-semibold tracking-wide ring-1 ${pad} ${
        bull ? 'bg-bullish/10 text-bullish ring-bullish/40' : 'bg-bearish/10 text-bearish ring-bearish/40'
      }`}
    >
      {bull ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {bull ? 'BULLISH' : 'BEARISH'}
    </span>
  );
}

const STATUS_STYLE: Record<Signal['status'], { cls: string; icon: ReactNode }> = {
  ACTIVE: { cls: 'bg-bullish text-black ring-bullish', icon: <Zap size={12} className="fill-current" /> },
  WATCHING: { cls: 'bg-accent/10 text-accent ring-accent/50', icon: <Eye size={12} /> },
  INVALIDATED: { cls: 'bg-bearish/10 text-bearish ring-bearish/50 line-through decoration-1', icon: <CircleX size={12} /> },
};

export function StatusPill({ status, size = 'sm' }: { status: Signal['status']; size?: 'sm' | 'lg' }) {
  const s = STATUS_STYLE[status];
  const pad = size === 'lg' ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-px text-[10px]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold tracking-wider ring-1 ${pad} ${s.cls}`}>
      {s.icon}
      {status}
    </span>
  );
}

export function MutedPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-bold tracking-wider text-slate-400 ring-1 ring-slate-600">
      {children}
    </span>
  );
}

export function Disclosure(props: {
  id: string;
  icon: ReactNode;
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section id={props.id} className="scroll-mt-20 rounded-xl border border-border bg-surface">
      <button
        onClick={props.onToggle}
        aria-expanded={props.open}
        aria-controls={`${props.id}-body`}
        className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <span className="text-slate-500">{props.icon}</span>
        <span className="text-sm font-semibold text-slate-200">{props.title}</span>
        <span className="ml-auto truncate text-xs text-slate-500">{props.summary}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${props.open ? 'rotate-180' : ''}`} />
      </button>
      {props.open && (
        <div id={`${props.id}-body`} className="border-t border-border px-4 py-3">
          {props.children}
        </div>
      )}
    </section>
  );
}
