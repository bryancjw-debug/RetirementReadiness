/** Optional overlay for a comparison run. It never changes the saved budget. */
export interface SpendingScenario {
  extraMonthly: number;
  careMonthly: number;
  careStartOffset: number;
  careYears: number;
  lifestyleReductionMonthly: number;
  lifestyleStartOffset: number;
}

export function scenarioBudget(annualBudget: number, year: number, scenario?: SpendingScenario) {
  if (!scenario) return annualBudget;
  const care = year >= scenario.careStartOffset && year < scenario.careStartOffset + scenario.careYears
    ? scenario.careMonthly * 12 : 0;
  const reduction = year >= scenario.lifestyleStartOffset
    ? Math.min(annualBudget, scenario.lifestyleReductionMonthly * 12) : 0;
  return annualBudget + scenario.extraMonthly * 12 + care - reduction;
}
