// The §9.0 layout. Takes data, owns the UI state: focused timeframe, scenario tab per timeframe, the
// two toggles and the risk inputs (stored in localStorage, §7). Phase 9 feeds it from App.tsx.
import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_TIMEFRAME, RISK_STORAGE_KEY, TIMEFRAMES } from '../config.ts';
import { confluence } from '../lib/engine/confluence.ts';
import { confluenceBadge, parseStoredRisk, riskFromInputs, scenarioView, selectedRank, stripCard, type Rank, type RiskInputs } from '../lib/panels.ts';
import type { OpenCandle } from '../lib/engine/setups.ts';
import type { Candle, Ticker, Timeframe, TimeframeAnalysis } from '../types.ts';
import { ConfluenceStrip } from './ConfluenceStrip.tsx';
import { ElliottChart } from './ElliottChart.tsx';
import { Header } from './Header.tsx';
import { SignalPanel } from './SignalPanel.tsx';

export interface TimeframeData {
  analysis: TimeframeAnalysis;
  closed: Candle[]; // oldest first
  open: Candle | null; // null between a close and the next candle's first kline (§3.3)
}

interface DashboardProps {
  data: Record<Timeframe, TimeframeData>;
  ticker: Ticker;
  pausedSince: number | null; // ms since epoch of the last real update, while the stream is down
}

// §6.4: breaches since the last close; with no open candle yet, only the live price.
const breachProbe = (open: Candle | null, price: number): OpenCandle => open ?? { high: price, low: price };

const ALL_PRIMARY = Object.fromEntries(TIMEFRAMES.map((t) => [t.id, 'primary'])) as Record<Timeframe, Rank>;

function loadRiskInputs(): RiskInputs {
  try {
    return parseStoredRisk(localStorage.getItem(RISK_STORAGE_KEY));
  } catch {
    return parseStoredRisk(null);
  }
}

export function Dashboard({ data, ticker, pausedSince }: DashboardProps) {
  const [focused, setFocused] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const [ranks, setRanks] = useState(ALL_PRIMARY);
  const [showProjections, setShowProjections] = useState(true);
  const [showSignalLines, setShowSignalLines] = useState(true);
  const [riskInputs, setRiskInputs] = useState(loadRiskInputs);

  useEffect(() => {
    try {
      localStorage.setItem(RISK_STORAGE_KEY, JSON.stringify(riskInputs));
    } catch {
      // Storage unavailable (private mode, quota): the inputs still work for this session.
    }
  }, [riskInputs]);

  const price = ticker.price;
  const paused = pausedSince !== null;
  const analyses = useMemo(
    () => Object.fromEntries(TIMEFRAMES.map((t) => [t.id, data[t.id].analysis])) as Record<Timeframe, TimeframeAnalysis>,
    [data],
  );
  const agreement = useMemo(() => confluence(analyses), [analyses]);
  const risk = riskFromInputs(riskInputs);
  const cards = TIMEFRAMES.map((t) => ({
    timeframe: t.id,
    card: stripCard(data[t.id].analysis, price, breachProbe(data[t.id].open, price), risk.settings.riskPercent, paused),
  }));

  const { analysis, closed, open } = data[focused];
  const candles = useMemo(() => (open ? [...closed, open] : closed), [closed, open]);
  const rank = selectedRank(analysis, ranks[focused]);
  const view = scenarioView(analysis, rank, price, breachProbe(open, price), risk.settings.riskPercent);

  return (
    <div className="flex flex-col gap-2 p-2 lg:h-full">
      <Header
        ticker={ticker}
        timeframe={focused}
        onTimeframe={setFocused}
        showProjections={showProjections}
        onProjections={setShowProjections}
        showSignalLines={showSignalLines}
        onSignalLines={setShowSignalLines}
        pausedSince={pausedSince}
      />
      <ConfluenceStrip confluence={agreement} badge={confluenceBadge(agreement)} cards={cards} focused={focused} onFocus={setFocused} />
      <main className="flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:flex-row">
        <ElliottChart
          className="h-[420px] lg:h-auto lg:flex-1"
          timeframe={focused}
          candles={candles}
          scenario={view.scenario}
          signal={view.signal}
          showProjections={showProjections}
          showSignalLines={showSignalLines}
          pausedSince={pausedSince}
        />
        <SignalPanel
          className="lg:w-[380px] lg:shrink-0 lg:overflow-y-auto xl:w-[400px]"
          timeframeLabel={TIMEFRAMES.find((t) => t.id === focused)!.label}
          primary={analysis.primary}
          alternative={analysis.alternative}
          rank={rank}
          onRank={(r) => setRanks({ ...ranks, [focused]: r })}
          view={view}
          pausedSince={pausedSince}
          riskInputs={riskInputs}
          onRiskInputs={setRiskInputs}
          risk={risk}
        />
      </main>
    </div>
  );
}
