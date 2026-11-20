// PROTOTYPE ONLY. §9.5 Signal panel for the focused timeframe and scenario rank.
import { Check, CircleDashed, Copy, Hourglass, Info, ShieldAlert, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { FIB_TARGETS, RISK_DEFAULTS, RISK_LIMITS, TIMEFRAMES } from '../../src/config.ts';
import type { FibRatios, PositionSize, RuleCheck, RiskSettings, Scenario, Signal } from '../../src/types.ts';
import { NEXT_WAVE, SETUP_NAMES, copySetupText, fmt } from '../shared/mock.ts';
import { usePrototype, type Rank } from '../shared/PrototypeShell.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { DirectionBadge, SectionTitle, SideBadge, SignalsPaused, StatusBadge } from './ui.tsx';

// ---------------------------------------------------------------- scenario tabs

function ScenarioTabs() {
  const ui = usePrototype();
  const primary = useTimeframeView(ui.timeframe, 'primary').scenario;
  const alternative = useTimeframeView(ui.timeframe, 'alternative').scenario;
  const tabs: Array<{ rank: Rank; name: string; scenario: Scenario | null }> = [
    { rank: 'primary', name: 'Primary Scenario', scenario: primary },
    { rank: 'alternative', name: 'Alternative Scenario', scenario: alternative },
  ];
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1" role="tablist">
      {tabs.map((t) => {
        const active = ui.rank === t.rank;
        return (
          <button
            key={t.rank}
            role="tab"
            aria-selected={active}
            onClick={() => ui.setRank(t.rank)}
            className={`flex flex-col items-start rounded px-2.5 py-1.5 text-left transition-colors ${
              active ? 'bg-surface-2 text-slate-100 shadow-[inset_0_-2px_0_0_var(--color-accent)]' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-xs font-semibold">{t.name}</span>
            <span className="font-mono text-[11px] tabular-nums">
              {t.scenario ? `${t.scenario.confidence.toFixed(0)}% confidence` : primary ? 'unavailable' : '—'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- signal card

function CopySetupButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const id = setTimeout(() => setState('idle'), 1600);
    return () => clearTimeout(id);
  }, [state]);
  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => setState('copied'),
      () => setState('failed'),
    );
  };
  return (
    <button
      onClick={copy}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
        state === 'copied'
          ? 'bg-bullish/15 text-bullish'
          : state === 'failed'
            ? 'bg-bearish/15 text-bearish'
            : 'bg-accent text-black hover:brightness-110'
      }`}
    >
      {state === 'copied' ? <Check size={13} /> : <Copy size={13} />}
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy Setup'}
    </button>
  );
}

function Metric({ label, value, sub, tone = 'text-slate-100', wide = false }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string; wide?: boolean }) {
  return (
    <div className={`bg-surface px-3 py-2 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-[10px] tracking-wider text-slate-500 uppercase">{label}</div>
      <div className={`font-mono text-sm font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="font-mono text-[11px] text-slate-400 tabular-nums">{sub}</div>}
    </div>
  );
}

function SignalCard({ signal, scenario, size, risk }: { signal: Signal; scenario: Scenario; size: PositionSize; risk: RiskSettings }) {
  const ui = usePrototype();
  const e = signal.entry;
  const invalid = signal.status === 'INVALIDATED';
  return (
    <div className={`overflow-hidden rounded-md border ${invalid ? 'border-bearish/40' : 'border-border'} bg-surface-2`}>
      <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
        <SideBadge side={signal.side} />
        <StatusBadge status={signal.status} />
        <div className="ml-auto">
          <CopySetupButton text={copySetupText(ui.timeframe, signal, scenario, size, risk)} />
        </div>
      </div>
      <div className="px-3 pt-2 pb-3">
        <div className="text-sm font-semibold text-slate-100">{SETUP_NAMES[signal.setup]}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
          <Info size={11} /> 1x, no leverage. Spot only.
        </div>
      </div>
      <div className={`grid grid-cols-2 gap-px border-t border-border bg-border ${invalid ? 'opacity-60' : ''}`}>
        <Metric label="Entry" value={fmt.price(e)} sub="live price" tone="text-sky-300" />
        <Metric label="Stop Loss" value={fmt.price(signal.stopLoss)} sub={fmt.delta(signal.stopLoss, e)} tone="text-bearish" />
        <Metric label="TP1" value={fmt.price(signal.takeProfit1)} sub={<>{fmt.delta(signal.takeProfit1, e)} · R:R {fmt.rr(signal.rr1)}</>} tone="text-bullish" />
        <Metric label="TP2" value={fmt.price(signal.takeProfit2)} sub={<>{fmt.delta(signal.takeProfit2, e)} · R:R {fmt.rr(signal.rr2)}</>} tone="text-emerald-600" />
        <Metric label="Position" value={`${fmt.usdt(size.positionUsd)} USDT`} sub={`${fmt.btc(size.positionBtc)} BTC`} />
        <Metric
          label="Risk"
          value={`${fmt.usdt(size.actualRiskUsd)} USDT`}
          sub={
            <>
              {size.actualRiskPercent.toFixed(2)}% of capital
              {size.capped && <span className="text-accent"> (capped by capital)</span>}
            </>
          }
        />
      </div>
    </div>
  );
}

function InvalidationBox({ scenario }: { scenario: Scenario }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-bearish/40 bg-bearish/10 px-3 py-2.5">
      <ShieldAlert size={16} className="mt-0.5 shrink-0 text-bearish" />
      <div className="text-xs">
        <div className="font-semibold tracking-wide text-bearish uppercase">Invalidation price</div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-slate-100 tabular-nums">{fmt.price(scenario.invalidationPrice)}</div>
        <div className="mt-0.5 text-slate-300">{scenario.invalidationReason}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- risk inputs

function RiskInput({ label, value, onChange, unit, hint, invalid }: { label: string; value: string; onChange: (v: string) => void; unit: string; hint: string; invalid: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className={`flex items-center rounded-md border bg-background focus-within:border-accent/60 ${invalid ? 'border-accent/50' : 'border-border'}`}>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-sm text-slate-100 tabular-nums outline-none"
        />
        <span className="pr-2 text-[11px] text-slate-500">{unit}</span>
      </div>
      <span className={`text-[10px] ${invalid ? 'text-accent' : 'text-slate-600'}`}>{hint}</span>
    </label>
  );
}

function RiskInputs() {
  const ui = usePrototype();
  // parseRisk falls back to the default when an input is empty or out of range (§7).
  const capitalInvalid = ui.risk.capital !== Number(ui.capitalInput) || ui.capitalInput.trim() === '';
  const riskInvalid = ui.risk.riskPercent !== Number(ui.riskInput) || ui.riskInput.trim() === '';
  return (
    <section>
      <SectionTitle>Position size</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <RiskInput
          label="Capital (USDT)"
          value={ui.capitalInput}
          onChange={ui.setCapitalInput}
          unit="USDT"
          invalid={capitalInvalid}
          hint={capitalInvalid ? `Invalid: using ${RISK_DEFAULTS.capital}` : `> ${RISK_LIMITS.minCapital}`}
        />
        <RiskInput
          label="Risk per trade (%)"
          value={ui.riskInput}
          onChange={ui.setRiskInput}
          unit="%"
          invalid={riskInvalid}
          hint={riskInvalid ? `Invalid: using ${RISK_DEFAULTS.riskPercent}` : `${RISK_LIMITS.minRiskPercent} – ${RISK_LIMITS.maxRiskPercent}`}
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">The stop loss stays at the setup's level; risk changes only the position size.</p>
    </section>
  );
}

// ---------------------------------------------------------------- rules and Fibonacci

const RULE_NAMES: Record<RuleCheck['rule'], string> = {
  rule1: 'Rule 1 · Wave 2 does not retrace past the start of Wave 1',
  rule2: 'Rule 2 · Wave 3 is not the shortest',
  rule3: 'Rule 3 · Wave 4 does not overlap Wave 1',
};

function RuleRow({ rule }: { rule: RuleCheck }) {
  const look = {
    valid: { icon: <Check size={12} strokeWidth={3} />, chip: 'bg-bullish/15 text-bullish', text: 'VALID' },
    violated: { icon: <X size={12} strokeWidth={3} />, chip: 'bg-bearish/15 text-bearish', text: 'VIOLATED' },
    not_yet: { icon: <CircleDashed size={12} />, chip: 'bg-slate-500/15 text-slate-400', text: 'NOT YET' },
  }[rule.status];
  return (
    <li className="flex gap-2.5 py-2">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${look.chip}`}>{look.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-slate-200">{RULE_NAMES[rule.rule]}</span>
          <span className={`shrink-0 rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider ${look.chip}`}>{look.text}</span>
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">{rule.detail}</div>
      </div>
    </li>
  );
}

const RATIO_ROWS: Array<{ key: keyof FibRatios; wave: string; kind: 'retracement' | 'extension' }> = [
  { key: 'w2Retracement', wave: 'Wave 2', kind: 'retracement' },
  { key: 'w3Extension', wave: 'Wave 3', kind: 'extension' },
  { key: 'w4Retracement', wave: 'Wave 4', kind: 'retracement' },
  { key: 'w5Extension', wave: 'Wave 5', kind: 'extension' },
  { key: 'aRetracement', wave: 'Wave A', kind: 'retracement' },
  { key: 'bRetracement', wave: 'Wave B', kind: 'retracement' },
];

function FibonacciBox({ scenario }: { scenario: Scenario }) {
  const rows = RATIO_ROWS.filter((r) => scenario.count.ratios[r.key] !== undefined);
  return (
    <section>
      <SectionTitle>Fibonacci</SectionTitle>
      <div className="rounded-md border border-border bg-surface">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r) => {
              const v = scenario.count.ratios[r.key]!;
              return (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5 text-slate-300">{r.wave}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold text-slate-100 tabular-nums">
                    {r.kind === 'extension' ? `${v.toFixed(2)}×` : v.toFixed(3)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{r.kind}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-[10px] text-slate-600 tabular-nums">
                    {FIB_TARGETS[r.key].join(' / ')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-border px-3 py-2 text-xs leading-relaxed text-slate-300">{scenario.thesis}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- panel

function NeutralState({ tfLabel }: { tfLabel: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center">
      <DirectionBadge direction={null} />
      <p className="mt-3 text-sm text-slate-200">{tfLabel} is a Neutral timeframe</p>
      <p className="mt-1 text-xs text-slate-500">No valid count: no scenario, no signal and no confluence vote.</p>
    </div>
  );
}

export function SignalPanel() {
  const ui = usePrototype();
  const v = useTimeframeView(ui.timeframe);
  const tfLabel = TIMEFRAMES.find((t) => t.id === ui.timeframe)!.label;
  const neutral = v.mock.analysis.primary === null;
  const s = v.scenario;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
          Signal · <span className="text-accent">{tfLabel}</span>
        </h2>
        {s && <DirectionBadge direction={s.direction} size="xs" />}
      </div>

      {neutral ? (
        <NeutralState tfLabel={tfLabel} />
      ) : (
        <>
          <ScenarioTabs />
          {!s ? (
            <div className="rounded-md border border-dashed border-border bg-surface px-4 py-5 text-center text-sm text-slate-400">
              Alternative Scenario unavailable on {tfLabel}: only one valid count.
            </div>
          ) : (
            <>
              <div className="-mt-2 text-xs text-slate-400">
                Last point <span className="font-mono text-slate-200">({s.count.lastLabel})</span> · {s.waveInProgress}
              </div>
              <section className="flex flex-col gap-2">
                {v.signalsPaused ? (
                  <SignalsPaused />
                ) : v.signal && v.size ? (
                  <SignalCard signal={v.signal} scenario={s} size={v.size} risk={ui.risk} />
                ) : (
                  <div className="flex items-center gap-2.5 rounded-md border border-dashed border-border bg-surface px-3 py-3 text-sm text-slate-300">
                    <Hourglass size={15} className="shrink-0 text-slate-500" />
                    No setup: waiting for {NEXT_WAVE[s.count.lastLabel] ?? 'the next wave'}
                  </div>
                )}
                <InvalidationBox scenario={s} />
              </section>
            </>
          )}
        </>
      )}

      <RiskInputs />

      {s && (
        <>
          <section>
            <SectionTitle>Rules checklist</SectionTitle>
            <ul className="divide-y divide-border/60 rounded-md border border-border bg-surface px-3">
              {s.count.rules.map((r) => (
                <RuleRow key={r.rule} rule={r} />
              ))}
            </ul>
          </section>
          <FibonacciBox scenario={s} />
        </>
      )}

      <footer className="border-t border-border pt-3 text-[11px] text-slate-500">Not financial advice.</footer>
    </div>
  );
}
