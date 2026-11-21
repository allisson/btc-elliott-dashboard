import { describe, expect, it } from 'vitest';
import type { Candle, Ticker, Timeframe } from '../types.ts';
import type { CandleHistory } from './binance/rest.ts';
import type { StreamMessage } from './binance/stream.ts';
import { initialLiveState, liveReducer, pausedSince, type LiveEvent, type LiveState } from './live.ts';

const TIMEFRAMES = ['15m', '1h', '4h', '1d', '1w', '1M'] as const;
const SECONDS: Record<Exclude<Timeframe, '1M'>, number> = { '15m': 900, '1h': 3_600, '4h': 14_400, '1d': 86_400, '1w': 604_800 };
const T0 = 1_795_000_000 - (1_795_000_000 % 604_800);
// Candle i's open: fixed steps from T0, or the first of each month from January 2026 on 1M (§3.1).
const openTime = (tf: Timeframe, i: number) => (tf === '1M' ? Date.UTC(2026, i, 1) / 1000 : T0 + i * SECONDS[tf]);

const candle = (tf: Timeframe, i: number, close = 100 + i): Candle => ({
  time: openTime(tf, i),
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  volume: 1,
});

// Closed candles 0..4 and open candle 5 on every timeframe.
const history = (tf: Timeframe): CandleHistory => ({
  closed: [0, 1, 2, 3, 4].map((i) => candle(tf, i)),
  open: candle(tf, 5),
});
const HISTORIES = Object.fromEntries(TIMEFRAMES.map((tf) => [tf, history(tf)])) as Record<Timeframe, CandleHistory>;

const TICKER: Ticker = { price: 105, change24h: 1, changePercent24h: 1, high24h: 110, low24h: 90, volume24h: 10 };
const kline = (tf: Timeframe, c: Candle, closed: boolean): LiveEvent => ({
  type: 'message',
  message: { kind: 'kline', timeframe: tf, candle: c, closed },
  at: 1_000,
});
const tick = (price: number, at: number): LiveEvent => ({ type: 'message', message: { kind: 'ticker', ticker: { ...TICKER, price } } as StreamMessage, at });

const run = (events: LiveEvent[], from: LiveState = initialLiveState) => events.reduce(liveReducer, from);
const ready = (more: LiveEvent[] = []) =>
  run([{ type: 'open' }, { type: 'synced', generation: 1, histories: HISTORIES, ticker: TICKER, at: 500 }, ...more]);

describe('initial load', () => {
  it('starts loading and disconnected, with nothing to show', () => {
    expect(initialLiveState.status).toBe('loading');
    expect(initialLiveState.connected).toBe(false);
    expect(initialLiveState.timeframes).toBeNull();
  });

  it('the REST load analyses all six timeframes and goes live', () => {
    const s = ready();
    expect(s.status).toBe('ready');
    expect(s.syncing).toBe(false);
    expect(s.ticker).toEqual(TICKER);
    for (const tf of TIMEFRAMES) {
      expect(s.timeframes![tf].closed).toHaveLength(5);
      expect(s.timeframes![tf].open).toEqual(candle(tf, 5));
      expect(s.timeframes![tf].analysis.analysedAt).toBe(openTime(tf, 5));
    }
    expect(pausedSince(s)).toBeNull();
  });

  it('a load failure shows the error', () => {
    const s = run([{ type: 'open' }, { type: 'syncFailed', generation: 1, error: { endpoint: '/klines?x', status: 429, message: 'HTTP 429' } }]);
    expect(s.status).toBe('error');
    expect(s.error).toEqual({ endpoint: '/klines?x', status: 429, message: 'HTTP 429' });
  });

  it('klines that arrive during the load are buffered, then applied on top of the history', () => {
    const s = run([
      { type: 'open' },
      kline('1h', candle('1h', 4, 999), true), // already closed in the REST history: ignored
      kline('1h', { ...candle('1h', 5), high: 200 }, false), // replaces the open candle
      kline('1h', { ...candle('1h', 5), high: 201 }, true), // closes it
      kline('1h', candle('1h', 6), false), // the next open candle
      { type: 'synced', generation: 1, histories: HISTORIES, ticker: TICKER, at: 500 },
    ]);
    const h = s.timeframes!['1h'];
    expect(h.closed.map((c) => c.time)).toEqual([0, 1, 2, 3, 4, 5].map((i) => candle('1h', i).time));
    expect(h.closed[4].close).toBe(104);
    expect(h.closed[5].high).toBe(201);
    expect(h.open).toEqual(candle('1h', 6));
    expect(h.analysis.analysedAt).toBe(openTime('1h', 6));
    expect(s.buffer).toEqual([]);
  });

  it('a stream ticker newer than the load is kept over the REST ticker', () => {
    const s = run([{ type: 'open' }, tick(107, 400), { type: 'synced', generation: 1, histories: HISTORIES, ticker: TICKER, at: 500 }]);
    expect(s.ticker!.price).toBe(107);
  });

  it('a drop during the load: the load still lands, paused since the load', () => {
    const s = run([{ type: 'open' }, { type: 'close' }, { type: 'synced', generation: 1, histories: HISTORIES, ticker: TICKER, at: 500 }]);
    expect(s.status).toBe('ready');
    expect(pausedSince(s)).toBe(500);
  });
});

