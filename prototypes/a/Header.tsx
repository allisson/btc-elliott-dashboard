// PROTOTYPE ONLY. §9.2 Header: instrument, live price, 24h stats, timeframe and chart toggles, connection.
import { Bitcoin, Crosshair, Spline } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TIMEFRAMES } from '../../src/config.ts';
import { OFFLINE_SINCE, fmt, tickerAt } from '../shared/mock.ts';
import { usePrototype } from '../shared/PrototypeShell.tsx';

function usePriceFlash(price: number): 'up' | 'down' | null {
  const prev = useRef(price);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  useEffect(() => {
    if (price === prev.current) return;
    setFlash(price > prev.current ? 'up' : 'down');
    prev.current = price;
    const id = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(id);
  }, [price]);
  return flash;
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] tracking-wider text-slate-500 uppercase">{label}</span>
      <span className="font-mono text-xs text-slate-200 tabular-nums">{children}</span>
    </div>
  );
}

function Toggle({ on, onChange, icon, label }: { on: boolean; onChange: (v: boolean) => void; icon: ReactNode; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors ${
        on ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      {label}
      <span className={`ml-0.5 h-1.5 w-1.5 rounded-full ${on ? 'bg-accent' : 'bg-slate-600'}`} />
    </button>
  );
}

function ConnectionBadge({ offline }: { offline: boolean }) {
  if (offline) {
    return (
      <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-bearish/40 bg-bearish/10 px-2 font-mono text-[11px] font-semibold text-bearish">
        <span className="h-1.5 w-1.5 rounded-full bg-bearish" />
        OFFLINE · last update {OFFLINE_SINCE}
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-bullish/30 bg-bullish/10 px-2 font-mono text-[11px] font-semibold text-bullish">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-bullish" />
      </span>
      LIVE
    </span>
  );
}

export function Header() {
  const ui = usePrototype();
  const t = tickerAt(ui.price);
  const flash = usePriceFlash(ui.price);
  const up = t.change24h >= 0;
  const offline = ui.mode === 'offline';

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-surface px-4 py-2.5">
      {/* Left: instrument, price, stats */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Bitcoin size={20} strokeWidth={2.25} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-wide text-slate-100">BTC/USDT</span>
          <span className="w-fit rounded bg-surface-2 px-1 text-[10px] font-medium text-slate-400">Binance Spot</span>
        </div>
      </div>

      {/* Mobile: connection sits next to the instrument */}
      <div className="ml-auto sm:hidden">
        <ConnectionBadge offline={offline} />
      </div>

      <div className="flex w-full flex-wrap items-end gap-x-5 gap-y-1 sm:w-auto">
        <span
          className={`rounded px-1 font-mono text-2xl font-semibold tabular-nums transition-colors duration-700 ${
            flash === 'up' ? 'bg-bullish/20 text-bullish' : flash === 'down' ? 'bg-bearish/20 text-bearish' : up ? 'text-bullish' : 'text-bearish'
          }`}
        >
          {fmt.price(t.price)}
        </span>
        <Stat label="24h change">
          <span className={up ? 'text-bullish' : 'text-bearish'}>
            {up ? '+' : ''}
            {fmt.usdt(t.change24h)} {fmt.pct(t.changePercent24h)}
          </span>
        </Stat>
        <Stat label="24h high">{fmt.price(t.high24h)}</Stat>
        <Stat label="24h low">{fmt.price(t.low24h)}</Stat>
      </div>

      <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        <div className="flex rounded-md border border-border bg-background p-0.5" role="tablist" aria-label="Timeframe">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              role="tab"
              aria-selected={ui.timeframe === tf.id}
              onClick={() => ui.setTimeframe(tf.id)}
              className={`h-6 w-9 rounded font-mono text-xs font-semibold transition-colors ${
                ui.timeframe === tf.id ? 'bg-accent text-black' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <Toggle on={ui.showProjections} onChange={ui.setShowProjections} icon={<Spline size={13} />} label="Projections" />
        <Toggle on={ui.showTrade} onChange={ui.setShowTrade} icon={<Crosshair size={13} />} label="Trade 1x" />
        <div className="hidden sm:block">
          <ConnectionBadge offline={offline} />
        </div>
      </div>
    </header>
  );
}
