import type { RetirementInputs } from "../types";

const MAX_COMPLEXITY_POINTS = 14;

export function projectionComplexityPoints(inputs: RetirementInputs) {
  return [
    inputs.currentCashSavings > 0 || inputs.currentInvestments > 0,
    inputs.cashSavingsContribution > 0 || inputs.investmentContribution > 0,
    inputs.includeCpf,
    inputs.includeCpf && inputs.cpfOa + inputs.cpfSa + inputs.cpfMa + inputs.cpfRa > 0,
    inputs.includeCpf && (inputs.cpfOaHousingMonthly > 0 || Boolean(inputs.insuranceEstimate?.enabled)),
    Boolean(inputs.retirementTopUp?.enabled),
    inputs.includeSrs,
    inputs.includeSrs && (inputs.srsCurrentBalance > 0 || inputs.srsAnnualContribution > 0),
    inputs.customIncomeStreams.length > 0,
    inputs.includeOneTimeEvents && inputs.oneTimeEvents.length > 0,
    (inputs.spendingProfile?.dependants.length ?? 0) > 0,
    (inputs.investmentMix?.length ?? 0) > 0,
    (inputs.retirementInvestmentMix?.length ?? 0) > 0,
    (inputs.otherTaxableIncome?.annualAmount ?? 0) > 0
  ].filter(Boolean).length;
}

export function projectionProcessingDuration(inputs: RetirementInputs | RetirementInputs[]) {
  const plans = Array.isArray(inputs) ? inputs : [inputs];
  const points = plans.reduce((sum, plan) => sum + projectionComplexityPoints(plan), 0);
  const availablePoints = MAX_COMPLEXITY_POINTS * plans.length;
  const duration = 2_000 + Math.round((points / availablePoints) * 3_000);
  return Math.round(Math.min(5_000, Math.max(2_000, duration)) / 100) * 100;
}
