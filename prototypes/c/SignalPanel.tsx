// PROTOTYPE ONLY. C · Signal panel (§9.5), rendered inside the focus-mode drawer.
import { Check, CircleCheck, CircleDashed, CirclePause, CircleX, Copy, ShieldAlert, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { FibRatios, RuleCheck, Timeframe } from '../../src/types.ts';
import { NEXT_WAVE, OFFLINE_SINCE, SETUP_NAMES, TIMEFRAME_MOCKS, copySetupText, fmt } from '../shared/mock.ts';
import { usePrototype } from '../shared/PrototypeShell.tsx';
import type { TimeframeView } from '../shared/view.ts';
import { DirectionBadge, StatusPill, tfLabel } from './parts.tsx';

const RULE_NAMES: Record<RuleCheck['rule'], string> = {
  rule1: 'Rule 1 · Wave 2 does not retrace past the start of Wave 1',
  rule2: 'Rule 2 · Wave 3 is not the shortest',
  rule3: 'Rule 3 · Wave 4 does not overlap Wave 1',
};

const RATIO_LABELS: Record<keyof FibRatios, (x: number) => string> = {
  w2Retracement: (x) => `Wave 2: ${x.toFixed(3)} retracement`,
  w3Extension: (x) => `Wave 3: ${x.toFixed(2)}× extension`,
  w4Retracement: (x) => `Wave 4: ${x.toFixed(3)} retracement`,
  w5Extension: (x) => `Wave 5: ${x.toFixed(2)}× extension`,
  aRetracement: (x) => `Wave A: ${x.toFixed(3)} retracement`,
  bRetracement: (x) => `Wave B: ${x.toFixed(3)} retracement`,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border px-4 py-3">
      <h3 className="mb-2 text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Metric({ label, value, sub, tone = 'text-slate-100' }: { label: string; value: string; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-md bg-surface-2/70 px-2.5 py-2">
      <div className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] tabular-nums text-slate-400">{sub}</div>}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked in embedded previews; the feedback still shows for the prototype.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
        copied ? 'bg-bullish/20 text-bullish' : 'bg-accent text-black hover:brightness-110'
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy Setup'}
    </button>
  );
}

