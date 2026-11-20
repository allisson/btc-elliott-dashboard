// Position sizing (spec §7): 1x, the whole capital; the stop sits risk% from the entry, so hitting it
// loses risk% of the capital. Pure.
import { RISK_DEFAULTS, RISK_LIMITS } from '../../config.ts';
import type { PositionSize, RiskSettings } from '../../types.ts';

// Empty, invalid or out-of-range inputs fall back to the default; they are not clamped.
export function sanitizeRiskSettings(raw: { capital?: number; riskPercent?: number }): RiskSettings {
  const { capital, riskPercent } = raw;
  const capitalOk = capital !== undefined && Number.isFinite(capital) && capital > RISK_LIMITS.minCapital;
  const riskOk =
    riskPercent !== undefined &&
    Number.isFinite(riskPercent) &&
    riskPercent >= RISK_LIMITS.minRiskPercent &&
    riskPercent <= RISK_LIMITS.maxRiskPercent;
  return {
    capital: capitalOk ? capital : RISK_DEFAULTS.capital,
    riskPercent: riskOk ? riskPercent : RISK_DEFAULTS.riskPercent,
  };
}

export function positionSize(settings: RiskSettings, entry: number): PositionSize {
  return {
    positionUsd: settings.capital,
    positionBtc: settings.capital / entry,
    riskUsd: (settings.capital * settings.riskPercent) / 100,
    riskPercent: settings.riskPercent,
  };
}
