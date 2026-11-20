// Live state (spec §3.2–§3.4, §6.5): REST loads and stream messages in, per-timeframe candles and
// analyses out. Pure: the caller passes the times, runs the stream, and fetches the history whenever
// `connected && syncing` (with the 24h ticker while `status` is 'loading').
import { TIMEFRAMES } from '../config.ts';
import type { Candle, Ticker, Timeframe, TimeframeAnalysis } from '../types.ts';
import type { CandleHistory } from './binance/rest.ts';
import type { StreamMessage } from './binance/stream.ts';
import { analyseTimeframe } from './engine/analysis.ts';

export interface TimeframeState {
  closed: Candle[];
  open: Candle | null; // null between a close and the next candle's first kline (§3.3)
  analysis: TimeframeAnalysis;
}

export interface LoadError {
  endpoint: string;
  status: number | null;
  message: string;
}

type KlineMessage = Extract<StreamMessage, { kind: 'kline' }>;

export interface LiveState {
  status: 'loading' | 'ready' | 'error';
  error: LoadError | null;
  timeframes: Record<Timeframe, TimeframeState> | null;
  ticker: Ticker | null;
  connected: boolean;
  syncing: boolean; // the REST load or a backfill is due or in flight: klines are buffered
  generation: number; // bumped by every socket open; a sync from an older generation is dropped
  attempt: number; // bumped by every failed backfill, so the caller retries it
  buffer: KlineMessage[];
  lastUpdateAt: number | null; // ms: the last stream message, or the REST load
  pausedAt: number | null; // ms: lastUpdateAt when the stream dropped
}

export type LiveEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'message'; message: StreamMessage; at: number }
  | { type: 'synced'; generation: number; histories: Record<Timeframe, CandleHistory>; ticker?: Ticker; at: number }
  | { type: 'syncFailed'; generation: number; error: LoadError };

export const initialLiveState: LiveState = {
  status: 'loading',
  error: null,
  timeframes: null,
  ticker: null,
  connected: false,
  syncing: true,
  generation: 0,
  attempt: 0,
  buffer: [],
  lastUpdateAt: null,
  pausedAt: null,
};

// §3.4: signals are paused while the stream is down or a backfill has not landed.
export function pausedSince(state: LiveState): number | null {
  if (state.status !== 'ready') return null;
  if (state.connected && !state.syncing) return null;
  return state.pausedAt ?? state.lastUpdateAt;
}

// §3.3: replace the open candle, append a new one, or close it and re-analyse the timeframe.
function applyKline(tf: TimeframeState, { timeframe, candle, closed }: KlineMessage): TimeframeState {
  if (candle.time <= tf.closed[tf.closed.length - 1].time) return tf;
  if (!closed) return { ...tf, open: candle };
  const all = [...tf.closed, candle];
  return { closed: all, open: null, analysis: analyseTimeframe(all, timeframe) };
}

function applyKlines(timeframes: Record<Timeframe, TimeframeState>, messages: KlineMessage[]): Record<Timeframe, TimeframeState> {
  let out = timeframes;
  for (const m of messages) {
    const next = applyKline(out[m.timeframe], m);
    if (next !== out[m.timeframe]) out = { ...out, [m.timeframe]: next };
  }
  return out;
}

function fromHistories(histories: Record<Timeframe, CandleHistory>): Record<Timeframe, TimeframeState> {
  return Object.fromEntries(
    TIMEFRAMES.map(({ id }) => {
      const { closed, open } = histories[id];
      return [id, { closed, open, analysis: analyseTimeframe(closed, id) }];
    }),
  ) as Record<Timeframe, TimeframeState>;
}

export function liveReducer(state: LiveState, event: LiveEvent): LiveState {
  switch (event.type) {
    // Every open starts a sync (the first load, or a backfill): the REST history is fetched only
    // with the stream up, so every kline after it is buffered and none is missed (§3.2, §3.3).
    case 'open':
      return { ...state, connected: true, syncing: true, generation: state.generation + 1, attempt: 0, buffer: [] };
    case 'close':
      return { ...state, connected: false, pausedAt: state.pausedAt ?? state.lastUpdateAt };
    case 'message': {
      const { message, at } = event;
      if (message.kind === 'ticker') return { ...state, ticker: message.ticker, lastUpdateAt: at };
      if (state.syncing) return { ...state, buffer: [...state.buffer, message], lastUpdateAt: at };
      return { ...state, timeframes: applyKlines(state.timeframes!, [message]), lastUpdateAt: at };
    }
    case 'synced': {
      if (event.generation !== state.generation) return state;
      const live = state.connected;
      return {
        ...state,
        status: 'ready',
        timeframes: applyKlines(fromHistories(event.histories), state.buffer),
        ticker: state.ticker ?? event.ticker ?? null,
        syncing: false,
        buffer: [],
        lastUpdateAt: state.lastUpdateAt ?? event.at,
        pausedAt: live ? null : (state.pausedAt ?? state.lastUpdateAt ?? event.at),
      };
    }
    case 'syncFailed':
      if (event.generation !== state.generation) return state;
      if (state.status === 'loading') return { ...state, status: 'error', error: event.error };
      return { ...state, attempt: state.attempt + 1 };
  }
}
