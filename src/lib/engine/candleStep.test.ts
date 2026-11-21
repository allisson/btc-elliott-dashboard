import { describe, expect, it } from 'vitest';
import { candleStep } from './candleStep.ts';

const utc = (y: number, m: number, d = 1, h = 0) => Date.UTC(y, m - 1, d, h) / 1000;

describe('candleStep (§3.1)', () => {
  it.each([
    ['15m', 900],
    ['1h', 3_600],
    ['4h', 14_400],
    ['1d', 86_400],
    ['1w', 604_800],
  ] as const)('%s adds n × its fixed seconds', (tf, seconds) => {
    const t = utc(2026, 11, 16);
    expect(candleStep(tf, t, 0)).toBe(t);
    expect(candleStep(tf, t, 1)).toBe(t + seconds);
    expect(candleStep(tf, t, 7)).toBe(t + 7 * seconds);
  });

  it('1M opens on the first day of the month n months later, whatever the month length', () => {
    expect(candleStep('1M', utc(2026, 1), 1)).toBe(utc(2026, 2)); // 31 days
    expect(candleStep('1M', utc(2026, 2), 1)).toBe(utc(2026, 3)); // 28 days
    expect(candleStep('1M', utc(2028, 2), 1)).toBe(utc(2028, 3)); // 29 days, leap year
    expect(candleStep('1M', utc(2026, 4), 1)).toBe(utc(2026, 5)); // 30 days
    expect(candleStep('1M', utc(2026, 1), 0)).toBe(utc(2026, 1));
  });

  it('1M rolls over the year: December → January, and several years ahead', () => {
    expect(candleStep('1M', utc(2026, 12), 1)).toBe(utc(2027, 1));
    expect(candleStep('1M', utc(2026, 11), 3)).toBe(utc(2027, 2));
    expect(candleStep('1M', utc(2026, 11), 26)).toBe(utc(2029, 1));
  });
});
