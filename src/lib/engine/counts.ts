// Count generation (spec §4.2): candidates from the last K pivots, filtered by the rules (§4.3)
// and scored (§4.4). Pure: pivots in, valid counts out, in anchor order.
import { K, MAX_COUNT_PIVOTS, MIN_COUNT_PIVOTS } from '../../config.ts';
import type { Count, Pivot, WaveLabel, WavePoint } from '../../types.ts';
import { measureRatios, score } from './ratios.ts';
import { checkRules, passesStructure } from './rules.ts';

const LABELS: readonly WaveLabel[] = ['0', '1', '2', '3', '4', '5', 'A', 'B'];

export function findCounts(pivots: readonly Pivot[]): Count[] {
  const counts: Count[] = [];
  const last = pivots.length - 1;

  for (let i = Math.max(0, pivots.length - K); i <= last; i++) {
    const m = last - i + 1;
    if (m < MIN_COUNT_PIVOTS || m > MAX_COUNT_PIVOTS) continue;

    const anchored = pivots.slice(i);
    const s = anchored[0].type === 'trough' ? 1 : -1;
    const prices = anchored.map((p) => p.price);

    const rules = checkRules(prices, s);
    if (rules.some((r) => r.status === 'violated') || !passesStructure(prices, s)) continue;

    const points: WavePoint[] = anchored.map((p, n) => ({
      label: LABELS[n],
      time: p.time,
      price: p.price,
      index: p.index,
      projected: false,
    }));
    const ratios = measureRatios(prices);

    counts.push({
      impulseDirection: s === 1 ? 'bullish' : 'bearish',
      points,
      lastLabel: LABELS[m - 1],
      ratios,
      rules,
      score: score(ratios),
    });
  }

  return counts;
}
