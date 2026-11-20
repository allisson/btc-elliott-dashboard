// Projections (spec §4.5): the points still to come after a count's last point, with Fibonacci
// prices and times. Pure: a count and the last closed candle in, projected points out.
import { PROJECTION } from '../../config.ts';
import type { Count, WaveLabel, WavePoint } from '../../types.ts';

interface ProjectedLeg {
  label: WaveLabel;
  price: number;
  targetRange?: { min: number; max: number };
}

const range = (a: number, b: number) => ({ min: Math.min(a, b), max: Math.max(a, b) });

// Rule 2 pending (§4.3): Wave 3 shorter than Wave 1 before Wave 5 exists.
export function isRule2Pending(count: Count): boolean {
  const P = count.points.map((p) => p.price);
  const m = P.length;
  return (m === 4 || m === 5) && Math.abs(P[3] - P[2]) < Math.abs(P[1] - P[0]);
}

function projectPrices(count: Count): ProjectedLeg[] {
  const P = count.points.map((p) => p.price);
  const s = count.impulseDirection === 'bullish' ? 1 : -1;
  const W1 = P[1] - P[0];

  const wave5From = (p4: number): number => {
    const p5 = p4 + PROJECTION.w5Extension * W1;
    const w3 = Math.abs(P[3] - P[2]);
    return isRule2Pending(count) && Math.abs(p5 - p4) > w3 ? p4 + s * w3 : p5;
  };
  const wave4From = (p3: number, p2: number) => p3 - PROJECTION.w4Retracement * (p3 - p2);
  const waveC = (pb: number, a: number): ProjectedLeg => ({
    label: 'C',
    price: pb + PROJECTION.cExtension * a,
    targetRange: range(pb + PROJECTION.cRange.min * a, pb + PROJECTION.cRange.max * a),
  });

  switch (count.lastLabel) {
    case '2': {
      const p3 = P[2] + PROJECTION.w3Extension * W1;
      const p4 = wave4From(p3, P[2]);
      return [
        { label: '3', price: p3, targetRange: range(P[2] + PROJECTION.w3Range.min * W1, P[2] + PROJECTION.w3Range.max * W1) },
        { label: '4', price: p4 },
        { label: '5', price: wave5From(p4) },
      ];
    }
    case '3': {
      const p4 = wave4From(P[3], P[2]);
      return [{ label: '4', price: p4 }, { label: '5', price: wave5From(p4) }];
    }
    case '4':
      return [{ label: '5', price: wave5From(P[4]) }];
    case '5': {
      const impulse = P[5] - P[0];
      const pa = P[5] - PROJECTION.aRetracement * impulse;
      const pb = pa + PROJECTION.bRetracement * (P[5] - pa);
      return [
        { label: 'A', price: pa, targetRange: range(P[5] - PROJECTION.aRange.min * impulse, P[5] - PROJECTION.aRange.max * impulse) },
        { label: 'B', price: pb },
        waveC(pb, pa - P[5]),
      ];
    }
    case 'A': {
      const pb = P[6] + PROJECTION.bRetracement * (P[5] - P[6]);
      return [{ label: 'B', price: pb }, waveC(pb, P[6] - P[5])];
    }
    case 'B':
      return [waveC(P[7], P[6] - P[5])];
    default:
      return [];
  }
}

// lastClosedIndex: index of the last closed candle, in the same series as the pivots.
export function project(count: Count, lastClosedIndex: number, timeframeSeconds: number): WavePoint[] {
  const first = count.points[0];
  const last = count.points[count.points.length - 1];
  const mean = Math.max(1, Math.round((last.index! - first.index!) / (count.points.length - 1)));
  const elapsed = lastClosedIndex - last.index!;

  let n = 0;
  return projectPrices(count).map((leg, i) => {
    n += i === 0 ? Math.max(mean, elapsed + 1) : mean;
    return { ...leg, time: last.time + n * timeframeSeconds, index: null, projected: true };
  });
}
