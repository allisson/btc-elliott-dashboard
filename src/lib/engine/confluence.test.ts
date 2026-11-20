import { describe, expect, it } from 'vitest';
import { confluence } from './confluence.ts';
import { analyses, analysis } from './__fixtures__/confluence.ts';

const B = 'bullish';
const S = 'bearish';

describe('confluence (§8)', () => {
  it.each([B, S] as const)('4/4 %s is Strong Confluence', (d) => {
    expect(confluence(analyses([d, d, d, d]))).toEqual({ agree: 4, majority: d, label: 'strong' });
  });

  it.each([
    [B, [B, B, S, B]],
    [S, [S, B, S, S]],
  ] as const)('3/4 is Mixed Market with the %s majority', (d, votes) => {
    expect(confluence(analyses([...votes]))).toEqual({ agree: 3, majority: d, label: 'mixed' });
  });

  it('3/4 with one Neutral is Mixed Market, not Strong', () => {
    expect(confluence(analyses([B, null, B, B]))).toEqual({ agree: 3, majority: B, label: 'mixed' });
  });

  it('2–2 is Mixed Market, split', () => {
    expect(confluence(analyses([B, S, S, B]))).toEqual({ agree: 2, majority: 'split', label: 'mixed' });
  });

  it.each([
    ['two Neutral', [S, null, S, null]],
    ['one opposite vote and one Neutral', [S, B, null, S]],
  ] as const)('2/4 with %s is Mixed Market with the majority', (_, votes) => {
    expect(confluence(analyses([...votes]))).toEqual({ agree: 2, majority: S, label: 'mixed' });
  });

  it.each([
    ['one vote', [null, B, null, null]],
    ['a 1–1 tie', [B, null, S, null]],
    ['all Neutral (0/4)', [null, null, null, null]],
  ] as const)('%s is No Confluence with no majority', (_, votes) => {
    const agree = votes.filter((v) => v !== null).length > 0 ? 1 : 0;
    expect(confluence(analyses([...votes]))).toEqual({ agree, majority: null, label: 'none' });
  });

  it('ignores the Alternative Scenario', () => {
    const input = {
      '1h': analysis('1h', B, S),
      '4h': analysis('4h', B, S),
      '1d': analysis('1d', B, S),
      '1w': analysis('1w', null, S),
    };
    expect(confluence(input)).toEqual({ agree: 3, majority: B, label: 'mixed' });
  });
});
