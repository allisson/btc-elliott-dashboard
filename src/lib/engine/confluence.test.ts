import { describe, expect, it } from 'vitest';
import { confluence } from './confluence.ts';
import { analyses, analysis } from './__fixtures__/confluence.ts';

const B = 'bullish';
const S = 'bearish';

describe('confluence (§8)', () => {
  it.each([B, S] as const)('6/6 %s is Strong Confluence', (d) => {
    expect(confluence(analyses([d, d, d, d, d, d]))).toEqual({ agree: 6, majority: d, label: 'strong' });
  });

  it.each([
    [B, [B, B, S, B, B, B]],
    [S, [S, S, S, B, S, S]],
  ] as const)('5/6 is Mixed Market with the %s majority', (d, votes) => {
    expect(confluence(analyses([...votes]))).toEqual({ agree: 5, majority: d, label: 'mixed' });
  });

  it('5/6 with one Neutral is Mixed Market, not Strong', () => {
    expect(confluence(analyses([B, B, B, B, B, null]))).toEqual({ agree: 5, majority: B, label: 'mixed' });
  });

  it('4/6 is Mixed Market with the majority', () => {
    expect(confluence(analyses([S, B, S, S, B, S]))).toEqual({ agree: 4, majority: S, label: 'mixed' });
  });

  it('3–3 is Mixed Market, split', () => {
    expect(confluence(analyses([B, S, S, B, B, S]))).toEqual({ agree: 3, majority: 'split', label: 'mixed' });
  });

  it.each([
    ['three Neutral', [S, null, S, null, S, null]],
    ['two opposite votes and one Neutral', [S, B, null, S, B, S]],
  ] as const)('3/6 with %s is Mixed Market with the majority', (_, votes) => {
    expect(confluence(analyses([...votes]))).toEqual({ agree: 3, majority: S, label: 'mixed' });
  });

  it.each([
    ['two votes', [null, B, null, B, null, null], 2],
    ['a 2–2 tie', [B, null, S, S, null, B], 2],
    ['a 1–1 tie', [B, null, S, null, null, null], 1],
    ['all Neutral (0/6)', [null, null, null, null, null, null], 0],
  ] as const)('%s is No Confluence with no majority', (_, votes, agree) => {
    expect(confluence(analyses([...votes]))).toEqual({ agree, majority: null, label: 'none' });
  });

  it('ignores the Alternative Scenario', () => {
    const input = {
      '15m': analysis('15m', B, S),
      '1h': analysis('1h', B, S),
      '4h': analysis('4h', B, S),
      '1d': analysis('1d', null, S),
      '1w': analysis('1w', null, S),
      '1M': analysis('1M', null, S),
    };
    expect(confluence(input)).toEqual({ agree: 3, majority: B, label: 'mixed' });
  });
});