function SignalCard({ tf, v }: { tf: Timeframe; v: TimeframeView }) {
  const ui = usePrototype();
  const sc = v.scenario!;
  if (v.signalsPaused) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-slate-600/50 bg-white/[0.03] p-3 text-sm text-slate-300">
        <CirclePause size={16} className="mt-0.5 shrink-0 text-slate-400" />
        <span>
          Signals paused: data stale since {OFFLINE_SINCE}
          <span className="mt-1 block text-xs text-slate-500">Levels and status return when the stream is back and backfill completes.</span>
        </span>
      </div>
    );
  }
  if (!v.signal || !v.size) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-slate-300">
        <span className="mr-2 rounded bg-white/5 px-1.5 py-px text-[10px] font-bold tracking-wider text-slate-400">NO SETUP</span>
        No setup: waiting for {NEXT_WAVE[sc.count.lastLabel]}
      </div>
    );
  }
  const s = v.signal;
  const size = v.size;
  const e = s.entry;
  const long = s.side === 'LONG';
  return (
    <div className={`rounded-lg border p-3 ${s.status === 'INVALIDATED' ? 'border-bearish/40' : 'border-border'} bg-surface-2/40`}>
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${long ? 'bg-bullish text-black' : 'bg-bearish text-white'}`}>{s.side} 1x</span>
        <StatusPill status={s.status} />
        <span className="ml-auto">
          <CopyButton text={copySetupText(tf, s, sc, size, ui.risk)} />
        </span>
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-100">{SETUP_NAMES[s.setup]}</div>
      <div className="text-[11px] text-slate-500">1x, no leverage</div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Metric label="Entry" value={fmt.price(e)} sub="live price" tone="text-sky-300" />
        <Metric label="Stop Loss" value={fmt.price(s.stopLoss)} sub={fmt.delta(s.stopLoss, e)} tone="text-bearish" />
        <Metric label="TP1" value={fmt.price(s.takeProfit1)} sub={<>{fmt.delta(s.takeProfit1, e)} · R:R {fmt.rr(s.rr1)}</>} tone="text-bullish" />
        <Metric label="TP2" value={fmt.price(s.takeProfit2)} sub={<>{fmt.delta(s.takeProfit2, e)} · R:R {fmt.rr(s.rr2)}</>} tone="text-emerald-600" />
        <Metric label="Position" value={`${fmt.usdt(size.positionUsd)} USDT`} sub={`${fmt.btc(size.positionBtc)} BTC`} />
        <Metric
          label="Risk"
          value={`${fmt.usdt(size.actualRiskUsd)} USDT`}
          sub={
            <>
              {size.actualRiskPercent.toFixed(2)}% of capital
              {size.capped && <span className="block text-accent">(capped by capital)</span>}
            </>
          }
        />
      </div>

      <div className="mt-3 flex gap-2 rounded-md border border-bearish/40 bg-bearish/10 p-2.5 text-xs text-red-200">
        <ShieldAlert size={15} className="mt-px shrink-0 text-bearish" />
        <span>
          <span className="font-semibold text-bearish">Invalidation: </span>
          {sc.invalidationReason} at <span className="font-mono tabular-nums">{fmt.price(sc.invalidationPrice)}</span>
        </span>
      </div>
    </div>
  );
}

function RiskInputs() {
  const ui = usePrototype();
  const input =
    'w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-sm tabular-nums text-slate-100 outline-none focus:border-accent';
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="text-[11px] text-slate-400">
        Capital (USDT)
        <input inputMode="decimal" value={ui.capitalInput} onChange={(e) => ui.setCapitalInput(e.target.value)} className={`mt-1 ${input}`} />
      </label>
      <label className="text-[11px] text-slate-400">
        Risk per trade (%)
        <input inputMode="decimal" value={ui.riskInput} onChange={(e) => ui.setRiskInput(e.target.value)} className={`mt-1 ${input}`} />
      </label>
      <p className="col-span-2 text-[11px] text-slate-500">
        Using {fmt.usdt(ui.risk.capital)} USDT at {ui.risk.riskPercent}%. The stop loss stays at the setup's level; only the
        Position size changes.
      </p>
    </div>
  );
}

const RULE_STYLE = {
  valid: { icon: CircleCheck, text: 'VALID', cls: 'text-bullish' },
  violated: { icon: CircleX, text: 'VIOLATED', cls: 'text-bearish' },
  not_yet: { icon: CircleDashed, text: 'NOT YET', cls: 'text-slate-500' },
} as const;

export function SignalPanel({ tf, v, onClose }: { tf: Timeframe; v: TimeframeView; onClose: () => void }) {
  const ui = usePrototype();
  const a = TIMEFRAME_MOCKS[tf].analysis;
  const neutral = a.primary === null;
  const sc = v.scenario;

  const tab = (rank: 'primary' | 'alternative', label: string, conf: number | null) => (
    <button
      key={rank}
      disabled={neutral}
      onClick={() => ui.setRank(rank)}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        ui.rank === rank && !neutral ? 'bg-surface-2 text-slate-100 shadow ring-1 ring-border' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <span className="block">{label}</span>
      <span className="block text-[11px] font-normal tabular-nums text-slate-400">{neutral ? '—' : conf === null ? 'unavailable' : `${conf.toFixed(0)}%`}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Signal panel</div>
          <div className="text-lg font-bold text-slate-100">
            BTC/USDT <span className="text-accent">{tfLabel(tf)}</span>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close signal panel" className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="flex gap-1 rounded-lg bg-background p-1">
          {tab('primary', 'Primary Scenario', a.primary?.confidence ?? null)}
          {tab('alternative', 'Alternative Scenario', a.alternative?.confidence ?? null)}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {neutral ? (
          <Section title="Neutral">
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-slate-300">
              <DirectionBadge direction={null} size="md" />
              <p className="mt-2">No valid wave count on {tfLabel(tf)}. No scenario, no signal, and no confluence vote.</p>
            </div>
          </Section>
        ) : !sc ? (
          <Section title="Alternative Scenario">
            <p className="text-sm text-slate-400">Alternative Scenario unavailable: only one valid count on {tfLabel(tf)}.</p>
          </Section>
        ) : (
          <>
            <Section title={sc.rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario'}>
              <div className="mb-3 flex items-center gap-2">
                <DirectionBadge direction={sc.direction} size="md" />
                <span className="text-sm text-slate-300">{sc.waveInProgress}</span>
              </div>
              <SignalCard tf={tf} v={v} />
            </Section>

            <Section title="Position sizing">
              <RiskInputs />
            </Section>

            <Section title="Rules">
              <ul className="space-y-2">
                {sc.count.rules.map((r) => {
                  const st = RULE_STYLE[r.status];
                  const Icon = st.icon;
                  return (
                    <li key={r.rule} className="flex gap-2">
                      <Icon size={15} className={`mt-0.5 shrink-0 ${st.cls}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-slate-200">{RULE_NAMES[r.rule]}</span>
                          <span className={`ml-auto shrink-0 text-[10px] font-bold tracking-wider ${st.cls}`}>{st.text}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{r.detail}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Fibonacci">
              <ul className="space-y-1 font-mono text-xs tabular-nums text-slate-300">
                {(Object.keys(sc.count.ratios) as (keyof FibRatios)[]).map((k) => (
                  <li key={k}>{RATIO_LABELS[k](sc.count.ratios[k]!)}</li>
                ))}
              </ul>
              <p className="mt-2 rounded-md bg-surface-2/60 p-2.5 text-xs leading-relaxed text-slate-300">{sc.thesis}</p>
            </Section>
          </>
        )}
        {neutral && (
          <Section title="Position sizing">
            <RiskInputs />
          </Section>
        )}
        <p className="border-t border-border px-4 py-3 text-[11px] text-slate-500">Not financial advice.</p>
      </div>
    </div>
  );
}
