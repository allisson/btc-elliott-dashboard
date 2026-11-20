// Records raw Binance payloads into src/lib/engine/__fixtures__/binance/ (spec §11, roadmap Phase 6).
// Run once with `bun scripts/record-snapshots.ts`. Public endpoints only, no API key.
// The closed-kline WebSocket message waits for the next 1h close, so this can take up to an hour.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BINANCE_REST_BASE, BINANCE_WS_BASE, KLINES_LIMIT, SYMBOL, TIMEFRAMES } from '../src/config.ts';

const OUT = join(import.meta.dir, '../src/lib/engine/__fixtures__/binance');
mkdirSync(OUT, { recursive: true });

const save = (name: string, data: unknown) => {
  writeFileSync(join(OUT, name), JSON.stringify(data) + '\n');
  console.log(`saved ${name}`);
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

for (const tf of TIMEFRAMES) {
  save(`klines-${tf.id}.json`, await getJson(`${BINANCE_REST_BASE}/klines?symbol=${SYMBOL}&interval=${tf.interval}&limit=${KLINES_LIMIT}`));
}
save('ticker-24hr.json', await getJson(`${BINANCE_REST_BASE}/ticker/24hr?symbol=${SYMBOL}`));

const symbol = SYMBOL.toLowerCase();
const streams = [...TIMEFRAMES.map((tf) => `${symbol}@kline_${tf.interval}`), `${symbol}@ticker`].join('/');
const wanted = new Set(['ws-kline-open.json', 'ws-kline-closed.json', 'ws-ticker.json']);

await new Promise<void>((resolve, reject) => {
  const ws = new WebSocket(`${BINANCE_WS_BASE}?streams=${streams}`);
  ws.onerror = () => reject(new Error('WebSocket error'));
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    const name = msg.stream.endsWith('@ticker') ? 'ws-ticker.json' : msg.data.k.x ? 'ws-kline-closed.json' : 'ws-kline-open.json';
    if (!wanted.delete(name)) return;
    save(name, msg);
    if (wanted.size === 0) {
      ws.close();
      resolve();
    }
  };
});
