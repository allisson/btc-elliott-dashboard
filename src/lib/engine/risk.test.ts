import { describe, expect, it } from 'vitest';
import { positionSize, sanitizeRiskSettings } from './risk.ts';

describe('positionSize', () => {
  it('sizes the position so the stop loses exactly the risk per trade', () => {
    // risk 10 USDT; stop distance 40.5 / 140.
    const p = positionSize({ capital: 1000, riskPercent: 1 }, 140, 99.5);
    expect(p.positionUsd).toBeCloseTo(10 / (40.5 / 140), 9);
    expect(p.positionBtc).toBeCloseTo(10 / 40.5, 9);
    expect(p.actualRiskUsd).toBeCloseTo(10, 9);
    expect(p.actualRiskPercent).toBeCloseTo(1, 9);
    expect(p.capped).toBe(false);
  });

  it('sizes a SHORT the same way (stop above entry)', () => {
    const p = positionSize({ capital: 1000, riskPercent: 1 }, 860, 904.5);
    expect(p.actualRiskUsd).toBeCloseTo(10, 9);
    expect(p.capped).toBe(false);
  });

  it('caps the position at capital and reports the lower actual risk', () => {
    // risk 100 USDT over a 0.5% stop would need 20,000 USDT.
    const p = positionSize({ capital: 1000, riskPercent: 10 }, 100, 99.5);
    expect(p.positionUsd).toBe(1000);
    expect(p.positionBtc).toBe(10);
    expect(p.actualRiskUsd).toBeCloseTo(5, 9);
    expect(p.actualRiskPercent).toBeCloseTo(0.5, 9);
    expect(p.capped).toBe(true);
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
