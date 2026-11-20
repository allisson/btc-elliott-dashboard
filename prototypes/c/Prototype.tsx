// PROTOTYPE ONLY. C · Multi-timeframe grid.
// Grid mode: the four timeframes as a 2×2 of mini charts; each cell is a confluence card (§9.3).
// Focus mode: the focused chart fills the grid area, the four cards shrink into a rail above it,
// and the Signal panel opens as a drawer on the right (bottom sheet below md). Esc returns to grid.
import { ArrowLeft, Bitcoin, LayoutGrid, PanelRightOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TIMEFRAMES } from '../../src/config.ts';
import type { Timeframe } from '../../src/types.ts';
import { OFFLINE_SINCE, TIMEFRAME_MOCKS, confluence, fmt, tickerAt } from '../shared/mock.ts';
import { PrototypeShell, usePrototype } from '../shared/PrototypeShell.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { WaveChart } from '../shared/WaveChart.tsx';
import { DirectionBadge, RailCard, TimeframeCell, confluenceText, tfLabel } from './parts.tsx';
import { SignalPanel } from './SignalPanel.tsx';

export function Prototype() {
  return (
    <PrototypeShell id="c">
      <Page />
    </PrototypeShell>
  );
}

function Page() {
  const ui = usePrototype();
  const [focused, setFocused] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);

  const focus = (tf: Timeframe) => {
    if (!focused || tf !== ui.timeframe) ui.setRank('primary');
    ui.setTimeframe(tf);
    setFocused(true);
    setDrawerOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocused(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto md:overflow-hidden">
      <Header focusedTf={focused ? ui.timeframe : null} onFocus={focus} />
      <ConfluenceBar focused={focused} onBack={() => setFocused(false)} />
      <main className="flex md:min-h-0 md:flex-1">
        {focused ? (
          <FocusView
            tf={ui.timeframe}
            onFocus={focus}
            onBack={() => setFocused(false)}
            drawerOpen={drawerOpen}
            setDrawerOpen={setDrawerOpen}
          />
        ) : (
          <div className="grid flex-1 grid-cols-1 gap-3 p-3 pb-20 md:grid-cols-2 md:grid-rows-2 md:pb-3">
            {TIMEFRAMES.map((t) => (
              <TimeframeCell key={t.id} tf={t.id} onFocus={focus} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- header (§9.2)

function usePriceFlash(price: number): string {
  const prev = useRef(price);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (price === prev.current) return;
    setFlash(price > prev.current ? 'text-bullish' : 'text-bearish');
    prev.current = price;
    const id = setTimeout(() => setFlash(''), 700);
    return () => clearTimeout(id);
  }, [price]);
  return flash;
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      onClick={() => set(!on)}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition ${
        on ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border text-slate-400 hover:text-slate-200'
      }`}
    >
      <span className={`relative h-3 w-5 rounded-full transition ${on ? 'bg-accent' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 h-2 w-2 rounded-full bg-black transition-all ${on ? 'left-2.5' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

function Header({ focusedTf, onFocus }: { focusedTf: Timeframe | null; onFocus: (tf: Timeframe) => void }) {
  const ui = usePrototype();
  const t = tickerAt(ui.price);
  const flash = usePriceFlash(t.price);
  const up = t.change24h >= 0;
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Bitcoin size={22} className="text-accent" />
        <span className="text-base font-bold tracking-tight">BTC/USDT</span>
        <span className="rounded border border-border px-1.5 py-px text-[10px] font-medium text-slate-400">Binance Spot</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-xl font-semibold tabular-nums transition-colors duration-500 ${flash || 'text-slate-50'}`}>
          {fmt.price(t.price)}
        </span>
        <span className={`text-xs font-medium tabular-nums ${up ? 'text-bullish' : 'text-bearish'}`}>
          {up ? '+' : ''}
          {fmt.price(t.change24h)} {fmt.pct(t.changePercent24h)}
        </span>
      </div>
      <dl className="flex gap-4 text-[11px] tabular-nums">
        <div>
          <dt className="text-slate-500">24h High</dt>
          <dd className="text-slate-200">{fmt.price(t.high24h)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">24h Low</dt>
          <dd className="text-slate-200">{fmt.price(t.low24h)}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Focus timeframe">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.id}
              onClick={() => onFocus(tf.id)}
              className={`rounded px-2.5 py-0.5 text-xs font-semibold transition ${
                focusedTf === tf.id ? 'bg-accent text-black' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <Toggle label="Projections" on={ui.showProjections} set={ui.setShowProjections} />
        <Toggle label="Trade 1x" on={ui.showTrade} set={ui.setShowTrade} />
        {ui.mode === 'offline' ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-bearish/40 bg-bearish/10 px-2 py-1 text-[11px] font-semibold text-bearish">
            <span className="h-1.5 w-1.5 rounded-full bg-bearish" />
            OFFLINE · last update {OFFLINE_SINCE}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-bullish/30 bg-bullish/10 px-2 py-1 text-[11px] font-semibold text-bullish">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-bullish" />
            </span>
            LIVE
          </span>
        )}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- confluence badge (§8)

function ConfluenceBar({ focused, onBack }: { focused: boolean; onBack: () => void }) {
  const c = confluence();
  const txt = confluenceText(c);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-background px-4 py-2">
      <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Confluence</span>
      <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-xs font-semibold ${txt.tone}`}>
        {txt.title}
        <span className="font-normal opacity-80">{txt.detail}</span>
      </span>
      <span className="flex items-center gap-1" aria-label="Votes by timeframe">
        {TIMEFRAMES.map((t) => {
          const d = TIMEFRAME_MOCKS[t.id].analysis.primary?.direction;
          return (
            <span
              key={t.id}
              title={`${t.label}: ${d ?? 'Neutral (no vote)'}`}
              className={`flex h-5 w-8 items-center justify-center rounded-sm text-[10px] font-bold ${
                d === 'bullish' ? 'bg-bullish/20 text-bullish' : d === 'bearish' ? 'bg-bearish/20 text-bearish' : 'bg-white/5 text-slate-500'
              }`}
            >
              {t.label}
            </span>
          );
        })}
      </span>
      <span className="hidden text-[11px] text-slate-500 sm:inline">
        Votes come from each Primary Scenario. {focused ? '' : 'Click a timeframe to focus it.'}
      </span>
      {focused && (
        <button
          onClick={onBack}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs text-slate-300 hover:border-slate-500 hover:text-slate-100"
        >
          <LayoutGrid size={13} /> Back to grid <kbd className="hidden rounded bg-white/10 px-1 text-[10px] text-slate-400 md:inline">Esc</kbd>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- focus mode

function FocusView(props: {
  tf: Timeframe;
  onFocus: (tf: Timeframe) => void;
  onBack: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}) {
  const ui = usePrototype();
  const { tf, drawerOpen, setDrawerOpen } = props;
  const v = useTimeframeView(tf);
  const sc = v.scenario;
  const neutral = TIMEFRAME_MOCKS[tf].analysis.primary === null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {TIMEFRAMES.map((t) => (
            <RailCard key={t.id} tf={t.id} active={t.id === tf} onFocus={props.onFocus} />
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/70 px-3 py-2">
            <button
              onClick={props.onBack}
              aria-label="Back to grid"
              className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-100"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-lg font-bold text-slate-100">{tfLabel(tf)}</span>
            <DirectionBadge direction={sc?.direction ?? null} size="md" />
            <span className="text-sm text-slate-300">
              {neutral ? 'Neutral: candles only' : sc ? sc.waveInProgress : 'Alternative Scenario unavailable'}
            </span>
            {sc && (
              <span className="text-xs text-slate-500">
                {sc.rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario'}{' '}
                <span className="tabular-nums text-slate-300">{sc.confidence.toFixed(0)}%</span>
              </span>
            )}
            <span className="ml-auto flex items-center gap-3 text-[11px] text-slate-500">
              <span className="hidden items-center gap-1 lg:inline-flex">
                <span className="h-0.5 w-4 bg-wave-confirmed" /> Confirmed
              </span>
              {ui.showProjections && (
                <span className="hidden items-center gap-1 lg:inline-flex">
                  <span className="h-0 w-4 border-t-2 border-dashed border-wave-projected" /> Projected
                </span>
              )}
              {!drawerOpen && (
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-black hover:brightness-110"
                >
                  <PanelRightOpen size={14} /> Signal panel
                </button>
              )}
            </span>
          </div>
          <WaveChart
            candles={v.mock.candles}
            scenario={sc}
            signal={v.signalsPaused ? null : v.signal}
            showProjections={ui.showProjections}
            showTrade={ui.showTrade}
            className="h-[62dvh] md:h-auto md:flex-1"
          />
        </div>
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed inset-x-0 bottom-0 z-40 flex h-[85dvh] flex-col rounded-t-2xl border-t border-border bg-surface shadow-2xl md:static md:z-auto md:h-auto md:w-[380px] md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none">
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-600 md:hidden" />
            <SignalPanel tf={tf} v={v} onClose={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}
    </div>
  );
}
