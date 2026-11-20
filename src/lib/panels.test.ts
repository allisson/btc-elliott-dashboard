import { describe, expect, it } from 'vitest';
import { RISK_DEFAULTS } from '../config.ts';
import type { Confluence, PositionSize, RuleCheck, Scenario, Signal, SignalLevels, Ticker, TimeframeAnalysis } from '../types.ts';
import { findCounts } from './engine/counts.ts';
import { buildScenarios } from './engine/scenarios.ts';
import * as fx from './engine/__fixtures__/counts.ts';
import {
  confluenceBadge,
  fibLines,
  headerStats,
  metricGrid,
  parseStoredRisk,
  riskFromInputs,
  ruleRows,
  scenarioTab,
  scenarioView,
  selectedRank,
  stripCard,
} from './panels.ts';

const H = 3_600;
const scenarioOf = (prices: readonly number[], mirrored = false): Scenario => {
  const list = fx.pivots('trough', prices);
  return buildScenarios(findCounts(mirrored ? fx.mirror(list) : list), 2 * prices.length - 1, H).primary!;
};

const bullish = scenarioOf(fx.BASE.slice(0, 3)); // (0)(1)(2): Setup 1, invalidation P0 = 100
const bearish = scenarioOf(fx.BASE.slice(0, 3), true);
const atWave3 = scenarioOf(fx.BASE.slice(0, 4)); // (3): no setup

const levels: SignalLevels = { setup: 'setup1', side: 'LONG', triggerMet: true, takeProfit1: 200, takeProfit2: 301.8 };
const RISK = 1; // %: the stop sits 1% from the entry (§7)
// Entry 149: risk 1.49, rr1 51 / 1.49 ≥ 1, so Setup 1 is Active.
const quiet = { high: 149, low: 149 };

const analysis = (over: Partial<TimeframeAnalysis> = {}): TimeframeAnalysis => ({
  timeframe: '4h',
  analysedAt: 0,
  primary: bullish,
  alternative: { ...bearish, rank: 'alternative' },
  primaryLevels: levels,
  alternativeLevels: null,
  ...over,
});

const signal = (over: Partial<Signal> = {}): Signal => ({
  ...levels,
  timeframe: '4h',
  entry: 150,
  stopLoss: 148.5,
  rr1: 50 / 1.5,
  rr2: 151.8 / 1.5,
  status: 'ACTIVE',
  ...over,
});

const position: PositionSize = { positionUsd: 1000, positionBtc: 0.01028444, riskUsd: 10, riskPercent: 1 };

describe('scenarioView', () => {
  it('past both targets there is no signal, with the reason', () => {
    const v = scenarioView(analysis(), 'primary', 310, { high: 310, low: 310 }, RISK);
    expect(v.signal).toBeNull();
    expect(v.noSetup).toBe('No setup: both targets passed');
    expect(stripCard(analysis(), 310, { high: 310, low: 310 }, RISK, false).status).toBe('NO SETUP');
  });

  it('past both targets but breached since the close: still Invalidated', () => {
    const v = scenarioView(analysis(), 'primary', 310, { high: 310, low: 99 }, RISK);
    expect(v.signal?.status).toBe('INVALIDATED');
    expect(v.noSetup).toBeNull();
  });

  it('sizes the stop and R:R with the risk per trade', () => {
    // At 190, TP1 is 10 away: 1% risks 1.9 (Active), 10% risks 19 (Watching).
    const at190 = { high: 190, low: 190 };
    expect(scenarioView(analysis(), 'primary', 190, at190, RISK).signal).toMatchObject({ status: 'ACTIVE', stopLoss: 188.1 });
    expect(scenarioView(analysis(), 'primary', 190, at190, 10).signal).toMatchObject({ status: 'WATCHING', stopLoss: 171 });
    expect(stripCard(analysis(), 190, at190, 10, false).status).toBe('WATCHING');
  });

  it('evaluates the selected scenario against the live price and its live rules', () => {
    const v = scenarioView(analysis(), 'primary', 149, quiet, RISK);
    expect(v.scenario).toBe(bullish);
    expect(v.signal).toMatchObject({ status: 'ACTIVE', entry: 149, timeframe: '4h' });
    expect(v.rules.map((r) => r.status)).toEqual(['valid', 'not_yet', 'not_yet']);
    expect(v.noSetup).toBeNull();
  });

  it('marks Rule 1 violated and the signal invalidated after a breach of P0 since the close', () => {
    const v = scenarioView(analysis(), 'primary', 150, { high: 150, low: 99 }, RISK);
    expect(v.signal!.status).toBe('INVALIDATED');
    expect(v.rules[0].status).toBe('violated');
  });

  it('has no signal and a waiting reason for a scenario with no setup', () => {
    const v = scenarioView(analysis({ primary: atWave3, primaryLevels: null }), 'primary', 150, quiet, RISK);
    expect(v.signal).toBeNull();
    expect(v.noSetup).toBe('No setup: waiting for Wave 4 to complete (then Setup 2)');
  });

  it('is empty on a Neutral timeframe', () => {
    const v = scenarioView(analysis({ primary: null, alternative: null, primaryLevels: null }), 'primary', 150, quiet, RISK);
    expect(v).toEqual({ scenario: null, signal: null, rules: [], noSetup: null });
  });
});

