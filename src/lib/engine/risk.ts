// Position sizing (spec §7): the stop stays at the setup's level; the position is sized to it,
// never above capital (1x). Pure.
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

export function positionSize(settings: RiskSettings, entry: number, stopLoss: number): PositionSize {
  const riskUsd = (settings.capital * settings.riskPercent) / 100;
  const stopDistance = Math.abs(entry - stopLoss) / entry;
  const positionUsd = Math.min(riskUsd / stopDistance, settings.capital);
  const actualRiskUsd = positionUsd * stopDistance;
  return {
    positionUsd,
    positionBtc: positionUsd / entry,
    actualRiskUsd,
    actualRiskPercent: (actualRiskUsd / settings.capital) * 100,
    capped: positionUsd === settings.capital,
  };
}
