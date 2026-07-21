export type SavingsFrequency = "monthly" | "yearly";

export type RetirementIncomeMethod = "passive" | "fixed" | "dynamic";

export type RetirementSumChoice = "Basic" | "Full" | "Enhanced";

export type CpfLifePlan = "Standard" | "Basic" | "Escalating";

export type CpfWorkStatus = "Employed" | "Self-employed" | "Not contributing";

export type CpfResidencyStatus = "Singapore Citizen" | "Permanent Resident";

export type CpfPrYear = "First Year" | "Second Year" | "Third Year Or Later";

export type CpfPrRateType = "Graduated Employer And Employee" | "Full Employer And Graduated Employee" | "Full Employer And Employee";

export interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  endAge: number;
  currentCashSavings: number;
  currentInvestments: number;
  cashSavingsContribution: number;
  investmentContribution: number;
  contributionFrequency: SavingsFrequency;
  annualContributionIncreaseRate: number;
  cashInterestRate: number;
  preRetirementInvestmentReturnRate: number;
  retirementReturnRate: number;
  passiveIncomeYieldRate: number;
  includeLumpSum: boolean;
  lumpSumAmount: number;
  lumpSumAge: number;
  includeCpf: boolean;
  cpfWorkStatus: CpfWorkStatus;
  cpfResidency: CpfResidencyStatus;
  cpfPrYear: CpfPrYear;
  cpfPrRateType: CpfPrRateType;
  grossMonthlyIncome: number;
  incomeGrowthRate: number;
  selfEmployedAnnualMedisaveOverride: number;
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfOaHousingMonthly: number;
  cpfMaMedicalPremiumAnnual: number;
  cpfOaToRaTransferAt55: number;
  cpfLifeStartAge: number;
  cpfRetirementSum: RetirementSumChoice;
  cpfLifePlan: CpfLifePlan;
  cpfLifeMonthlyOverride: number;
  retirementSpendingAnnual: number;
  retirementSpendingInflationRate: number;
  retirementIncomeMethod: RetirementIncomeMethod;
  fixedWithdrawalAnnual: number;
  dynamicWithdrawalRate: number;
}

export interface RetirementYear {
  age: number;
  yearIndex: number;
  phase: "build-up" | "retirement";
  openingBalance: number;
  openingCashSavings: number;
  openingInvestments: number;
  cashContribution: number;
  investmentContribution: number;
  lumpSum: number;
  savingsInterest: number;
  investmentGrowth: number;
  activeIncomeAnnual: number;
  cpfEmployeeContribution: number;
  cpfEmployerContribution: number;
  cpfTotalContribution: number;
  cpfOaContribution: number;
  cpfSaContribution: number;
  cpfMaContribution: number;
  cpfRaContribution: number;
  medisaveOverflow: number;
  cpfOaHousingUsage: number;
  cpfMaMedicalPremium: number;
  passiveIncomeGenerated: number;
  cpfLifeIncome: number;
  spendingNeed: number;
  cashWithdrawal: number;
  investmentWithdrawal: number;
  cpfSaDrawdown: number;
  cpfOaDrawdown: number;
  cpfDrawdown: number;
  withdrawal: number;
  shortfall: number;
  endingCashSavings: number;
  endingInvestments: number;
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfLifeReserve: number;
  cpfTotal: number;
  selectedCpfRetirementSum: number;
  endingBalance: number;
  funded: boolean;
}

export interface RetirementSummary {
  status: "ready" | "not-ready";
  headline: string;
  readinessPercent: number;
  additionalMonthlyRequired: number;
  extraMonthlyCashSavingsRequired: number;
  extraMonthlyInvestmentRequired: number;
  monthlySpendingReductionRequired: number;
  runwayAge: number;
  finalBalance: number;
  peakBalance: number;
  peakBalanceAge: number;
  totalRetirementNeed: number;
  totalFundedRetirementNeed: number;
  firstShortfallAge: number | null;
  totalContributed: number;
  totalSavingsInterest: number;
  totalGrowth: number;
  totalCpfContributions: number;
  totalWithdrawn: number;
  totalCpfDrawdown: number;
  totalPassiveIncome: number;
  totalCpfLifeIncome: number;
  totalShortfall: number;
  incomeCoverageAtRetirement: number;
  cpfLifeMonthlyAtStart: number;
  cpfRetirementSumAt55: number;
  cpfBasicRetirementSumAt55: number;
  cpfFullRetirementSumAt55: number;
  cpfEnhancedRetirementSumAt55: number;
  projectedCpfRetirementFundingAt55: number;
  projectedCpfOaAt55: number;
  projectedCpfRaAt55: number;
  projectedCpfMaAt55: number;
  cpfRetirementSumShortfallAt55: number;
  cpfRetirementSumExcessAt55: number;
  cpfRetirementSumTierAt55: "Below BRS" | "BRS Met" | "FRS Met" | "ERS Met";
}

export interface RetirementProjection {
  rows: RetirementYear[];
  summary: RetirementSummary;
}