describe('selectedRank', () => {
  it('keeps the selection while the Alternative exists and falls back to Primary when it does not', () => {
    expect(selectedRank(analysis(), 'alternative')).toBe('alternative');
    expect(selectedRank(analysis({ alternative: null }), 'alternative')).toBe('primary');
    expect(selectedRank(analysis(), 'primary')).toBe('primary');
  });
});

describe('scenarioTab', () => {
  it('shows the confidence without decimals', () => {
    expect(scenarioTab({ ...bullish, confidence: 83.4 }, 'primary')).toEqual({ label: 'Primary Scenario · 83%', disabled: false });
    expect(scenarioTab({ ...bearish, confidence: 16.6 }, 'alternative')).toEqual({ label: 'Alternative Scenario · 17%', disabled: false });
  });

  it('disables a missing Alternative as unavailable and both tabs on a Neutral timeframe', () => {
    expect(scenarioTab(null, 'alternative')).toEqual({ label: 'Alternative Scenario · unavailable', disabled: true });
    expect(scenarioTab(null, 'primary')).toEqual({ label: 'Primary Scenario', disabled: true });
  });
});

describe('stripCard', () => {
  it('always shows the Primary Scenario, with its signal status', () => {
    const card = stripCard(analysis(), 149, quiet, RISK, false);
    expect(card).toEqual({
      label: '4H',
      direction: 'bullish',
      wave: 'Wave 3 in progress',
      status: 'ACTIVE',
      confidence: `${Math.round(bullish.confidence)}%`,
    });
  });

  it('shows NO SETUP, NEUTRAL and PAUSED', () => {
    expect(stripCard(analysis({ primary: atWave3, primaryLevels: null }), 150, quiet, RISK, false).status).toBe('NO SETUP');
    const neutral = stripCard(analysis({ timeframe: '1w', primary: null, alternative: null, primaryLevels: null }), 150, quiet, RISK, false);
    expect(neutral).toEqual({ label: '1W', direction: null, wave: null, status: 'NEUTRAL', confidence: null });
    expect(stripCard(analysis(), 150, quiet, RISK, true).status).toBe('PAUSED');
  });

  it('keeps NEUTRAL while paused: a Neutral timeframe has no signal to pause', () => {
    expect(stripCard(analysis({ primary: null, alternative: null, primaryLevels: null }), 150, quiet, RISK, true).status).toBe('NEUTRAL');
  });
});

describe('confluenceBadge', () => {
  const c = (agree: number, majority: Confluence['majority'], label: Confluence['label']): Confluence => ({ agree, majority, label });
  it('names the label, the agreement and the majority', () => {
    expect(confluenceBadge(c(4, 'bullish', 'strong'))).toBe('Strong Confluence · 4/4 bullish');
    expect(confluenceBadge(c(4, 'bearish', 'strong'))).toBe('Strong Confluence · 4/4 bearish');
    expect(confluenceBadge(c(3, 'bearish', 'mixed'))).toBe('Mixed Market · 3/4 bearish');
    expect(confluenceBadge(c(2, 'split', 'mixed'))).toBe('Mixed Market · 2/4 split');
    expect(confluenceBadge(c(1, null, 'none'))).toBe('No Confluence · 1/4');
  });
});

describe('metricGrid', () => {
  it('shows every metric with grouped prices, signed Δ% and R:R', () => {
    expect(metricGrid(signal({ entry: 97_234.5, stopLoss: 96_262.155, takeProfit1: 98_500, takeProfit2: 101_000, rr1: 1.02, rr2: 3.06 }), position)).toEqual([
      { label: 'Entry', value: '97,234.50', detail: null },
      { label: 'Stop Loss', value: '96,262.16', detail: '-1.00%' },
      { label: 'TP1', value: '98,500.00', detail: '+1.30% · R:R 1:1.0' },
      { label: 'TP2', value: '101,000.00', detail: '+3.87% · R:R 1:3.1' },
      { label: 'Position', value: '1,000.00 USDT', detail: '0.01028 BTC' },
      { label: 'Risk', value: '10.00 USDT', detail: '1.00% of capital' },
    ]);
  });

  it('drops the entry-derived metrics of an Invalidated signal, the stop among them, and keeps the targets', () => {
    expect(metricGrid(signal({ status: 'INVALIDATED' }), position)).toEqual([
      { label: 'Entry', value: '—', detail: null },
      { label: 'Stop Loss', value: '—', detail: null },
      { label: 'TP1', value: '200.00', detail: null },
      { label: 'TP2', value: '301.80', detail: null },
      { label: 'Position', value: '—', detail: null },
      { label: 'Risk', value: '—', detail: null },
    ]);
  });

  it('mirrors for a SHORT', () => {
    const short = signal({ side: 'SHORT', entry: 100, stopLoss: 110, takeProfit1: 90, takeProfit2: 80, rr1: 1, rr2: 2 });
    expect(metricGrid(short, position).slice(1, 4).map((m) => m.detail)).toEqual(['+10.00%', '-10.00% · R:R 1:1.0', '-20.00% · R:R 1:2.0']);
  });

  it('drops a target the price already passed (SHORT past TP1)', () => {
    const short = signal({ side: 'SHORT', status: 'WATCHING', entry: 100, stopLoss: 110, takeProfit1: 101, takeProfit2: 80, rr1: -0.1, rr2: 2 });
    expect(metricGrid(short, position).map((m) => m.label)).toEqual(['Entry', 'Stop Loss', 'TP2', 'Position', 'Risk']);
    expect(metricGrid(short, position)[2].detail).toBe('-20.00% · R:R 1:2.0');
  });
});

