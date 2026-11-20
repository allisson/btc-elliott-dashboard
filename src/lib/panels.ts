// What the header, confluence strip and signal panel show (spec §7, §9.2, §9.3, §9.5). Pure; the
// components only render it.
import { FIB_DECIMALS, RISK_DEFAULTS, TIMEFRAMES } from '../config.ts';
import type {
  Confluence,
  Direction,
  FibRatios,
  PositionSize,
  RiskSettings,
  RuleCheck,
  RuleId,
  Scenario,
  Signal,
  Ticker,
  TimeframeAnalysis,
} from '../types.ts';
import { sanitizeRiskSettings } from './engine/risk.ts';
import { deltaPercent, evaluateSignal, liveRules, noSetupReason, TARGETS_PASSED, type OpenCandle } from './engine/setups.ts';
import { formatBtc, formatConfidence, formatDeltaPercent, formatPercent, formatPrice, formatRR, formatUsdt } from './format.ts';

export type Rank = Scenario['rank'];

const label = (timeframe: TimeframeAnalysis['timeframe']) => TIMEFRAMES.find((t) => t.id === timeframe)!.label;

// §9.5: a selected Alternative that no longer exists falls back to Primary.
export const selectedRank = (analysis: TimeframeAnalysis, rank: Rank): Rank =>
  rank === 'alternative' && !analysis.alternative ? 'primary' : rank;

export interface ScenarioView {
  scenario: Scenario | null; // null = Neutral
  signal: Signal | null; // null = no setup
  rules: RuleCheck[];
  noSetup: string | null;
}

// One scenario of a timeframe against the live price and its open candle (§4.3, §6.4).
export function scenarioView(analysis: TimeframeAnalysis, rank: Rank, price: number, openCandle: OpenCandle): ScenarioView {
  const scenario = rank === 'primary' ? analysis.primary : analysis.alternative;
  if (!scenario) return { scenario: null, signal: null, rules: [], noSetup: null };
  const levels = rank === 'primary' ? analysis.primaryLevels : analysis.alternativeLevels;
  const signal = levels && evaluateSignal(scenario, levels, analysis.timeframe, price, openCandle);
  // §6.4: past both targets the signal is spent; an Invalidated one stays visible.
  const spent = signal !== null && signal.status !== 'INVALIDATED' && signal.rr2 <= 0;
  return {
    scenario,
    signal: spent ? null : signal,
    rules: liveRules(scenario, price, openCandle),
    noSetup: spent ? TARGETS_PASSED : noSetupReason(scenario),
  };
}

export function scenarioTab(scenario: Scenario | null, rank: Rank): { label: string; disabled: boolean } {
  const name = rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario';
  if (scenario) return { label: `${name} · ${formatConfidence(scenario.confidence)}`, disabled: false };
  return { label: rank === 'alternative' ? `${name} · unavailable` : name, disabled: true };
}

export interface StripCard {
  label: string;
  direction: Direction | null;
  wave: string | null;
  status: Signal['status'] | 'NO SETUP' | 'NEUTRAL' | 'PAUSED';
  confidence: string | null;
}

// §9.3: always the Primary Scenario, like the confluence vote.
export function stripCard(analysis: TimeframeAnalysis, price: number, openCandle: OpenCandle, paused: boolean): StripCard {
  const { scenario, signal } = scenarioView(analysis, 'primary', price, openCandle);
  if (!scenario) return { label: label(analysis.timeframe), direction: null, wave: null, status: 'NEUTRAL', confidence: null };
  return {
    label: label(analysis.timeframe),
    direction: scenario.direction,
    wave: scenario.waveInProgress,
    status: paused ? 'PAUSED' : signal ? signal.status : 'NO SETUP',
    confidence: formatConfidence(scenario.confidence),
  };
}

const CONFLUENCE_NAMES: Record<Confluence['label'], string> = { strong: 'Strong Confluence', mixed: 'Mixed Market', none: 'No Confluence' };

export function confluenceBadge(c: Confluence): string {
  const agreement = `${c.agree}/${TIMEFRAMES.length}`;
  return `${CONFLUENCE_NAMES[c.label]} · ${c.majority ? `${agreement} ${c.majority}` : agreement}`;
}

export interface Metric {
  label: string;
  value: string;
  detail: string | null;
}