describe('stream messages when live (§3.3, §6.5)', () => {
  it('an open-candle kline replaces the open candle and keeps the analysis', () => {
    const before = ready();
    const s = liveReducer(before, kline('1h', { ...candle('1h', 5), close: 150 }, false));
    expect(s.timeframes!['1h'].open!.close).toBe(150);
    expect(s.timeframes!['1h'].analysis).toBe(before.timeframes!['1h'].analysis);
  });

  it('a 1h close re-analyses only 1h and leaves no open candle until the next kline', () => {
    const before = ready();
    const s = liveReducer(before, kline('1h', candle('1h', 5), true));
    expect(s.timeframes!['1h'].closed).toHaveLength(6);
    expect(s.timeframes!['1h'].open).toBeNull();
    expect(s.timeframes!['1h'].analysis.analysedAt).toBe(openTime('1h', 6));
    for (const tf of TIMEFRAMES.filter((t) => t !== '1h')) expect(s.timeframes![tf]).toBe(before.timeframes![tf]);

    const next = liveReducer(s, kline('1h', candle('1h', 6), false));
    expect(next.timeframes!['1h'].open).toEqual(candle('1h', 6));
    expect(next.timeframes!['1h'].analysis).toBe(s.timeframes!['1h'].analysis);
  });

  it('a late kline of a closed candle is ignored', () => {
    const before = ready([kline('1h', candle('1h', 5), true)]);
    const s = liveReducer(before, kline('1h', candle('1h', 5, 999), false));
    expect(s.timeframes).toBe(before.timeframes);
  });

  it('a ticker updates the price and the last update time, not the analyses', () => {
    const before = ready();
    const s = liveReducer(before, tick(110, 2_000));
    expect(s.ticker!.price).toBe(110);
    expect(s.lastUpdateAt).toBe(2_000);
    expect(s.timeframes).toBe(before.timeframes);
  });
});

describe('paused and backfill (§3.3, §3.4)', () => {
  it('a drop pauses at the last message received', () => {
    const s = ready([tick(110, 2_000), { type: 'close' }]);
    expect(pausedSince(s)).toBe(2_000);
  });

  it('ticks after the reconnect move the price but not the paused time', () => {
    const s = ready([tick(110, 2_000), { type: 'close' }, { type: 'open' }, tick(111, 9_000)]);
    expect(s.ticker!.price).toBe(111);
    expect(pausedSince(s)).toBe(2_000);
    expect(s.syncing).toBe(true);
  });

  it('the backfill replaces the history, applies the buffered klines and resumes', () => {
    const backfill = { ...HISTORIES, '1h': { closed: [0, 1, 2, 3, 4, 5, 6].map((i) => candle('1h', i)), open: candle('1h', 7) } };
    const s = ready([
      { type: 'close' },
      { type: 'open' },
      kline('1h', candle('1h', 7), true),
      { type: 'synced', generation: 2, histories: backfill, at: 9_500 },
    ]);
    expect(s.timeframes!['1h'].closed).toHaveLength(8);
    expect(s.timeframes!['1h'].open).toBeNull();
    expect(s.syncing).toBe(false);
    expect(pausedSince(s)).toBeNull();
  });

  it('a failed backfill stays paused and asks for a retry', () => {
    const s = ready([
      { type: 'close' },
      { type: 'open' },
      { type: 'syncFailed', generation: 2, error: { endpoint: '/klines?x', status: null, message: 'Failed to fetch' } },
    ]);
    expect(s.status).toBe('ready');
    expect(s.attempt).toBe(1);
    expect(s.syncing).toBe(true);
    expect(pausedSince(s)).not.toBeNull();
  });

  it('a sync from before the latest reconnect is dropped', () => {
    const before = ready([{ type: 'close' }, { type: 'open' }, { type: 'close' }, { type: 'open' }]);
    const s = liveReducer(before, { type: 'synced', generation: 2, histories: HISTORIES, at: 9_000 });
    expect(s).toBe(before);
    const failed = liveReducer(before, { type: 'syncFailed', generation: 2, error: { endpoint: '/x', status: null, message: 'x' } });
    expect(failed).toBe(before);
  });

  it('a backfill that lands after the stream dropped again stays paused', () => {
    const s = ready([{ type: 'close' }, { type: 'open' }, { type: 'close' }, { type: 'synced', generation: 2, histories: HISTORIES, at: 9_000 }]);
    expect(pausedSince(s)).toBe(500);
  });

  it('a second drop before the backfill keeps the first paused time', () => {
    const s = ready([tick(110, 2_000), { type: 'close' }, { type: 'open' }, tick(111, 9_000), { type: 'close' }]);
    expect(pausedSince(s)).toBe(2_000);
  });

  it('every socket open starts a sync and clears the buffer', () => {
    const s = ready([{ type: 'close' }, { type: 'open' }]);
    expect(s.generation).toBe(2);
    expect(s.syncing).toBe(true);
    expect(s.buffer).toEqual([]);
  });
});
