// Orchestrator (spec §3.2–§3.4, §6.5): the stream, the REST loads and backfills, fed into Dashboard.
// The state transitions live in lib/live.ts; this file only runs the side effects.
import { AlertTriangle, RotateCw } from 'lucide-react';
import { useEffect, useReducer, useState } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import { RECONNECT_DELAY_MS, TIMEFRAMES } from './config.ts';
import { BinanceRestError, fetchKlines, fetchTicker, type CandleHistory } from './lib/binance/rest.ts';
import { connectStream } from './lib/binance/stream.ts';
import { initialLiveState, liveReducer, pausedSince, type LiveState, type LoadError } from './lib/live.ts';
import type { Timeframe } from './types.ts';

function toLoadError(e: unknown): LoadError {
  if (e instanceof BinanceRestError) return { endpoint: e.endpoint, status: e.status, message: e.message };
  return { endpoint: 'unknown', status: null, message: e instanceof Error ? e.message : String(e) };
}

async function fetchHistories(): Promise<Record<Timeframe, CandleHistory>> {
  const histories = await Promise.all(TIMEFRAMES.map((t) => fetchKlines(t.id)));
  return Object.fromEntries(TIMEFRAMES.map((t, i) => [t.id, histories[i]])) as Record<Timeframe, CandleHistory>;
}

function useLiveData(): LiveState {
  const [state, dispatch] = useReducer(liveReducer, initialLiveState);

  useEffect(() => {
    const stream = connectStream({
      onMessage: (message) => dispatch({ type: 'message', message, at: Date.now() }),
      onOpen: () => dispatch({ type: 'open' }),
      onClose: () => dispatch({ type: 'close' }),
    });
    return () => stream.close();
  }, []);

  // The first load (with the 24h ticker) or a backfill, once the stream is up; a failed backfill
  // is retried after RECONNECT_DELAY_MS.
  const { connected, syncing, generation, attempt, status } = state;
  const firstLoad = status === 'loading';
  useEffect(() => {
    if (!connected || !syncing || status === 'error') return;
    let cancelled = false;
    const id = setTimeout(
      async () => {
        try {
          const [histories, ticker] = await Promise.all([fetchHistories(), firstLoad ? fetchTicker() : undefined]);
          if (!cancelled) dispatch({ type: 'synced', generation, histories, ticker, at: Date.now() });
        } catch (e) {
          if (!cancelled) dispatch({ type: 'syncFailed', generation, error: toLoadError(e) });
        }
      },
      attempt > 0 ? RECONNECT_DELAY_MS : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [connected, syncing, generation, attempt, status, firstLoad]);

  return state;
}

function Live({ onRetry }: { onRetry: () => void }) {
  const state = useLiveData();
  const { timeframes, ticker } = state;

  if (state.status === 'error') return <ErrorScreen error={state.error!} onRetry={onRetry} />;
  if (!timeframes || !ticker) {
    return (
      <div className="flex h-full items-center justify-center p-2">
        <p className="text-sm text-slate-500">Connecting to Binance…</p>
      </div>
    );
  }
  return <Dashboard data={timeframes} ticker={ticker} pausedSince={pausedSince(state)} />;
}

// §3.4: initial REST failure. No chart, no signals.
function ErrorScreen({ error, onRetry }: { error: LoadError; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-md border border-border bg-surface px-6 py-5 text-center">
        <AlertTriangle className="h-6 w-6 text-bearish" aria-hidden />
        <p className="font-semibold text-slate-200">Could not load data from Binance</p>
        <p className="break-all font-mono text-xs text-slate-400">
          GET {error.endpoint}
          {error.status !== null ? ` · HTTP ${error.status}` : ` · ${error.message}`}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90"
        >
          <RotateCw className="h-4 w-4" aria-hidden />
          Retry
        </button>
      </div>
    </div>
  );
}

// Retry remounts Live: a new stream and a new load (§3.4).
export default function App() {
  const [session, setSession] = useState(0);
  return <Live key={session} onRetry={() => setSession((n) => n + 1)} />;
}
