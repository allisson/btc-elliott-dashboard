import { describe, expect, it } from 'vitest';
import klines1h from '../engine/__fixtures__/binance/klines-1h.json';
import klines1w from '../engine/__fixtures__/binance/klines-1w.json';
import ticker24hr from '../engine/__fixtures__/binance/ticker-24hr.json';
import { BinanceRestError, fetchKlines, fetchTicker, klinesEndpoint, parseKlines, parseTicker24hr } from './rest.ts';

const respond = (body: unknown, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe('parseKlines (recorded payload)', () => {
  it('flags the last kline as open and keeps the rest as closed', () => {
    const { closed, open } = parseKlines(klines1h);
    expect(closed).toHaveLength(999);
    expect(open.time).toBe(1795179600);
    expect(closed[closed.length - 1].time).toBe(1795179600 - 3_600);
  });

  it('converts open time to seconds and every field to a number', () => {
    expect(parseKlines(klines1h).closed[0]).toEqual({
      time: 1791583200,
      open: 82536.79,
      high: 82647.51,
      low: 82446,
      close: 82635.95,
      volume: 458.45166,
    });
  });

  it('1w returns the whole history (fewer than the limit)', () => {
    expect(parseKlines(klines1w).closed).toHaveLength(483);
  });
});

describe('parseTicker24hr (recorded payload)', () => {
  it('maps the header stats', () => {
    expect(parseTicker24hr(ticker24hr)).toEqual({
      price: 61467.07,
      change24h: -2265.46,
      changePercent24h: -3.555,
      high24h: 64080,
      low24h: 61230,
      volume24h: 23412.97594,
    });
  });
});

describe('fetch', () => {
  it('requests the §3.2 endpoint and parses it', async () => {
    let url = '';
    const fetchFn = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify(klines1h));
    }) as typeof fetch;
    const { closed } = await fetchKlines('4h', fetchFn);
    expect(url).toBe('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=1000');
    expect(closed).toHaveLength(999);
    expect((await fetchTicker(respond(ticker24hr))).price).toBe(61467.07);
  });

  it('HTTP error carries the endpoint and status', async () => {
    const err = await fetchKlines('1d', respond({ code: -1003 }, 429)).catch((e) => e);
    expect(err).toBeInstanceOf(BinanceRestError);
    expect(err).toMatchObject({ endpoint: klinesEndpoint('1d'), status: 429 });
  });

  it('network failure has no status', async () => {
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const err = await fetchTicker(fetchFn).catch((e) => e);
    expect(err).toMatchObject({ endpoint: '/ticker/24hr?symbol=BTCUSDT', status: null, message: 'Failed to fetch' });
  });
});
