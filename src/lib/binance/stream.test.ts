import { describe, expect, it } from 'vitest';
import wsKlineClosed from '../engine/__fixtures__/binance/ws-kline-closed.json';
import wsKlineOpen from '../engine/__fixtures__/binance/ws-kline-open.json';
import wsTicker from '../engine/__fixtures__/binance/ws-ticker.json';
import { connectStream, parseStreamMessage, STREAM_URL, type SocketLike, type StreamMessage } from './stream.ts';

describe('parseStreamMessage (recorded payloads)', () => {
  it('open kline', () => {
    expect(parseStreamMessage(JSON.stringify(wsKlineOpen))).toEqual({
      kind: 'kline',
      timeframe: '1h',
      candle: { time: 1795179600, open: 61565.58, high: 61683.67, low: 61319.92, close: 61486.84, volume: 407.77355 },
      closed: false,
    });
  });

  it('closed kline (the same 1h candle, at its close)', () => {
    expect(parseStreamMessage(JSON.stringify(wsKlineClosed))).toEqual({
      kind: 'kline',
      timeframe: '1h',
      candle: { time: 1795179600, open: 61565.58, high: 61990.01, low: 61319.92, close: 61882, volume: 815.98662 },
      closed: true,
    });
  });

  it('ticker', () => {
    expect(parseStreamMessage(JSON.stringify(wsTicker))).toEqual({
      kind: 'ticker',
      ticker: { price: 61486.84, change24h: -2245.69, changePercent24h: -3.524, high24h: 64080, low24h: 61230, volume24h: 23413.72205 },
    });
  });

  it('kline of an interval we do not track is ignored', () => {
    const other = { ...wsKlineOpen, stream: 'btcusdt@kline_1m', data: { ...wsKlineOpen.data, k: { ...wsKlineOpen.data.k, i: '1m' } } };
    expect(parseStreamMessage(JSON.stringify(other))).toBeNull();
  });
});

class FakeSocket implements SocketLike {
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  onmessage: SocketLike['onmessage'] = null;
  closed = false;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event('open'));
  }
  send(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
  drop() {
    this.onerror?.(new Event('error'));
    this.onclose?.(new Event('close') as CloseEvent);
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  const offline: { fn: (() => void) | null } = { fn: null };
  const events: string[] = [];
  const messages: StreamMessage[] = [];
  const conn = connectStream(
    {
      onMessage: (m) => messages.push(m),
      onOpen: () => events.push('open'),
      onClose: () => events.push('close'),
      onReconnect: () => events.push('reconnect'),
    },
    {
      createSocket: (url) => {
        const s = new FakeSocket(url);
        sockets.push(s);
        return s;
      },
      setTimeout: (fn, ms) => {
        const t = { fn, ms, cleared: false };
        timers.push(t);
        return t;
      },
      clearTimeout: (t) => {
        (t as (typeof timers)[number]).cleared = true;
      },
      onOffline: (fn) => {
        offline.fn = fn;
        return () => {
          offline.fn = null;
        };
      },
    },
  );
  // Live timers by role: the 3 s reconnect and the 10 s watchdog.
  const pending = (ms: number) => timers.filter((t) => t.ms === ms && !t.cleared);
  const retries = () => timers.filter((t) => t.ms === 3_000);
  return { sockets, timers, events, messages, conn, offline, pending, retries };
}

describe('connectStream', () => {
  it('opens the §3.3 combined stream and forwards parsed messages', () => {
    const h = harness();
    expect(h.sockets[0].url).toBe(
      'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1h/btcusdt@kline_4h/btcusdt@kline_1d/btcusdt@kline_1w/btcusdt@ticker',
    );
    expect(STREAM_URL).toBe(h.sockets[0].url);
    h.sockets[0].open();
    h.sockets[0].send(wsTicker);
    expect(h.events).toEqual(['open']);
    expect(h.messages).toHaveLength(1);
    expect(h.messages[0].kind).toBe('ticker');
  });

  it('a drop (error then close) retries once after 3 s, and the reopen asks for backfill', () => {
    const h = harness();
    h.sockets[0].open();
    h.sockets[0].drop();
    expect(h.events).toEqual(['open', 'close']);
    expect(h.retries()).toHaveLength(1);

    h.retries()[0].fn();
    expect(h.sockets).toHaveLength(2);
    h.sockets[1].open();
    expect(h.events).toEqual(['open', 'close', 'open', 'reconnect']);
  });

  it('keeps retrying while the connection fails', () => {
    const h = harness();
    h.sockets[0].drop();
    h.retries()[0].fn();
    h.sockets[1].drop();
    h.retries()[1].fn();
    h.sockets[2].open();
    expect(h.sockets).toHaveLength(3);
    expect(h.events).toEqual(['close', 'close', 'open']); // first successful open: no backfill
  });

  it('close() stops retries and closes the socket', () => {
    const h = harness();
    h.sockets[0].open();
    h.sockets[0].drop();
    h.conn.close();
    expect(h.retries()[0].cleared).toBe(true);
    h.sockets[0].drop();
    expect(h.retries()).toHaveLength(1);
    expect(h.sockets[0].closed).toBe(true);
  });

  it('close() also stops the watchdog and the offline listener', () => {
    const h = harness();
    h.sockets[0].open();
    h.conn.close();
    expect(h.pending(10_000)).toHaveLength(0);
    expect(h.offline.fn).toBeNull();
  });
});

describe('connectStream drop detection (§3.3)', () => {
  it('10 s without a message drops the socket and schedules the retry', () => {
    const h = harness();
    h.sockets[0].open();
    expect(h.pending(10_000)).toHaveLength(1);
    h.pending(10_000)[0].fn();
    expect(h.events).toEqual(['open', 'close']);
    expect(h.sockets[0].closed).toBe(true);
    expect(h.pending(3_000)).toHaveLength(1);
  });

  it('every message restarts the 10 s window', () => {
    const h = harness();
    h.sockets[0].open();
    const first = h.pending(10_000)[0];
    h.sockets[0].send(wsTicker);
    expect(first.cleared).toBe(true);
    expect(h.pending(10_000)).toHaveLength(1);
    expect(h.events).toEqual(['open']);
  });

  it('a socket that never opens is dropped by the watchdog too', () => {
    const h = harness();
    h.pending(10_000)[0].fn();
    expect(h.events).toEqual(['close']);
    expect(h.pending(3_000)).toHaveLength(1);
  });

  it('the browser going offline drops at once', () => {
    const h = harness();
    h.sockets[0].open();
    h.offline.fn!();
    expect(h.events).toEqual(['open', 'close']);
    expect(h.sockets[0].closed).toBe(true);
    expect(h.pending(10_000)).toHaveLength(0);
    expect(h.pending(3_000)).toHaveLength(1);
  });

  it('offline while already waiting to retry does nothing', () => {
    const h = harness();
    h.sockets[0].drop();
    h.offline.fn!();
    expect(h.events).toEqual(['close']);
    expect(h.retries()).toHaveLength(1);
  });

  it('a dropped socket that still delivers is ignored, and its late close is not a second drop', () => {
    const h = harness();
    h.sockets[0].open();
    h.pending(10_000)[0].fn();
    h.sockets[0].send(wsTicker);
    h.sockets[0].drop();
    expect(h.messages).toHaveLength(0);
    expect(h.events).toEqual(['open', 'close']);
    expect(h.retries()).toHaveLength(1);
  });
});
