// Signal panel (spec §9.5). Presentational: the selected scenario and the risk inputs live in Dashboard.
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { COPY_FEEDBACK_MS } from '../config.ts';
import { positionSize } from '../lib/engine/risk.ts';
import { copySetupText, formatPrice, pausedNotice, SETUP_NAMES } from '../lib/format.ts';
import { fibLines, metricGrid, ruleRows, scenarioTab, type Rank, type RiskInputs, type ScenarioView } from '../lib/panels.ts';
import type { RiskSettings, Scenario, Signal } from '../types.ts';
import { DirectionBadge } from './ConfluenceStrip.tsx';

interface SignalPanelProps {
  timeframeLabel: string;
  primary: Scenario | null;
  alternative: Scenario | null;
  rank: Rank;
  onRank: (r: Rank) => void;
  view: ScenarioView;
  pausedSince: number | null;
  riskInputs: RiskInputs;
  onRiskInputs: (r: RiskInputs) => void;
  risk: { settings: RiskSettings; capitalInvalid: boolean; riskInvalid: boolean };
  className?: string;
}

const STATUS_COLORS: Record<Signal['status'], string> = {
  ACTIVE: 'bg-bullish/15 text-bullish',
  WATCHING: 'bg-accent/15 text-accent',
  INVALIDATED: 'bg-bearish/15 text-bearish',
};
const RULE_COLORS: Record<string, string> = { VALID: 'text-bullish', VIOLATED: 'text-bearish', 'NOT YET': 'text-slate-500' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border bg-surface-2/40 p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function InvalidationBox({ scenario }: { scenario: Scenario }) {
  return (
    <p className="rounded border border-bearish/40 bg-bearish/10 px-2 py-1.5 text-xs text-bearish">
      Invalidation: {scenario.invalidationReason} at {formatPrice(scenario.invalidationPrice)}
    </p>
  );
}

// `build` runs at click time, so Generated is the time of the click (§9.5); null disables the button.
function CopyButton({ build }: { build: (() => string | null) | null }) {
  const [feedback, setFeedback] = useState<'Copied' | 'Copy failed' | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), COPY_FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [feedback]);

  const copy = async () => {
    const text = build?.();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback('Copied');
    } catch {
      setFeedback('Copy failed');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={build === null}
      className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-xs hover:border-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border"
    >
      {feedback === 'Copied' ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {feedback ?? 'Copy Setup'}
    </button>
  );
}

function SignalCard({ scenario, signal, risk }: { scenario: Scenario; signal: Signal; risk: RiskSettings }) {
  const position = positionSize(risk, signal.entry, signal.stopLoss);
  const build = () => copySetupText({ signal, scenario, position, capital: risk.capital, generatedAt: Date.now() });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${signal.side === 'LONG' ? 'bg-bullish text-background' : 'bg-bearish text-background'}`}
        >
          {signal.side} 1x
        </span>
        <span className="text-sm font-medium">{SETUP_NAMES[signal.setup]}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[signal.status]}`}>{signal.status}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">1x, no leverage</span>
        <CopyButton build={signal.status === 'INVALIDATED' ? null : build} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {metricGrid(signal, position).map((m) => (
          <div key={m.label} className="flex flex-col">
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">{m.label}</dt>
            <dd className="font-mono text-sm tabular-nums">{m.value}</dd>
            {m.detail && <dd className="font-mono text-xs tabular-nums text-slate-400">{m.detail}</dd>}
          </div>
        ))}
      </dl>
      <InvalidationBox scenario={scenario} />
    </div>
  );
}

function RiskField({ label, value, onChange, invalid, fallback }: { label: string; value: string; onChange: (v: string) => void; invalid: boolean; fallback: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded border bg-background px-2 py-1 font-mono text-sm tabular-nums outline-none focus:border-accent ${invalid ? 'border-bearish' : 'border-border'}`}
      />
      {invalid && <span className="text-bearish">invalid, using default {fallback}</span>}
    </label>
  );
}

export function SignalPanel(props: SignalPanelProps) {
  const { timeframeLabel, primary, alternative, rank, onRank, view, pausedSince, riskInputs, onRiskInputs, risk, className = '' } = props;
  const { scenario, signal, rules, noSetup } = view;

  return (
    <aside className={`flex flex-col gap-3 rounded-md border border-border bg-surface p-3 ${className}`}>
      <div className="grid grid-cols-2 gap-1" role="tablist">
        {(['primary', 'alternative'] as const).map((r) => {
          const tab = scenarioTab(r === 'primary' ? primary : alternative, r);
          return (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={r === rank && !tab.disabled}
              disabled={tab.disabled}
              onClick={() => onRank(r)}
              className={`rounded px-2 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:text-slate-600 ${r === rank && !tab.disabled ? 'bg-accent text-background' : 'bg-surface-2 text-slate-300'}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <Section title="Signal">
        {pausedSince !== null ? (
          <p className="text-sm text-slate-400">{pausedNotice(pausedSince)}</p>
        ) : !scenario ? (
          <p className="text-sm text-slate-400">{timeframeLabel} is Neutral: no valid count</p>
        ) : signal ? (
          <SignalCard scenario={scenario} signal={signal} risk={risk.settings} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <DirectionBadge direction={scenario.direction} />
              <p className="text-sm text-slate-300">{noSetup}</p>
            </div>
            <InvalidationBox scenario={scenario} />
          </div>
        )}
      </Section>

      <Section title="Risk">
        <div className="grid grid-cols-2 gap-2">
          <RiskField
            label="Capital (USDT)"
            value={riskInputs.capital}
            onChange={(capital) => onRiskInputs({ ...riskInputs, capital })}
            invalid={risk.capitalInvalid}
            fallback={risk.settings.capital}
          />
          <RiskField
            label="Risk per trade (%)"
            value={riskInputs.riskPercent}
            onChange={(riskPercent) => onRiskInputs({ ...riskInputs, riskPercent })}
            invalid={risk.riskInvalid}
            fallback={risk.settings.riskPercent}
          />
        </div>
      </Section>

      {scenario && (
        <>
          <Section title="Rules">
            <ul className="flex flex-col gap-2">
              {ruleRows(rules).map((r) => (
                <li key={r.name} className="flex flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-slate-300">{r.name}</span>
                    <span className={`shrink-0 font-semibold ${RULE_COLORS[r.status]}`}>{r.status}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">{r.detail}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Fibonacci">
            <ul className="flex flex-col gap-1 font-mono text-xs text-slate-300">
              {fibLines(scenario.count.ratios).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-400">{scenario.thesis}</p>
          </Section>
        </>
      )}

      <p className="text-center text-[11px] text-slate-500">Not financial advice.</p>
    </aside>
  );
}
