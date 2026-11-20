// Number formatting and the Copy Setup text (spec §9.5, §9.6). Pure.
import { DISPLAY_DECIMALS, TIMEFRAMES } from '../config.ts';
import type { PositionSize, Scenario, SetupId, Signal } from '../types.ts';

export const SETUP_NAMES: Record<SetupId, string> = {
  setup1: 'Setup 1 (Wave 2→3)',
  setup2: 'Setup 2 (Wave 4→5)',
  setup3a: 'Setup 3a (Wave 5 exhaustion)',
  setup3b: 'Setup 3b (Wave B→C)',
};

// The UI groups thousands (97,234.50); Copy Setup does not (97234.50), so it pastes into an order form.
const number = (x: number, decimals: number, grouped: boolean) =>
  grouped
    ? x.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : x.toFixed(decimals);

export const formatPrice = (x: number, grouped = true) => number(x, DISPLAY_DECIMALS.price, grouped);
export const formatUsdt = (x: number, grouped = true) => number(x, DISPLAY_DECIMALS.usdt, grouped);
export const formatBtc = (x: number) => x.toFixed(DISPLAY_DECIMALS.btc);
export const formatPercent = (x: number) => x.toFixed(DISPLAY_DECIMALS.percent);
// §6.3: a target at or behind the entry has no reward left.
export const formatRR = (x: number) => (x > 0 ? `R:R 1:${x.toFixed(DISPLAY_DECIMALS.rr)}` : 'passed');
export const formatConfidence = (x: number) => `${x.toFixed(DISPLAY_DECIMALS.confidence)}%`;

// Signed with ASCII + and -; a value that rounds to zero is +0.00%.
export function formatDeltaPercent(x: number): string {
  const abs = Math.abs(x).toFixed(DISPLAY_DECIMALS.percent);
  const negative = x < 0 && Number(abs) !== 0;
  return `${negative ? '-' : '+'}${abs}%`;
}

// ms since epoch → `YYYY-MM-DD HH:mm UTC`.
export const formatUtc = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

// ms since epoch → `HH:mm UTC`.
export const formatUtcTime = (ms: number) => `${new Date(ms).toISOString().slice(11, 16)} UTC`;

// §3.4, §9.0: shown wherever signals are hidden while the stream is down.
export const pausedNotice = (since: number) => `Signals paused: data stale since ${formatUtcTime(since)}`;

export interface CopySetupInput {
  signal: Signal;
  scenario: Pick<Scenario, 'rank' | 'confidence' | 'invalidationReason' | 'invalidationPrice'>;
  position: PositionSize;
  capital: number;
  generatedAt: number; // ms since epoch
}

// §9.6: plain text, or null for an Invalidated signal (Copy Setup is disabled).
export function copySetupText({ signal, scenario, position, capital, generatedAt }: CopySetupInput): string | null {
  if (signal.status === 'INVALIDATED') return null;
  const price = (x: number) => formatPrice(x, false);
  const delta = (x: number) => formatDeltaPercent(((x - signal.entry) / signal.entry) * 100);
  const tf = TIMEFRAMES.find((t) => t.id === signal.timeframe)!.label;
  const rank = scenario.rank === 'primary' ? 'Primary Scenario' : 'Alternative Scenario';
  const capped = position.capped ? ' (capped by capital)' : '';

  return [
    `BTC/USDT · ${tf} · ${signal.side} 1x · ${SETUP_NAMES[signal.setup]}`,
    `Status: ${signal.status} · ${rank} (${formatConfidence(scenario.confidence)})`,
    `Entry:       ${price(signal.entry)}`,
    `Stop Loss:   ${price(signal.stopLoss)}  (${delta(signal.stopLoss)})`,
    `TP1:         ${price(signal.takeProfit1)}  (${delta(signal.takeProfit1)})  ${formatRR(signal.rr1)}`,
    `TP2:         ${price(signal.takeProfit2)}  (${delta(signal.takeProfit2)})  ${formatRR(signal.rr2)}`,
    `Position:    ${formatUsdt(position.positionUsd, false)} USDT (${formatBtc(position.positionBtc)} BTC) of ${formatUsdt(capital, false)} USDT`,
    `Risk:        ${formatUsdt(position.actualRiskUsd, false)} USDT (${formatPercent(position.actualRiskPercent)}% of capital)${capped}`,
    `Invalidation: ${scenario.invalidationReason} at ${price(scenario.invalidationPrice)}`,
    `Generated: ${formatUtc(generatedAt)}`,
    'Not financial advice. 1x, no leverage.',
  ].join('\n');
}
