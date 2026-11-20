// Dev-only page (roadmap Phase 7): the recorded Binance snapshots (spec §11) through the engine and
// into ElliottChart. Served by `bun dev` at /dev/chart.html, never built, never imported by App.tsx
// (ADR 0002). Deleted in Phase 9.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { ElliottChart } from '../src/components/ElliottChart.tsx';
import { TIMEFRAMES } from '../src/config.ts';
import { parseKlines } from '../src/lib/binance/rest.ts';
import { analyseTimeframe } from '../src/lib/engine/analysis.ts';
import { evaluateSignal } from '../src/lib/engine/setups.ts';
import klines1d from '../src/lib/engine/__fixtures__/binance/klines-1d.json';
import klines1h from '../src/lib/engine/__fixtures__/binance/klines-1h.json';
import klines1w from '../src/lib/engine/__fixtures__/binance/klines-1w.json';
import klines4h from '../src/lib/engine/__fixtures__/binance/klines-4h.json';
import type { Timeframe } from '../src/types.ts';

const RAW: Record<Timeframe, unknown> = { '1h': klines1h, '4h': klines4h, '1d': klines1d, '1w': klines1w };
const RECORDED_AT = Date.UTC(2026, 10, 20, 13, 38);

function DevChart() {
  const [timeframe, setTimeframe] = useState<Timeframe>('4h');
  const [rank, setRank] = useState<'primary' | 'alternative'>('primary');
  const [showProjections, setShowProjections] = useState(true);
  const [showSignalLines, setShowSignalLines] = useState(true);
  const [paused, setPaused] = useState(false);

  const { candles, scenario, signal } = useMemo(() => {
    const { closed, open } = parseKlines(RAW[timeframe]);
    const analysis = analyseTimeframe(closed, timeframe);
    const scenario = rank === 'primary' ? analysis.primary : analysis.alternative;
    const levels = rank === 'primary' ? analysis.primaryLevels : analysis.alternativeLevels;
    const signal = scenario && levels && evaluateSignal(scenario, levels, timeframe, open.close, open);
    return { candles: [...closed, open], scenario, signal };
  }, [timeframe, rank]);

  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <p className="rounded bg-accent px-3 py-1 text-center text-xs font-bold text-background">
        DEV · SNAPSHOT 2026-11-20 13:38 UTC · not live data
      </p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex gap-1">
          {TIMEFRAMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeframe(t.id)}
              className={`rounded px-2 py-1 ${t.id === timeframe ? 'bg-accent text-background' : 'bg-surface-2'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['primary', 'alternative'] as const).map((r) => (
            <button key={r} onClick={() => setRank(r)} className={`rounded px-2 py-1 ${r === rank ? 'bg-accent text-background' : 'bg-surface-2'}`}>
              {r === 'primary' ? 'Primary Scenario' : 'Alternative Scenario'}
            </button>
          ))}
        </div>
        {toggle('Projections', showProjections, setShowProjections)}
        {toggle('Trade 1x', showSignalLines, setShowSignalLines)}
        {toggle('paused', paused, setPaused)}
        <span className="text-slate-500">signal: {signal ? `${signal.side} ${signal.status}` : 'none'}</span>
      </div>
      <ElliottChart
        className="flex-1"
        timeframe={timeframe}
        candles={candles}
        scenario={scenario}
        signal={signal}
        showProjections={showProjections}
        showSignalLines={showSignalLines}
        pausedSince={paused ? RECORDED_AT : null}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevChart />
  </StrictMode>,
);
