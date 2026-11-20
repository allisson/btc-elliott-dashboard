// PROTOTYPE ONLY. Prototype B's dominant block: the Signal for the focused timeframe (§9.5).
import { AlertTriangle, Check, CirclePause, Copy, Minus, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MIN_RR1, TIMEFRAMES } from '../../src/config.ts';
import type { PositionSize, Scenario, Signal } from '../../src/types.ts';
import { NEXT_WAVE, OFFLINE_SINCE, SETUP_NAMES, TIMEFRAME_MOCKS, copySetupText, fmt } from '../shared/mock.ts';
import { usePrototype, type Rank } from '../shared/PrototypeShell.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { DirectionBadge, StatusPill } from './ui.tsx';

export function SignalPanel({ onAdjustRisk }: { onAdjustRisk: () => void }) {
  const ui = usePrototype();
  const tf = ui.timeframe;
  const label = TIMEFRAMES.find((t) => t.id === tf)!.label;
  const { scenario, signal, size, signalsPaused } = useTimeframeView(tf);
  const a = TIMEFRAME_MOCKS[tf].analysis;
  const neutral = a.primary === null;

  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-border px-4 pt-3">
        <div className="pb-2.5">
          <div className="text-[11px] font-semibold tracking-widest text-slate-500 uppercase">Signal</div>
          <div className="text-lg leading-tight font-semibold text-slate-100">
            BTC/USDT <span className="text-accent">{label}</span>
          </div>
        </div>
        <div className="flex w-full sm:ml-auto sm:w-auto" role="tablist" aria-label="Scenario">
          <ScenarioTab rank="primary" confidence={a.primary?.confidence ?? null} neutral={neutral} />
          <ScenarioTab rank="alternative" confidence={a.alternative?.confidence ?? null} neutral={neutral} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {neutral ? (
          <EmptyState icon={<Minus size={22} />} title="Neutral" tone="muted">
            No valid Elliott count on {label}. No scenario, no Signal, and no Confluence vote.
          </EmptyState>
        ) : scenario === null ? (
          <EmptyState icon={<Minus size={22} />} title="Alternative Scenario unavailable" tone="muted">
            Only one valid count on {label}. Switch back to the Primary Scenario.
          </EmptyState>
        ) : (
          <>
            <ScenarioLine scenario={scenario} />
            {signalsPaused ? (
              <EmptyState icon={<CirclePause size={22} />} title={`Signals paused: data stale since ${OFFLINE_SINCE}`} tone="warn">
                The chart keeps the last real data. Signals return when the stream is back and backfill completes.
              </EmptyState>
            ) : signal && size ? (
              <SignalBody signal={signal} scenario={scenario} size={size} onAdjustRisk={onAdjustRisk} />
            ) : (
              <>
                <EmptyState icon={<Minus size={22} />} title={`No setup: waiting for ${NEXT_WAVE[scenario.count.lastLabel] ?? 'the next wave'}`} tone="muted">
                  The count ends at ({scenario.count.lastLabel}); no Setup applies until the next wave is confirmed.
                </EmptyState>
                <InvalidationBox scenario={scenario} />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ScenarioTab({ rank, confidence, neutral }: { rank: Rank; confidence: number | null; neutral: boolean }) {
  const ui = usePrototype();
  const active = ui.rank === rank;
  const unavailable = confidence === null;
  return (
    <button
      role="tab"
      aria-selected={active}
      disabled={neutral || (unavailable && !active)}
      onClick={() => ui.setRank(rank)}
      className={`-mb-px flex-1 border-b-2 px-3 pb-2.5 text-left sm:flex-none transition-colors disabled:cursor-not-allowed ${
        active && !neutral ? 'border-accent text-slate-100' : 'border-transparent text-slate-500 hover:text-slate-300 disabled:hover:text-slate-500'
      }`}
    >
      <div className="text-xs font-semibold whitespace-nowrap">{rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario'}</div>
      <div className="text-[11px] tabular-nums">{neutral ? '—' : unavailable ? 'unavailable' : `${confidence.toFixed(0)}% confidence`}</div>
    </button>
  );
}

function ScenarioLine({ scenario }: { scenario: Scenario }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <DirectionBadge direction={scenario.direction} size="md" />
      <span className="font-medium text-slate-200">{scenario.waveInProgress}</span>
      <span className="text-slate-500">· last point ({scenario.count.lastLabel})</span>
    </div>
  );
}

function statusReason(signal: Signal): string {
  if (signal.status === 'ACTIVE') return `Price between Stop Loss and TP1 with R:R ≥ 1:${MIN_RR1}`;
  if (signal.status === 'INVALIDATED') return 'Stop Loss or Invalidation price breached since the last close';
  const long = signal.side === 'LONG';
  if (long ? signal.entry >= signal.takeProfit1 : signal.entry <= signal.takeProfit1) return 'Price already past TP1: wait for a pullback';
  if (signal.rr1 < MIN_RR1) return `R:R to TP1 below 1:${MIN_RR1}`;
  return 'Trigger not met yet';
}

function SignalBody({ signal, scenario, size, onAdjustRisk }: { signal: Signal; scenario: Scenario; size: PositionSize; onAdjustRisk: () => void }) {
  const ui = usePrototype();
  const long = signal.side === 'LONG';
  const dim = signal.status === 'INVALIDATED' ? 'opacity-45' : '';
  const e = signal.entry;
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div
          className={`rounded-lg px-3.5 py-1.5 text-3xl leading-none font-extrabold tracking-tight ring-1 ${
            long ? 'bg-bullish/12 text-bullish ring-bullish/40' : 'bg-bearish/12 text-bearish ring-bearish/40'
          }`}
        >
          {signal.side} <span className="text-xl font-bold opacity-80">1x</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={signal.status} size="lg" />
            <span className="text-sm font-medium text-slate-200">{SETUP_NAMES[signal.setup]}</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">{statusReason(signal)}</div>
        </div>
        <CopyButton text={copySetupText(signal.timeframe, signal, scenario, size, ui.risk)} />
      </div>

      <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 ${dim}`}>
        <Metric label="Entry" value={fmt.price(e)} sub={<span className="text-slate-500">live price</span>} accent="text-sky-300" />
        <Metric label="Stop Loss" value={fmt.price(signal.stopLoss)} sub={<span className="text-bearish">{fmt.delta(signal.stopLoss, e)}</span>} />
        <Metric
          label="TP1"
          value={fmt.price(signal.takeProfit1)}
          sub={
            <>
              <span className={long ? 'text-bullish' : 'text-bearish'}>{fmt.delta(signal.takeProfit1, e)}</span>
              <span className={signal.rr1 >= MIN_RR1 ? 'text-slate-300' : 'text-accent'}>R:R {fmt.rr(signal.rr1)}</span>
            </>
          }
        />
        <Metric
          label="TP2"
          value={fmt.price(signal.takeProfit2)}
          sub={
            <>
              <span className={long ? 'text-bullish' : 'text-bearish'}>{fmt.delta(signal.takeProfit2, e)}</span>
              <span className="text-slate-300">R:R {fmt.rr(signal.rr2)}</span>
            </>
          }
        />
      </div>

      <div className={`grid gap-3 sm:grid-cols-2 ${dim}`}>
        <div className="rounded-lg bg-surface-2 px-3.5 py-3">
          <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Position size</div>
          <div className="mt-0.5 text-xl font-semibold text-slate-100 tabular-nums">
            {fmt.usdt(size.positionUsd)} <span className="text-sm font-normal text-slate-400">USDT</span>
          </div>
          <div className="text-xs text-slate-400 tabular-nums">
            {fmt.btc(size.positionBtc)} BTC · of {fmt.usdt(ui.risk.capital)} USDT capital
          </div>
        </div>
        <div className="rounded-lg bg-surface-2 px-3.5 py-3">
          <div className="flex items-center text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Risk
            <button onClick={onAdjustRisk} className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-accent/90 hover:text-accent">
              <SlidersHorizontal size={12} /> {ui.risk.riskPercent}% per trade
            </button>
          </div>
          <div className="mt-0.5 text-xl font-semibold text-slate-100 tabular-nums">
            {fmt.usdt(size.actualRiskUsd)} <span className="text-sm font-normal text-slate-400">USDT</span>
          </div>
          <div className="text-xs text-slate-400 tabular-nums">
            {size.actualRiskPercent.toFixed(2)}% of capital
            {size.capped && <span className="ml-1 text-accent">(capped by capital)</span>}
          </div>
        </div>
      </div>

      <InvalidationBox scenario={scenario} />
      <p className="text-[11px] text-slate-500">1x, no leverage. The Stop Loss sits at the Setup's level; Risk per trade changes the Position size only.</p>
    </>
  );
}

function Metric({ label, value, sub, accent = 'text-slate-100' }: { label: string; value: string; sub: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{label}</div>
      <div className={`text-base font-semibold tabular-nums sm:text-lg ${accent}`}>{value}</div>
      <div className="flex flex-wrap gap-x-2 text-xs tabular-nums">{sub}</div>
    </div>
  );
}

function InvalidationBox({ scenario }: { scenario: Scenario }) {
  const bull = scenario.count.impulseDirection === 'bullish';
  const beyondP5 = ['5', 'A', 'B'].includes(scenario.count.lastLabel);
  // §5.5 breach: s·(price − inv) ≤ 0 for (2)/(3)/(4); s·(price − P5) > 0 for (5)/(A)/(B).
  const side = beyondP5 ? (bull ? 'above' : 'below') : bull ? 'at or below' : 'at or above';
  return (
    <div className="flex gap-2.5 rounded-lg border border-bearish/40 bg-bearish/[0.07] px-3.5 py-2.5 text-sm">
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-bearish" />
      <div>
        <div className="font-semibold text-bearish">
          Invalid {side} <span className="tabular-nums">{fmt.price(scenario.invalidationPrice)}</span>
        </div>
        <div className="text-xs text-slate-300">{scenario.invalidationReason}</div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        );
      }}
      className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
        copied ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/40' : 'bg-accent text-black hover:brightness-110'
      }`}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied ? 'Copied' : 'Copy Setup'}
    </button>
  );
}

function EmptyState({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: 'muted' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border border-dashed px-4 py-5 ${
        tone === 'warn' ? 'border-accent/50 bg-accent/[0.06]' : 'border-border bg-surface-2/40'
      }`}
    >
      <span className={tone === 'warn' ? 'text-accent' : 'text-slate-500'}>{icon}</span>
      <div>
        <div className={`text-base font-semibold ${tone === 'warn' ? 'text-accent' : 'text-slate-200'}`}>{title}</div>
        <div className="mt-0.5 text-sm text-slate-400">{children}</div>
      </div>
    </div>
  );
}
