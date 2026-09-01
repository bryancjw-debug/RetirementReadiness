import type {
  CpfLifePlan,
  CpfPrRateType,
  CpfPrYear,
  CpfResidencyStatus,
  CpfWorkStatus,
  CustomIncomeStream,
  OneTimeFinancialEvent,
  RetirementInputs,
  RetirementLifestylePreset,
  RetirementSumChoice
} from "./types";

export type SpendingPath = "known" | "guided" | null;
export type GuidedLifestyle = "Essential" | "Comfortable" | "More flexibility";
export type SpendingBasis = "individual" | "household";
export type ContributionApproach = "cash" | "invest" | "both" | "occasional" | "none" | null;

export interface OnboardingAnswers {
  preferredName: string;
  currentAge: number;
  retirementAge: number;
  spendingPath: SpendingPath;
  spendingBasis: SpendingBasis;
  guidedLifestyle: GuidedLifestyle;
  monthlySpendingToday: number;
  currentCashSavings: number;
  currentInvestments: number;
  contributionApproach: ContributionApproach;
  monthlyCashContribution: number;
  monthlyInvestmentContribution: number;
  includeCpf: boolean;
  cpfResidency: CpfResidencyStatus;
  cpfPrYear: CpfPrYear;
  cpfPrRateType: CpfPrRateType;
  cpfWorkStatus: CpfWorkStatus;
  grossMonthlyIncome: number;
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfLifeStartAge: number;
  cpfRetirementSum: RetirementSumChoice;
  cpfLifePlan: CpfLifePlan;
  cpfLifeMonthlyOverride: number;
  includeOneTimeEvents: boolean;
  oneTimeEvents: OneTimeFinancialEvent[];
  includeOtherIncome: boolean;
  customIncomeStreams: CustomIncomeStream[];
  refineAssumptions: boolean;
  endAge: number;
  retirementSpendingInflationRate: number;
  cashInterestRate: number;
  preRetirementInvestmentReturnRate: number;
  retirementReturnRate: number;
  annualContributionIncreaseRate: number;
}

export const guidedLifestyleOptions: Array<{
  id: GuidedLifestyle;
  monthlyAmount: number;
  label: string;
  note: string;
}> = [
  {
    id: "Essential",
    monthlyAmount: 2_500,
    label: "Essentials-focused",
    note: "Core everyday needs, essential transport, healthcare allowance, and modest leisure."
  },
  {
    id: "Comfortable",
    monthlyAmount: 3_500,
    label: "Comfortable",
    note: "Everyday needs with room for regular leisure, family activities, and occasional travel."
  },
  {
    id: "More flexibility",
    monthlyAmount: 5_500,
    label: "More flexibility",
    note: "More room for travel, hobbies, family support, and discretionary choices."
  }
];

export function createInitialOnboardingAnswers(inputs: RetirementInputs): OnboardingAnswers {
  return {
    preferredName: "",
    currentAge: inputs.currentAge,
    retirementAge: inputs.retirementAge,
    spendingPath: null,
    spendingBasis: "individual",
    guidedLifestyle: "Comfortable",
    monthlySpendingToday: Math.round(inputs.retirementSpendingAnnual / 12),
    currentCashSavings: inputs.currentCashSavings,
    currentInvestments: inputs.currentInvestments,
    contributionApproach: null,
    monthlyCashContribution: inputs.cashSavingsContribution,
    monthlyInvestmentContribution: inputs.investmentContribution,
    includeCpf: inputs.includeCpf,
    cpfResidency: inputs.cpfResidency,
    cpfPrYear: inputs.cpfPrYear,
    cpfPrRateType: inputs.cpfPrRateType,
    cpfWorkStatus: inputs.cpfWorkStatus === "Not contributing" ? "Employed" : inputs.cpfWorkStatus,
    grossMonthlyIncome: inputs.grossMonthlyIncome,
    cpfOa: inputs.cpfOa,
    cpfSa: inputs.currentAge >= 55 ? 0 : inputs.cpfSa,
    cpfMa: inputs.cpfMa,
    cpfRa: inputs.currentAge >= 55 ? inputs.cpfRa : 0,
    cpfLifeStartAge: Math.max(65, Math.min(70, inputs.cpfLifeStartAge)),
    cpfRetirementSum: inputs.cpfRetirementSum,
    cpfLifePlan: inputs.cpfLifePlan,
    cpfLifeMonthlyOverride: inputs.cpfLifeMonthlyOverride,
    includeOneTimeEvents: inputs.includeOneTimeEvents,
    oneTimeEvents: [...inputs.oneTimeEvents],
    includeOtherIncome: inputs.customIncomeStreams.length > 0,
    customIncomeStreams: [...inputs.customIncomeStreams],
    refineAssumptions: false,
    endAge: inputs.endAge,
    retirementSpendingInflationRate: inputs.retirementSpendingInflationRate,
    cashInterestRate: inputs.cashInterestRate,
    preRetirementInvestmentReturnRate: inputs.preRetirementInvestmentReturnRate,
    retirementReturnRate: inputs.retirementReturnRate,
    annualContributionIncreaseRate: inputs.annualContributionIncreaseRate
  };
}