describe('ruleRows', () => {
  it('names each rule with its status and keeps the measured detail', () => {
    const rules: RuleCheck[] = [
      { rule: 'rule1', status: 'valid', detail: 's·(P2 − P0) > 0 · P2 98.00 vs P0 95.00' },
      { rule: 'rule2', status: 'not_yet', detail: 'requires Wave 5 ≤ Wave 3' },
      { rule: 'rule3', status: 'violated', detail: 'x' },
    ];
    expect(ruleRows(rules)).toEqual([
      { name: 'Rule 1: Wave 2 does not retrace past the start of Wave 1', status: 'VALID', detail: rules[0].detail },
      { name: 'Rule 2: Wave 3 is not the shortest', status: 'NOT YET', detail: rules[1].detail },
      { name: 'Rule 3: Wave 4 does not overlap Wave 1', status: 'VIOLATED', detail: 'x' },
    ]);
  });
});

describe('fibLines', () => {
  it('lists the measured ratios in wave order with 3 decimals', () => {
    expect(
      fibLines({ bRetracement: 0.5, w3Extension: 1.6184, w2Retracement: 0.618, aRetracement: 0.382, w5Extension: 1, w4Retracement: 0.38 }),
    ).toEqual([
      'Wave 2: 0.618 retracement',
      'Wave 3: 1.618× extension',
      'Wave 4: 0.380 retracement',
      'Wave 5: 1.000× extension',
      'Wave A: 0.382 retracement',
      'Wave B: 0.500 retracement',
    ]);
  });

  it('skips ratios not yet measured', () => {
    expect(fibLines({ w2Retracement: 0.5 })).toEqual(['Wave 2: 0.500 retracement']);
  });
});

describe('headerStats', () => {
  const ticker: Ticker = { price: 61_467.07, change24h: -2265.46, changePercent24h: -3.556, high24h: 64_080, low24h: 61_230, volume24h: 1 };
  it('signs the 24h change and groups the prices', () => {
    expect(headerStats(ticker)).toEqual({ price: '61,467.07', change: '-2,265.46 (-3.56%)', up: false, high: 'H 64,080.00', low: 'L 61,230.00' });
  });

  it('marks a rise with +', () => {
    expect(headerStats({ ...ticker, change24h: 12.5, changePercent24h: 0.02 })).toMatchObject({ change: '+12.50 (+0.02%)', up: true });
  });
});

describe('risk inputs', () => {
  it('uses the typed values when valid', () => {
    expect(riskFromInputs({ capital: '2500', riskPercent: '0.5' })).toEqual({
      settings: { capital: 2500, riskPercent: 0.5 },
      capitalInvalid: false,
      riskInvalid: false,
    });
  });

  it('falls back to the default per field when empty, not a number or out of range', () => {
    for (const capital of ['', '  ', 'abc', '0', '-5', '1,000']) {
      const r = riskFromInputs({ capital, riskPercent: '2' });
      expect(r).toEqual({ settings: { capital: RISK_DEFAULTS.capital, riskPercent: 2 }, capitalInvalid: true, riskInvalid: false });
    }
    for (const riskPercent of ['15', '0.05', '', 'x']) {
      expect(riskFromInputs({ capital: '500', riskPercent })).toMatchObject({ settings: { capital: 500, riskPercent: RISK_DEFAULTS.riskPercent }, riskInvalid: true });
    }
  });

  it('accepts the range bounds inclusively', () => {
    expect(riskFromInputs({ capital: '1', riskPercent: '0.1' }).riskInvalid).toBe(false);
    expect(riskFromInputs({ capital: '1', riskPercent: '10' }).riskInvalid).toBe(false);
  });

  it('reads the stored text, and the defaults when nothing usable is stored', () => {
    const defaults = { capital: String(RISK_DEFAULTS.capital), riskPercent: String(RISK_DEFAULTS.riskPercent) };
    expect(parseStoredRisk(JSON.stringify({ capital: 'abc', riskPercent: '15' }))).toEqual({ capital: 'abc', riskPercent: '15' });
    expect(parseStoredRisk(null)).toEqual(defaults);
    expect(parseStoredRisk('not json')).toEqual(defaults);
    expect(parseStoredRisk(JSON.stringify({ capital: 3 }))).toEqual(defaults);
    expect(parseStoredRisk(JSON.stringify({ capital: '3' }))).toEqual({ capital: '3', riskPercent: defaults.riskPercent });
  });
});
