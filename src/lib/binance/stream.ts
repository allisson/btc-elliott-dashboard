// Binance public combined stream (spec §3.3): candle and ticker updates, reconnect every 3 s.
// A socket is dropped on close or error, after STREAM_STALE_MS without a message, or when the browser
// goes offline. Backfill is the caller's job: `onReconnect` fires when a dropped connection opens again.
import { BINANCE_WS_BASE, RECONNECT_DELAY_MS, STREAM_STALE_MS, SYMBOL, TIMEFRAMES } from '../../config.ts';
import type { Candle, Ticker, Timeframe } from '../../types.ts';

export type StreamMessage =
  | { kind: 'kline'; timeframe: Timeframe; candle: Candle; closed: boolean }
  | { kind: 'ticker'; ticker: Ticker };

const symbol = SYMBOL.toLowerCase();
export const STREAM_URL = `${BINANCE_WS_BASE}?streams=${[
  ...TIMEFRAMES.map((t) => `${symbol}@kline_${t.interval}`),
  `${symbol}@ticker`,
].join('/')}`;

type RawKline = { t: number; o: string; h: string; l: string; c: string; v: string; x: boolean; i: string };
type RawTicker = Record<'c' | 'p' | 'P' | 'h' | 'l' | 'v', string>;

// null for anything that is not a kline of one of our timeframes or the ticker.
export function parseStreamMessage(raw: string): StreamMessage | null {
  const { stream, data } = JSON.parse(raw) as { stream: string; data: { k?: RawKline } & RawTicker };
  if (stream === `${symbol}@ticker`) {
    return {
      kind: 'ticker',
      ticker: {
        price: Number(data.c),
        change24h: Number(data.p),
        changePercent24h: Number(data.P),
        high24h: Number(data.h),
        low24h: Number(data.l),
        volume24h: Number(data.v),
      },
    };
  }
  const k = data.k;
  const tf = k && TIMEFRAMES.find((t) => t.interval === k.i);
  if (!k || !tf) return null;
  return {
    kind: 'kline',
    timeframe: tf.id,
    candle: { time: k.t / 1000, open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v) },
    closed: k.x,
  };
}

export interface StreamHandlers {
  onMessage(message: StreamMessage): void;
  onOpen?(): void; // every successful connection, the first included
  onClose?(): void; // once per drop, before the retry is scheduled
  onReconnect?(): void; // after onOpen, on every connection but the first: time to backfill
}

// The subset of WebSocket the stream uses, so tests can drive a fake socket.
export interface SocketLike {
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  close(): void;
}

export interface StreamDeps {
  createSocket(url: string): SocketLike;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  onOffline(fn: () => void): () => void; // returns the unsubscribe
}

const browserDeps: StreamDeps = {
  createSocket: (url) => new WebSocket(url),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  onOffline: (fn) => {
    window.addEventListener('offline', fn);
    return () => window.removeEventListener('offline', fn);
  },
};

export function connectStream(handlers: StreamHandlers, deps: StreamDeps = browserDeps): { close(): void } {
  let stopped = false;
  let opened = false;
  let timer: unknown = null;
  let watchdog: unknown = null;
  let socket: SocketLike;
  let dropCurrent = () => {};

  const stopWatchdog = () => {
    if (watchdog !== null) deps.clearTimeout(watchdog);
    watchdog = null;
  };

  const connect = () => {
    const s = deps.createSocket(STREAM_URL);
    let dropped = false;
    const restartWatchdog = () => {
      stopWatchdog();
      watchdog = deps.setTimeout(drop, STREAM_STALE_MS);
    };
    // Close and error can both fire for one failure, and a forced drop is followed by a late close:
    // retry once.
    const drop = () => {
      if (dropped || stopped) return;
      dropped = true;
      stopWatchdog();
      s.close();
      handlers.onClose?.();
      timer = deps.setTimeout(connect, RECONNECT_DELAY_MS);
    };
    s.onopen = () => {
      if (dropped) return;
      restartWatchdog();
      handlers.onOpen?.();
      if (opened) handlers.onReconnect?.();
      opened = true;
    };
    s.onmessage = (ev) => {
      if (dropped) return;
      restartWatchdog();
      const message = parseStreamMessage(String(ev.data));
      if (message) handlers.onMessage(message);
    };
    s.onclose = drop;
    s.onerror = drop;
    socket = s;
    dropCurrent = drop;
    restartWatchdog();
  };

  const unsubscribeOffline = deps.onOffline(() => dropCurrent());
  connect();
  return {
    close() {
      stopped = true;
      if (timer !== null) deps.clearTimeout(timer);
      stopWatchdog();
      unsubscribeOffline();
      socket.close();
    },
  };
}