function lifestylePreset(answers: OnboardingAnswers): RetirementLifestylePreset {
  if (answers.spendingPath === "known") return "Custom";
  if (answers.guidedLifestyle === "More flexibility") return "Luxurious";
  return answers.guidedLifestyle;
}

export function onboardingAnswersToRetirementInputs(
  answers: OnboardingAnswers,
  existingDefaults: RetirementInputs
): RetirementInputs {
  const retirementAge = Math.max(answers.currentAge + 1, answers.retirementAge);
  const usesCash = answers.contributionApproach === "cash" || answers.contributionApproach === "both";
  const usesInvestments = answers.contributionApproach === "invest" || answers.contributionApproach === "both";
  const occasional = answers.contributionApproach === "occasional";

  return {
    ...existingDefaults,
    currentAge: answers.currentAge,
    retirementAge,
    retirementLifestylePreset: lifestylePreset(answers),
    retirementSpendingAnnual: Math.max(0, answers.monthlySpendingToday) * 12,
    currentCashSavings: Math.max(0, answers.currentCashSavings),
    currentInvestments: Math.max(0, answers.currentInvestments),
    contributionFrequency: "monthly",
    cashSavingsContribution: usesCash || occasional ? Math.max(0, answers.monthlyCashContribution) : 0,
    investmentContribution: usesInvestments || occasional ? Math.max(0, answers.monthlyInvestmentContribution) : 0,
    endAge: Math.max(answers.endAge, retirementAge + 1),
    retirementSpendingInflationRate: answers.retirementSpendingInflationRate,
    cashInterestRate: answers.cashInterestRate,
    preRetirementInvestmentReturnRate: answers.preRetirementInvestmentReturnRate,
    retirementReturnRate: answers.retirementReturnRate,
    annualContributionIncreaseRate: answers.annualContributionIncreaseRate,
    customIncomeStreams: answers.includeOtherIncome ? answers.customIncomeStreams.map((stream) => ({ ...stream })) : [],
    includeCpf: answers.includeCpf,
    cpfResidency: answers.cpfResidency,
    cpfPrYear: answers.cpfPrYear,
    cpfPrRateType: answers.cpfPrRateType,
    cpfWorkStatus: answers.includeCpf ? answers.cpfWorkStatus : "Not contributing",
    grossMonthlyIncome: answers.includeCpf && answers.cpfWorkStatus !== "Not contributing" ? answers.grossMonthlyIncome : 0,
    cpfOa: answers.includeCpf ? answers.cpfOa : 0,
    cpfSa: answers.includeCpf && answers.currentAge < 55 ? answers.cpfSa : 0,
    cpfMa: answers.includeCpf ? answers.cpfMa : 0,
    cpfRa: answers.includeCpf && answers.currentAge >= 55 ? answers.cpfRa : 0,
    cpfLifeStartAge: answers.cpfLifeStartAge,
    cpfRetirementSum: answers.cpfRetirementSum,
    cpfLifePlan: answers.cpfLifePlan,
    cpfLifeMonthlyOverride: answers.includeCpf ? answers.cpfLifeMonthlyOverride : 0,
    includeSrs: false,
    includeOneTimeEvents: answers.includeOneTimeEvents,
    oneTimeEvents: answers.includeOneTimeEvents ? answers.oneTimeEvents.map((event) => ({ ...event })) : []
  };
}
