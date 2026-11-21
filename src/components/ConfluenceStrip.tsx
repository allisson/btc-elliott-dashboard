// Confluence strip (spec §9.3). Presentational: one card per timeframe, always the Primary Scenario.
import type { StripCard } from '../lib/panels.ts';
import type { Confluence, Timeframe } from '../types.ts';

interface ConfluenceStripProps {
  confluence: Confluence;
  badge: string;
  cards: { timeframe: Timeframe; card: StripCard }[];
  focused: Timeframe;
  onFocus: (t: Timeframe) => void;
}

const STATUS_COLORS: Record<StripCard['status'], string> = {
  ACTIVE: 'text-bullish',
  WATCHING: 'text-accent',
  INVALIDATED: 'text-bearish',
  'NO SETUP': 'text-slate-500',
  NEUTRAL: 'text-slate-500',
  PAUSED: 'text-slate-400',
};

const majorityColor = (c: Confluence) =>
  c.majority === 'bullish' ? 'text-bullish' : c.majority === 'bearish' ? 'text-bearish' : 'text-slate-300';

export function DirectionBadge({ direction }: { direction: 'bullish' | 'bearish' }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${direction === 'bullish' ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'}`}
    >
      {direction}
    </span>
  );
}

export function ConfluenceStrip({ confluence, badge, cards, focused, onFocus }: ConfluenceStripProps) {
  const [name, detail] = badge.split(' · ');
  return (
    <section className="flex gap-2 overflow-x-auto lg:overflow-visible">
      <div className="flex min-w-36 shrink-0 flex-col justify-center lg:min-w-0 rounded-md border border-border bg-surface px-3 py-2 lg:flex-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">Confluence</span>
        <span className={`text-sm font-semibold ${majorityColor(confluence)}`}>{name}</span>
        <span className="text-xs text-slate-400">{detail}</span>
      </div>
      {cards.map(({ timeframe, card }) => (
        <button
          key={timeframe}
          type="button"
          onClick={() => onFocus(timeframe)}
          className={`flex min-w-44 shrink-0 flex-col gap-1 lg:min-w-0 rounded-md border bg-surface px-3 py-2 text-left lg:flex-1 ${timeframe === focused ? 'border-accent' : 'border-border hover:border-slate-500'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{card.label}</span>
            {card.direction && <DirectionBadge direction={card.direction} />}
          </div>
          <span className="truncate text-xs text-slate-400">{card.wave ?? 'No valid count'}</span>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={`font-semibold ${STATUS_COLORS[card.status]}`}>{card.status}</span>
            {card.confidence && <span className="tabular-nums text-slate-400">{card.confidence}</span>}
          </div>
        </button>
      ))}
    </section>
  );
}
