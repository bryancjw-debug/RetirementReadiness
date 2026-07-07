export type SavingsFrequency = "monthly" | "yearly";

export type RetirementIncomeMethod = "passive" | "fixed" | "dynamic";

export type RetirementSumChoice = "Basic" | "Full" | "Enhanced";

export type CpfLifePlan = "Standard" | "Basic" | "Escalating";

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
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
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
  passiveIncomeGenerated: number;
  cpfLifeIncome: number;
  spendingNeed: number;
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
  runwayAge: number;
  finalBalance: number;
  peakBalance: number;
  peakBalanceAge: number;
  firstShortfallAge: number | null;
  totalContributed: number;
  totalSavingsInterest: number;
  totalGrowth: number;
  totalWithdrawn: number;
  totalPassiveIncome: number;
  totalCpfLifeIncome: number;
  totalShortfall: number;
  incomeCoverageAtRetirement: number;
  cpfLifeMonthlyAtStart: number;
  cpfRetirementSumAt55: number;
}

export interface RetirementProjection {
  rows: RetirementYear[];
  summary: RetirementSummary;
}
