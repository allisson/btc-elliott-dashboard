import { describe, expect, it } from 'vitest';
import { TIMEFRAMES } from './config.ts';

describe('config', () => {
  it('declares the four timeframes of spec §3.1 with their ZigZag thresholds', () => {
    expect(TIMEFRAMES.map((t) => [t.id, t.label, t.seconds, t.zigzagThreshold])).toEqual([
      ['1h', '1H', 3_600, 0.018],
      ['4h', '4H', 14_400, 0.032],
      ['1d', '1D', 86_400, 0.055],
      ['1w', '1W', 604_800, 0.095],
    ]);
  });
});
