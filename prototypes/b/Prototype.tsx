// PROTOTYPE ONLY. B "Signal-first": the decision (Signal + Confluence) on top, chart below,
// detail in disclosures. Default open: Fibonacci & thesis. Collapsed: Risk settings, Rules.
import { Bitcoin, ChartCandlestick, ListChecks, Ruler, SlidersHorizontal, WifiOff } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FIB_TARGETS, RISK_DEFAULTS, RISK_LIMITS, TIMEFRAMES } from '../../src/config.ts';
import type { FibRatios, RuleCheck } from '../../src/types.ts';
import { OFFLINE_SINCE, fmt, tickerAt } from '../shared/mock.ts';
import { PrototypeShell, usePrototype } from '../shared/PrototypeShell.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { WaveChart } from '../shared/WaveChart.tsx';
import { ConfluencePanel } from './ConfluencePanel.tsx';
import { SignalPanel } from './SignalPanel.tsx';
import { Disclosure } from './ui.tsx';

export function Prototype() {
  return (
    <PrototypeShell id="b">
      <Page />
    </PrototypeShell>
  );
}

type Section = 'risk' | 'rules' | 'fib';

function Page() {
  const [open, setOpen] = useState<Record<Section, boolean>>({ risk: false, rules: false, fib: true });
  const toggle = (s: Section) => setOpen((o) => ({ ...o, [s]: !o[s] }));
  const adjustRisk = () => {
    setOpen((o) => ({ ...o, risk: true }));
    requestAnimationFrame(() => {
      document.getElementById('risk')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('capital-input')?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <Header />
      <main className="mx-auto max-w-[1440px] space-y-4 px-4 pt-4 pb-28">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <SignalPanel onAdjustRisk={adjustRisk} />
          <ConfluencePanel />
        </div>
        <ChartSection />
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <RiskSection open={open.risk} onToggle={() => toggle('risk')} />
          <RulesSection open={open.rules} onToggle={() => toggle('rules')} />
          <FibSection open={open.fib} onToggle={() => toggle('fib')} />
        </div>
        <footer className="pt-2 text-center text-xs text-slate-500">
          Not financial advice. Read-only dashboard: it never places orders.
        </footer>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- header (§9.2)

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

function Header() {
  const ui = usePrototype();
  const tk = tickerAt(ui.price);
  const flash = usePriceFlash(tk.price);
  const up = tk.change24h >= 0;
  return (
    <header className="z-30 border-b border-border bg-background lg:sticky lg:top-0">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bitcoin size={22} className="text-accent" />
          <span className="font-semibold text-slate-100">BTC/USDT</span>
          <span className="rounded border border-border px-1.5 py-px text-[10px] font-medium text-slate-400">Binance Spot</span>
        </div>
        <div className="flex items-baseline gap-2.5">
          <span
            className={`rounded px-1 text-xl font-semibold tabular-nums transition-colors duration-700 ${
              flash === 'up' ? 'bg-bullish/20 text-bullish' : flash === 'down' ? 'bg-bearish/20 text-bearish' : 'text-slate-50'
            }`}
          >
            {fmt.price(tk.price)}
          </span>
          <span className={`text-xs tabular-nums ${up ? 'text-bullish' : 'text-bearish'}`}>
            {up ? '+' : ''}
            {fmt.usdt(tk.change24h)} ({fmt.pct(tk.changePercent24h)})
          </span>
        </div>
        <dl className="flex gap-3 text-[11px] tabular-nums">
          <div className="flex gap-1">
            <dt className="text-slate-500">24h H</dt>
            <dd className="text-slate-300">{fmt.price(tk.high24h)}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-slate-500">24h L</dt>
            <dd className="text-slate-300">{fmt.price(tk.low24h)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div className="flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Timeframe">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                onClick={() => ui.setTimeframe(t.id)}
                aria-pressed={ui.timeframe === t.id}
                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                  ui.timeframe === t.id ? 'bg-accent text-black' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Toggle label="Projections" on={ui.showProjections} set={ui.setShowProjections} />
          <Toggle label="Trade 1x" on={ui.showTrade} set={ui.setShowTrade} />
          <ConnectionBadge offline={ui.mode === 'offline'} />
        </div>
      </div>
    </header>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-slate-300 hover:border-slate-500"
    >
      <span className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-slate-600'}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${on ? 'left-3' : 'left-0.5'}`} />
      </span>
      {label}
    </button>
  );
}

function ConnectionBadge({ offline }: { offline: boolean }) {
  if (offline) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-bearish/50 bg-bearish/10 px-2 py-1 text-[11px] font-semibold text-bearish">
        <WifiOff size={13} /> OFFLINE · last update {OFFLINE_SINCE}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-bullish/40 bg-bullish/10 px-2 py-1 text-[11px] font-bold tracking-wider text-bullish">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-bullish" />
      </span>
      LIVE
    </span>
  );
}

// ---------------------------------------------------------------- chart (§9.4)

function ChartSection() {
  const ui = usePrototype();
  const { mock, scenario, signal, signalsPaused } = useTimeframeView(ui.timeframe);
  const label = TIMEFRAMES.find((t) => t.id === ui.timeframe)!.label;
  const shownSignal = signalsPaused ? null : signal;
  const linesNote = !scenario
    ? null
    : signalsPaused
      ? 'Price lines hidden: signals paused'
      : !signal
        ? 'Price lines hidden: no setup'
        : !ui.showTrade
          ? 'Price lines hidden: Trade 1x off'
          : null;
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <ChartCandlestick size={15} className="text-slate-500" />
          <span className="font-semibold text-slate-200">Elliott chart</span>
          <span className="text-slate-500">
            {label} · {scenario ? (scenario.rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario') : 'Neutral, no count'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 sm:ml-auto">
          {scenario && <Legend swatch={<span className="h-0.5 w-4 bg-wave-confirmed" />}>Confirmed wave</Legend>}
          {scenario && ui.showProjections && (
            <Legend swatch={<span className="w-4 border-t-2 border-dashed border-wave-projected" />}>Projection</Legend>
          )}
          {shownSignal && ui.showTrade && (
            <>
              <Legend swatch={<span className="h-0.5 w-4 bg-blue-500" />}>Entry</Legend>
              <Legend swatch={<span className="w-4 border-t border-dashed border-bearish" />}>Stop Loss</Legend>
              <Legend swatch={<span className="w-4 border-t border-dashed border-bullish" />}>TP1 / TP2</Legend>
            </>
          )}
          {linesNote && <span className="text-slate-500 italic">{linesNote}</span>}
        </div>
      </div>
      <WaveChart
        className="h-[45vh] min-h-[280px]"
        candles={mock.candles}
        scenario={scenario}
        signal={shownSignal}
        showProjections={ui.showProjections}
        showTrade={ui.showTrade}
      />
    </section>
  );
}

function Legend({ swatch, children }: { swatch: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {swatch}
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- disclosures

function RiskSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ui = usePrototype();
  const capitalDefaulted = ui.risk.capital !== Number(ui.capitalInput) || ui.capitalInput.trim() === '';
  const riskDefaulted = ui.risk.riskPercent !== Number(ui.riskInput) || ui.riskInput.trim() === '';
  return (
    <Disclosure
      id="risk"
      icon={<SlidersHorizontal size={15} />}
      title="Risk settings"
      summary={
        <span className="tabular-nums">
          {fmt.usdt(ui.risk.capital)} USDT · {ui.risk.riskPercent}%
        </span>
      }
      open={open}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          id="capital-input"
          label="Capital (USDT)"
          value={ui.capitalInput}
          onChange={ui.setCapitalInput}
          hint={capitalDefaulted ? `Invalid: using default ${RISK_DEFAULTS.capital}` : `> ${RISK_LIMITS.minCapital}`}
          warn={capitalDefaulted}
        />
        <Field
          id="risk-input"
          label="Risk per trade (%)"
          value={ui.riskInput}
          onChange={ui.setRiskInput}
          hint={riskDefaulted ? `Invalid: using default ${RISK_DEFAULTS.riskPercent}` : `${RISK_LIMITS.minRiskPercent} – ${RISK_LIMITS.maxRiskPercent}`}
          warn={riskDefaulted}
        />
      </div>
      <p className="mt-2.5 text-[11px] text-slate-500">
        Shared by every timeframe and scenario. Changes the Position size, never the Stop Loss. 1x: the position never exceeds capital.
      </p>
    </Disclosure>
  );
}

function Field(props: { id: string; label: string; value: string; onChange: (v: string) => void; hint: string; warn: boolean }) {
  return (
    <label htmlFor={props.id} className="block">
      <span className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{props.label}</span>
      <input
        id={props.id}
        inputMode="decimal"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`mt-1 w-full rounded-md border bg-surface-2 px-2.5 py-1.5 text-sm text-slate-100 tabular-nums outline-none focus:border-accent ${
          props.warn ? 'border-accent/60' : 'border-border'
        }`}
      />
      <span className={`mt-1 block text-[11px] ${props.warn ? 'text-accent' : 'text-slate-500'}`}>{props.hint}</span>
    </label>
  );
}

const RULE_TEXT: Record<RuleCheck['rule'], string> = {
  rule1: 'Wave 2 never retraces past the start of Wave 1',
  rule2: 'Wave 3 is never the shortest of 1, 3 and 5',
  rule3: 'Wave 4 never overlaps Wave 1',
};

const RULE_STATUS: Record<RuleCheck['status'], { text: string; cls: string }> = {
  valid: { text: 'VALID', cls: 'text-bullish ring-bullish/40 bg-bullish/10' },
  violated: { text: 'VIOLATED', cls: 'text-bearish ring-bearish/40 bg-bearish/10' },
  not_yet: { text: 'NOT YET', cls: 'text-slate-400 ring-slate-600' },
};

function RulesSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ui = usePrototype();
  const { scenario } = useTimeframeView(ui.timeframe);
  const rules = scenario?.count.rules ?? [];
  const count = (s: RuleCheck['status']) => rules.filter((r) => r.status === s).length;
  const summary = scenario
    ? [`${count('valid')} valid`, count('violated') && `${count('violated')} violated`, count('not_yet') && `${count('not_yet')} not yet`]
        .filter(Boolean)
        .join(' · ')
    : 'No count';
  return (
    <Disclosure id="rules" icon={<ListChecks size={15} />} title="Rules checklist" summary={summary} open={open} onToggle={onToggle}>
      {scenario ? (
        <ul className="space-y-2.5">
          {rules.map((r) => (
            <li key={r.rule} className="flex items-start gap-3">
              <span className={`mt-0.5 w-[4.6rem] shrink-0 rounded-full py-px text-center text-[10px] font-bold tracking-wider ring-1 ${RULE_STATUS[r.status].cls}`}>
                {RULE_STATUS[r.status].text}
              </span>
              <div className="min-w-0">
                <div className="text-sm text-slate-200">
                  <span className="font-semibold">Rule {r.rule.slice(-1)}</span> · {RULE_TEXT[r.rule]}
                </div>
                <div className="font-mono text-[11px] break-words text-slate-500">{r.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Neutral: no valid count to check.</p>
      )}
    </Disclosure>
  );
}

const FIB_ROWS: Array<{ key: keyof FibRatios; wave: string; kind: 'retracement' | 'extension' }> = [
  { key: 'w2Retracement', wave: 'Wave 2', kind: 'retracement' },
  { key: 'w3Extension', wave: 'Wave 3', kind: 'extension' },
  { key: 'w4Retracement', wave: 'Wave 4', kind: 'retracement' },
  { key: 'w5Extension', wave: 'Wave 5', kind: 'extension' },
  { key: 'aRetracement', wave: 'Wave A', kind: 'retracement' },
  { key: 'bRetracement', wave: 'Wave B', kind: 'retracement' },
];

function FibSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ui = usePrototype();
  const { scenario } = useTimeframeView(ui.timeframe);
  const rows = scenario ? FIB_ROWS.filter((r) => scenario.count.ratios[r.key] !== undefined) : [];
  return (
    <Disclosure
      id="fib"
      icon={<Ruler size={15} />}
      title="Fibonacci & thesis"
      summary={scenario ? `${rows.length} ${rows.length === 1 ? 'ratio' : 'ratios'} · score ${(scenario.count.score * 100).toFixed(0)}` : 'No count'}
      open={open}
      onToggle={onToggle}
    >
      {scenario ? (
        <>
          <ul className="divide-y divide-border/60">
            {rows.map((r) => {
              const v = scenario.count.ratios[r.key]!;
              return (
                <li key={r.key} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                  <span className="text-slate-300">
                    {r.wave}: <span className="font-semibold text-slate-100 tabular-nums">{r.kind === 'extension' ? `${v.toFixed(2)}×` : v.toFixed(3)}</span>{' '}
                    {r.kind}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">target {FIB_TARGETS[r.key].join(' / ')}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5 text-sm leading-relaxed text-slate-300">{scenario.thesis}</p>
        </>
      ) : (
        <p className="text-sm text-slate-500">Neutral: no ratios and no thesis.</p>
      )}
    </Disclosure>
  );
}