// §9.5: an Invalidated signal keeps its levels and drops what derives from the entry (§6.4).
export function metricGrid(signal: Signal, position: PositionSize): Metric[] {
  const dead = signal.status === 'INVALIDATED';
  const delta = (x: number) => formatDeltaPercent(deltaPercent(x, signal.entry));
  const level = (name: string, price: number, rr: number | null): Metric => ({
    label: name,
    value: formatPrice(price),
    detail: dead ? null : rr === null ? delta(price) : `${delta(price)} · ${formatRR(rr)}`,
  });
  const dash = (name: string): Metric => ({ label: name, value: '—', detail: null });
  const capped = position.capped ? ' (capped by capital)' : '';

  return [
    dead ? dash('Entry') : { label: 'Entry', value: formatPrice(signal.entry), detail: null },
    level('Stop Loss', signal.stopLoss, null),
    // §6.4: a target the price already passed is dropped.
    ...(signal.rr1 > 0 ? [level('TP1', signal.takeProfit1, signal.rr1)] : []),
    ...(signal.rr2 > 0 ? [level('TP2', signal.takeProfit2, signal.rr2)] : []),
    dead ? dash('Position') : { label: 'Position', value: `${formatUsdt(position.positionUsd)} USDT`, detail: `${formatBtc(position.positionBtc)} BTC` },
    dead
      ? dash('Risk')
      : {
          label: 'Risk',
          value: `${formatUsdt(position.actualRiskUsd)} USDT`,
          detail: `${formatPercent(position.actualRiskPercent)}% of capital${capped}`,
        },
  ];
}

// §4.3
const RULE_NAMES: Record<RuleId, string> = {
  rule1: 'Rule 1: Wave 2 does not retrace past the start of Wave 1',
  rule2: 'Rule 2: Wave 3 is not the shortest',
  rule3: 'Rule 3: Wave 4 does not overlap Wave 1',
};
const RULE_STATUS: Record<RuleCheck['status'], string> = { valid: 'VALID', violated: 'VIOLATED', not_yet: 'NOT YET' };

export const ruleRows = (rules: readonly RuleCheck[]) =>
  rules.map((r) => ({ name: RULE_NAMES[r.rule], status: RULE_STATUS[r.status], detail: r.detail }));

const FIB_LINES: [keyof FibRatios, string, 'retracement' | 'extension'][] = [
  ['w2Retracement', 'Wave 2', 'retracement'],
  ['w3Extension', 'Wave 3', 'extension'],
  ['w4Retracement', 'Wave 4', 'retracement'],
  ['w5Extension', 'Wave 5', 'extension'],
  ['aRetracement', 'Wave A', 'retracement'],
  ['bRetracement', 'Wave B', 'retracement'],
];

export const fibLines = (ratios: FibRatios): string[] =>
  FIB_LINES.filter(([key]) => ratios[key] !== undefined).map(([key, wave, kind]) => {
    const value = ratios[key]!.toFixed(FIB_DECIMALS);
    return kind === 'extension' ? `${wave}: ${value}× ${kind}` : `${wave}: ${value} ${kind}`;
  });

// §9.2
export function headerStats(ticker: Ticker) {
  const up = ticker.change24h >= 0;
  return {
    price: formatPrice(ticker.price),
    change: `${up ? '+' : '-'}${formatUsdt(Math.abs(ticker.change24h))} (${formatDeltaPercent(ticker.changePercent24h)})`,
    up,
    high: `H ${formatPrice(ticker.high24h)}`,
    low: `L ${formatPrice(ticker.low24h)}`,
  };
}

// §7, §9.5: the fields keep the text as typed; the value in use falls back per field.
export interface RiskInputs {
  capital: string;
  riskPercent: string;
}

const parseNumber = (text: string): number | undefined => (text.trim() === '' ? undefined : Number(text));

export function riskFromInputs(inputs: RiskInputs): { settings: RiskSettings; capitalInvalid: boolean; riskInvalid: boolean } {
  const capital = parseNumber(inputs.capital);
  const riskPercent = parseNumber(inputs.riskPercent);
  const settings = sanitizeRiskSettings({ capital, riskPercent });
  return { settings, capitalInvalid: settings.capital !== capital, riskInvalid: settings.riskPercent !== riskPercent };
}

export function parseStoredRisk(raw: string | null): RiskInputs {
  const defaults = { capital: String(RISK_DEFAULTS.capital), riskPercent: String(RISK_DEFAULTS.riskPercent) };
  try {
    const stored: unknown = JSON.parse(raw ?? 'null');
    if (typeof stored !== 'object' || stored === null) return defaults;
    const { capital, riskPercent } = stored as Record<string, unknown>;
    return {
      capital: typeof capital === 'string' ? capital : defaults.capital,
      riskPercent: typeof riskPercent === 'string' ? riskPercent : defaults.riskPercent,
    };
  } catch {
    return defaults;
  }
}
