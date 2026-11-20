// Dev-only page (roadmap Phase 8): the recorded Binance snapshots (spec §11) and 24h ticker through the
// engine and into Dashboard. Served by `bun dev` at /dev/dashboard.html, never built, never imported by
// App.tsx (ADR 0002). Deleted in Phase 9.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { Dashboard, type TimeframeData } from '../src/components/Dashboard.tsx';
import { TIMEFRAMES } from '../src/config.ts';
import { parseKlines, parseTicker24hr } from '../src/lib/binance/rest.ts';
import { analyseTimeframe } from '../src/lib/engine/analysis.ts';
import klines1d from '../src/lib/engine/__fixtures__/binance/klines-1d.json';
import klines1h from '../src/lib/engine/__fixtures__/binance/klines-1h.json';
import klines1w from '../src/lib/engine/__fixtures__/binance/klines-1w.json';
import klines4h from '../src/lib/engine/__fixtures__/binance/klines-4h.json';
import ticker24hr from '../src/lib/engine/__fixtures__/binance/ticker-24hr.json';
import type { Timeframe } from '../src/types.ts';

const RAW: Record<Timeframe, unknown> = { '1h': klines1h, '4h': klines4h, '1d': klines1d, '1w': klines1w };
const RECORDED_AT = Date.UTC(2026, 10, 20, 13, 38);

// The ticker's last price is the entry on every timeframe (§6.3).
const TICKER = parseTicker24hr(ticker24hr);
const DATA = Object.fromEntries(
  TIMEFRAMES.map(({ id }) => {
    const { closed, open } = parseKlines(RAW[id]);
    return [id, { analysis: analyseTimeframe(closed, id), candles: [...closed, open] }];
  }),
) as Record<Timeframe, TimeframeData>;

function DevDashboard() {
  const [paused, setPaused] = useState(false);
  const data = useMemo(() => DATA, []);

  return (
    <div className="flex flex-col lg:h-full">
      <div className="flex items-center justify-center gap-4 bg-accent px-3 py-1 text-xs font-bold text-background">
        <span>DEV · SNAPSHOT 2026-11-20 13:38 UTC · not live data</span>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} />
          paused
        </label>
      </div>
      <div className="lg:min-h-0 lg:flex-1">
        <Dashboard data={data} ticker={TICKER} pausedSince={paused ? RECORDED_AT : null} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DevDashboard />
  </StrictMode>,
);
