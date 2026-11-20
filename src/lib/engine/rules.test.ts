import { describe, expect, it } from 'vitest';
import type { RuleCheck, RuleId } from '../../types.ts';
import { checkRules, passesStructure } from './rules.ts';
import * as fx from './__fixtures__/counts.ts';

type Sign = 1 | -1;
const sides = [
  ['bullish', 1, (p: readonly number[]) => [...p]],
  ['bearish', -1, (p: readonly number[]) => p.map((x) => fx.MIRROR - x)],
] as const;

const status = (rules: RuleCheck[]) =>
  Object.fromEntries(rules.map((r) => [r.rule, r.status])) as Record<RuleId, RuleCheck['status']>;

describe.each(sides)('rules (%s)', (_side, s: Sign, side) => {
  it('passes every check on the base count at m = 8', () => {
    expect(status(checkRules(side(fx.BASE), s))).toEqual({ rule1: 'valid', rule2: 'valid', rule3: 'valid' });
    expect(passesStructure(side(fx.BASE), s)).toBe(true);
  });

  it('marks rules that do not apply yet at m = 3', () => {
    expect(status(checkRules(side(fx.BASE).slice(0, 3), s))).toEqual({
      rule1: 'valid', rule2: 'not_yet', rule3: 'not_yet',
    });
  });

  it('violates Rule 1 when P2 reaches P0', () => {
    expect(status(checkRules(side(fx.RULE1_VIOLATED), s)).rule1).toBe('violated');
  });

  it('fails the structural W3 > W1 check when P3 reaches P1', () => {
    expect(passesStructure(side(fx.W3_NOT_BEYOND_W1), s)).toBe(false);
    expect(passesStructure(side(fx.BASE).slice(0, 4), s)).toBe(true);
  });

  it('violates Rule 3 when P4 reaches P1', () => {
    expect(status(checkRules(side(fx.RULE3_VIOLATED), s)).rule3).toBe('violated');
    expect(status(checkRules(side(fx.BASE).slice(0, 5), s)).rule3).toBe('valid');
  });

  it('violates Rule 2 when W3 is shorter than W1 and W1 is the minimum', () => {
    expect(status(checkRules(side(fx.RULE2_W1_SHORTEST_OTHER), s)).rule2).toBe('violated');
  });

  it('violates Rule 2 when W3 is shorter than W5 and W5 is the minimum', () => {
    expect(status(checkRules(side(fx.RULE2_W5_MIN), s)).rule2).toBe('violated');
  });

  it('passes Rule 2 when W3 equals the minimum', () => {
    expect(status(checkRules(side(fx.RULE2_EQUAL), s)).rule2).toBe('valid');
  });

  it('keeps Rule 2 not yet at m = 4 and 5, with the pending detail when W3 < W1', () => {
    for (const prices of [fx.RULE2_PENDING_M4, fx.RULE2_PENDING_M5]) {
      const rule2 = checkRules(side(prices), s).find((r) => r.rule === 'rule2');
      expect(rule2).toEqual({
        rule: 'rule2', status: 'not_yet', detail: 'requires Wave 5 ≤ Wave 3 · W3 90.00 vs W1 100.00',
      });
    }
    const plain = checkRules(side(fx.BASE).slice(0, 5), s).find((r) => r.rule === 'rule2');
    expect(plain).toEqual({ rule: 'rule2', status: 'not_yet', detail: 'len(W3) ≥ min(len(W1), len(W5))' });
  });

  it('fails the structural B check when PB reaches P5', () => {
    expect(passesStructure(side(fx.B_AT_P5), s)).toBe(false);
  });
});

describe('rule details', () => {
  it('shows formula and measured values (bullish)', () => {
    expect(checkRules([...fx.BASE], 1)).toEqual([
      { rule: 'rule1', status: 'valid', detail: 's·(P2 − P0) > 0 · P2 140.00 vs P0 100.00' },
      { rule: 'rule2', status: 'valid', detail: 'len(W3) ≥ min(len(W1), len(W5)) · W3 160.00 vs W1 100.00, W5 100.00' },
      { rule: 'rule3', status: 'valid', detail: 's·(P4 − P1) > 0 · P4 240.00 vs P1 200.00' },
    ]);
  });

  it('shows formula and measured values (bearish)', () => {
    expect(checkRules(fx.BASE.map((p) => fx.MIRROR - p), -1)).toEqual([
      { rule: 'rule1', status: 'valid', detail: 's·(P2 − P0) > 0 · P2 860.00 vs P0 900.00' },
      { rule: 'rule2', status: 'valid', detail: 'len(W3) ≥ min(len(W1), len(W5)) · W3 160.00 vs W1 100.00, W5 100.00' },
      { rule: 'rule3', status: 'valid', detail: 's·(P4 − P1) > 0 · P4 760.00 vs P1 800.00' },
    ]);
  });

  it('shows only the formula for a rule that does not apply yet', () => {
    expect(checkRules([...fx.BASE].slice(0, 3), 1).find((r) => r.rule === 'rule3')?.detail).toBe(
      's·(P4 − P1) > 0',
    );
  });
});
