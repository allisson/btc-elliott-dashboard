// PROTOTYPE A · "Terminal": spec §9 taken literally. Header, Confluence strip, chart left, Signal panel right.
import { TIMEFRAMES } from '../../src/config.ts';
import { PrototypeShell, usePrototype } from '../shared/PrototypeShell.tsx';
import { WaveChart } from '../shared/WaveChart.tsx';
import { useTimeframeView } from '../shared/view.ts';
import { ConfluenceStrip } from './ConfluenceStrip.tsx';
import { Header } from './Header.tsx';
import { SignalPanel } from './SignalPanel.tsx';
import { SignalsPaused } from './ui.tsx';

function Legend({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-4 border-t-2 ${dashed ? 'border-dashed' : ''}`} style={{ borderColor: color }} />
      {label}
    </span>
  );
}

function ChartPane() {
  const ui = usePrototype();
  const v = useTimeframeView(ui.timeframe);
  const tfLabel = TIMEFRAMES.find((t) => t.id === ui.timeframe)!.label;
  const neutral = v.mock.analysis.primary === null;
  const rankName = ui.rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario';
  const chartSignal = v.signalsPaused ? null : v.signal;

  return (
    <section className="flex h-[420px] min-h-0 min-w-0 flex-col lg:h-auto lg:flex-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-4 py-1.5 text-[11px] text-slate-400">
        <span className="font-mono font-semibold text-slate-200">BTC/USDT · {tfLabel}</span>
        <span>
          {neutral ? 'Neutral' : v.scenario ? `${rankName} · ${v.scenario.waveInProgress}` : `${rankName} unavailable`}
        </span>
        <div className="ml-auto flex items-center gap-3 text-slate-500">
          <Legend color="var(--color-wave-confirmed)" label="Confirmed wave" />
          {ui.showProjections && <Legend color="var(--color-wave-projected)" dashed label="Projected" />}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <WaveChart
          className="absolute inset-0"
          candles={v.mock.candles}
          scenario={v.scenario}
          signal={chartSignal}
          showProjections={ui.showProjections}
          showTrade={ui.showTrade}
        />
        {v.signalsPaused && (
          <div className="pointer-events-none absolute top-3 left-3 z-10">
            <SignalsPaused />
          </div>
        )}
        {neutral && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 rounded-md border border-border bg-surface/90 px-3 py-2 text-xs text-slate-300">
            {tfLabel} is Neutral: no valid count to draw.
          </div>
        )}
      </div>
    </section>
  );
}

function Terminal() {
  return (
    <div className="h-full overflow-y-auto lg:flex lg:flex-col lg:overflow-hidden">
      <Header />
      <ConfluenceStrip />
      <main className="flex min-h-0 flex-col lg:flex-1 lg:flex-row">
        <ChartPane />
        <aside className="border-t border-border bg-background pb-20 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l lg:pb-16 xl:w-[400px]">
          <SignalPanel />
        </aside>
      </main>
    </div>
  );
}

export function Prototype() {
  return (
    <PrototypeShell id="a">
      <Terminal />
    </PrototypeShell>
  );
}
