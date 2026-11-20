// PROTOTYPE ONLY. Derives what a prototype renders for one timeframe from mock + UI state.
import type { PositionSize, Scenario, Signal, SignalLevels, Timeframe } from '../../src/types.ts';
import { TIMEFRAME_MOCKS, positionSize, signalAt, type TimeframeMock } from './mock.ts';
import { usePrototype, type Rank } from './PrototypeShell.tsx';

export interface TimeframeView {
  mock: TimeframeMock;
  scenario: Scenario | null; // null: Neutral, or Alternative unavailable
  levels: SignalLevels | null; // null: no setup
  signal: Signal | null; // null: no setup; still present while offline (callers hide it)
  size: PositionSize | null;
  signalsPaused: boolean; // §3.4 offline: every signal hidden
}

export function useTimeframeView(tf: Timeframe, rank?: Rank): TimeframeView {
  const ui = usePrototype();
  const r = rank ?? ui.rank;
  const mock = TIMEFRAME_MOCKS[tf];
  const a = mock.analysis;
  const scenario = r === 'primary' ? a.primary : a.alternative;
  const levels = r === 'primary' ? a.primaryLevels : a.alternativeLevels;
  const signal = scenario && levels ? signalAt(tf, levels, scenario, ui.price) : null;
  const size = signal ? positionSize(ui.risk, signal.entry, signal.stopLoss) : null;
  return { mock, scenario, levels, signal, size, signalsPaused: ui.mode === 'offline' };
}
