// Elliott rules and structural checks (spec §4.3). Pure: a count's prices and s in, checks out.
import { DETAIL_DECIMALS } from '../../config.ts';
import type { RuleCheck } from '../../types.ts';

type Sign = 1 | -1;

const fmt = (x: number) => x.toFixed(DETAIL_DECIMALS);
const status = (ok: boolean): RuleCheck['status'] => (ok ? 'valid' : 'violated');

const RULE1 = 's·(P2 − P0) > 0';
const RULE2 = 'len(W3) ≥ min(len(W1), len(W5))';
const RULE2_PENDING = 'requires Wave 5 ≤ Wave 3';
const RULE3 = 's·(P4 − P1) > 0';

// prices = P0, P1, … in count order; m = prices.length (3…8).
export function checkRules(prices: readonly number[], s: Sign): RuleCheck[] {
  const P = prices;
  const m = P.length;
  const len = (n: number) => Math.abs(P[n] - P[n - 1]);

  const rule1: RuleCheck = {
    rule: 'rule1',
    status: status(s * (P[2] - P[0]) > 0),
    detail: `${RULE1} · P2 ${fmt(P[2])} vs P0 ${fmt(P[0])}`,
  };

  let rule2: RuleCheck;
  if (m >= 6) {
    rule2 = {
      rule: 'rule2',
      status: status(len(3) >= Math.min(len(1), len(5))),
      detail: `${RULE2} · W3 ${fmt(len(3))} vs W1 ${fmt(len(1))}, W5 ${fmt(len(5))}`,
    };
  } else if (m >= 4 && len(3) < len(1)) {
    rule2 = { rule: 'rule2', status: 'not_yet', detail: `${RULE2_PENDING} · W3 ${fmt(len(3))} vs W1 ${fmt(len(1))}` };
  } else {
    rule2 = { rule: 'rule2', status: 'not_yet', detail: RULE2 };
  }

  const rule3: RuleCheck =
    m >= 5
      ? { rule: 'rule3', status: status(s * (P[4] - P[1]) > 0), detail: `${RULE3} · P4 ${fmt(P[4])} vs P1 ${fmt(P[1])}` }
      : { rule: 'rule3', status: 'not_yet', detail: RULE3 };

  return [rule1, rule2, rule3];
}

// Structural checks with no checklist entry: Wave 3 beyond Wave 1, Wave B short of the Wave 5 extreme.
export function passesStructure(prices: readonly number[], s: Sign): boolean {
  const P = prices;
  const m = P.length;
  if (m >= 4 && !(s * (P[3] - P[1]) > 0)) return false;
  if (m >= 8 && !(s * (P[5] - P[7]) > 0)) return false;
  return true;
}
