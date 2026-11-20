// Header (spec §9.2). Presentational: the toggles and the focus live in Dashboard.
import { Bitcoin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PRICE_FLASH_MS, TIMEFRAMES } from '../config.ts';
import { formatUtcTime } from '../lib/format.ts';
import { headerStats } from '../lib/panels.ts';
import type { Ticker, Timeframe } from '../types.ts';

interface HeaderProps {
  ticker: Ticker;
  timeframe: Timeframe;
  onTimeframe: (t: Timeframe) => void;
  showProjections: boolean;
  onProjections: (v: boolean) => void;
  showSignalLines: boolean;
  onSignalLines: (v: boolean) => void;
  pausedSince: number | null;
}

// Green or red for PRICE_FLASH_MS after the price moves up or down.
function usePriceFlash(price: number): 'up' | 'down' | null {
  const previous = useRef(price);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (price === previous.current) return;
    setFlash(price > previous.current ? 'up' : 'down');
    previous.current = price;
    const id = setTimeout(() => setFlash(null), PRICE_FLASH_MS);
    return () => clearTimeout(id);
  }, [price]);
  return flash;
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={`rounded border px-2 py-1 text-xs ${on ? 'border-accent text-accent' : 'border-border text-slate-500'}`}
    >
      {label}
    </button>
  );
}

export function Header({ ticker, timeframe, onTimeframe, showProjections, onProjections, showSignalLines, onSignalLines, pausedSince }: HeaderProps) {
  const stats = headerStats(ticker);
  const flash = usePriceFlash(ticker.price);
  const priceColor = flash === 'up' ? 'text-bullish' : flash === 'down' ? 'text-bearish' : 'text-slate-100';

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex items-center gap-2">
          <Bitcoin className="size-5 text-accent" aria-hidden="true" />
          <span className="font-semibold">BTC/USDT</span>
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">Binance Spot</span>
        </div>
        <span className={`font-mono text-lg font-semibold tabular-nums transition-colors ${priceColor}`}>{stats.price}</span>
        <span className={`font-mono text-sm tabular-nums ${stats.up ? 'text-bullish' : 'text-bearish'}`}>{stats.change}</span>
        <span className="font-mono text-xs tabular-nums text-slate-400">
          {stats.high} · {stats.low}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTimeframe(t.id)}
              className={`rounded px-2 py-1 text-xs font-medium ${t.id === timeframe ? 'bg-accent text-background' : 'bg-surface-2 text-slate-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Toggle label="Projections" on={showProjections} onChange={onProjections} />
        <Toggle label="Trade 1x" on={showSignalLines} onChange={onSignalLines} />
        {pausedSince === null ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-bullish">
            <span className="size-2 animate-pulse rounded-full bg-bullish" aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <span className="text-xs font-medium text-bearish">OFFLINE · last update {formatUtcTime(pausedSince)}</span>
        )}
      </div>
    </header>
  );
}
