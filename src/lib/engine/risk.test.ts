import { describe, expect, it } from 'vitest';
import { positionSize, sanitizeRiskSettings } from './risk.ts';

describe('positionSize', () => {
  it('commits the whole capital and risks risk% of it at the stop', () => {
    const p = positionSize({ capital: 1000, riskPercent: 1 }, 50_000);
    expect(p).toEqual({ positionUsd: 1000, positionBtc: 0.02, riskUsd: 10, riskPercent: 1 });
  });

  it('scales the risk with the risk per trade, not the position', () => {
    const p = positionSize({ capital: 250, riskPercent: 4 }, 100);
    expect(p).toEqual({ positionUsd: 250, positionBtc: 2.5, riskUsd: 10, riskPercent: 4 });
  });
});

describe('sanitizeRiskSettings', () => {
  it('keeps valid values, bounds included', () => {
    expect(sanitizeRiskSettings({ capital: 250, riskPercent: 0.1 })).toEqual({ capital: 250, riskPercent: 0.1 });
    expect(sanitizeRiskSettings({ capital: 0.01, riskPercent: 10 })).toEqual({ capital: 0.01, riskPercent: 10 });
  });

  it('falls back to the defaults when empty', () => {
    expect(sanitizeRiskSettings({})).toEqual({ capital: 1000, riskPercent: 1 });
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('falls back to the default capital for %s', (capital) => {
    expect(sanitizeRiskSettings({ capital, riskPercent: 2 })).toEqual({ capital: 1000, riskPercent: 2 });
  });

  it.each([0.09, 15, -1, Number.NaN])('falls back to the default risk for %s, without clamping', (riskPercent) => {
    expect(sanitizeRiskSettings({ capital: 500, riskPercent })).toEqual({ capital: 500, riskPercent: 1 });
  });
});
