// Binance public REST (spec §3.2): candle history and the 24h ticker. No API key.
import { BINANCE_REST_BASE, KLINES_LIMIT, SYMBOL, TIMEFRAMES } from '../../config.ts';
import type { Candle, Ticker, Timeframe } from '../../types.ts';

// §3.4: what the error screen shows. `status` is null when no HTTP response arrived.
export class BinanceRestError extends Error {
  readonly endpoint: string;
  readonly status: number | null;

  constructor(endpoint: string, status: number | null, message: string) {
    super(message);
    this.name = 'BinanceRestError';
    this.endpoint = endpoint;
    this.status = status;
  }
}

export interface CandleHistory {
  closed: Candle[];
  open: Candle; // the last kline returned: drawn, never analysed
}

type RawKline = [number, string, string, string, string, string, ...unknown[]];

export const klinesEndpoint = (timeframe: Timeframe): string => {
  const { interval } = TIMEFRAMES.find((t) => t.id === timeframe)!;
  return `/klines?symbol=${SYMBOL}&interval=${interval}&limit=${KLINES_LIMIT}`;
};
export const TICKER_ENDPOINT = `/ticker/24hr?symbol=${SYMBOL}`;

export function parseKlines(raw: unknown): CandleHistory {
  const candles = (raw as RawKline[]).map(
    (k): Candle => ({
      time: k[0] / 1000,
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }),
  );
  return { closed: candles.slice(0, -1), open: candles[candles.length - 1] };
}

export function parseTicker24hr(raw: unknown): Ticker {
  const t = raw as Record<'lastPrice' | 'priceChange' | 'priceChangePercent' | 'highPrice' | 'lowPrice' | 'volume', string>;
  return {
    price: Number(t.lastPrice),
    change24h: Number(t.priceChange),
    changePercent24h: Number(t.priceChangePercent),
    high24h: Number(t.highPrice),
    low24h: Number(t.lowPrice),
    volume24h: Number(t.volume),
  };
}

async function getJson(endpoint: string, fetchFn: typeof fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchFn(BINANCE_REST_BASE + endpoint);
  } catch (e) {
    throw new BinanceRestError(endpoint, null, e instanceof Error ? e.message : String(e));
  }
  if (!res.ok) throw new BinanceRestError(endpoint, res.status, `HTTP ${res.status}`);
  return res.json();
}

export async function fetchKlines(timeframe: Timeframe, fetchFn: typeof fetch = fetch): Promise<CandleHistory> {
  return parseKlines(await getJson(klinesEndpoint(timeframe), fetchFn));
}

export async function fetchTicker(fetchFn: typeof fetch = fetch): Promise<Ticker> {
  return parseTicker24hr(await getJson(TICKER_ENDPOINT, fetchFn));
}
