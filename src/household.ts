import type { OneTimeFinancialEvent, RetirementInputs } from "./types";
import { defaultInputs } from "./utils/projection";

export type HouseholdResidency = "Singapore Citizen" | "Permanent Resident" | "Foreigner";
export type HouseholdRetirementStart = "first" | "both";

export interface HouseholdPersonPlan {
  id: "person-1" | "person-2";
  label: string;
  residency: HouseholdResidency;
  inputs: RetirementInputs;
}

export interface HouseholdPlan {
  mode: "couple";
  people: [HouseholdPersonPlan, HouseholdPersonPlan];
  retirementStart: HouseholdRetirementStart;
  currentCashSavings: number;
  currentInvestments: number;
  retirementSpendingAnnual: number;
  retirementSpendingInflationRate: number;
  cashInterestRate: number;
  preRetirementInvestmentReturnRate: number;
  retirementReturnRate: number;
  passiveIncomeYieldRate: number;
  annualContributionIncreaseRate: number;
  includeOneTimeEvents: boolean;
  oneTimeEvents: OneTimeFinancialEvent[];
}

function personInputs(currentAge: number, retirementAge: number): RetirementInputs {
  return {
    ...defaultInputs,
    currentAge,
    retirementAge,
    endAge: 100,
    currentCashSavings: 0,
    currentInvestments: 0,
    cashSavingsContribution: 500,
    investmentContribution: 1_000,
    includeCpf: true,
    cpfWorkStatus: "Employed",
    grossMonthlyIncome: 5_000,
    cpfOa: 0,
    cpfSa: 0,
    cpfMa: 0,
    cpfRa: 0,
    includeSrs: false,
    srsCurrentBalance: 0,
    srsAnnualContribution: 0,
    srsContributionEndAge: retirementAge,
    srsFirstWithdrawalAge: 64,
    customIncomeStreams: [],
    oneTimeEvents: []
  };
}

export function createDefaultHouseholdPlan(): HouseholdPlan {
  return {
    mode: "couple",
    people: [
      {
        id: "person-1",
        label: "You",
        residency: "Singapore Citizen",
        inputs: personInputs(35, 65)
      },
      {
        id: "person-2",
        label: "Partner",
        residency: "Singapore Citizen",
        inputs: personInputs(33, 65)
      }
    ],
    retirementStart: "first",
    currentCashSavings: 100_000,
    currentInvestments: 200_000,
    retirementSpendingAnnual: 5_000 * 12,
    retirementSpendingInflationRate: defaultInputs.retirementSpendingInflationRate,
    cashInterestRate: defaultInputs.cashInterestRate,
    preRetirementInvestmentReturnRate: defaultInputs.preRetirementInvestmentReturnRate,
    retirementReturnRate: defaultInputs.retirementReturnRate,
    passiveIncomeYieldRate: defaultInputs.passiveIncomeYieldRate,
    annualContributionIncreaseRate: defaultInputs.annualContributionIncreaseRate,
    includeOneTimeEvents: false,
    oneTimeEvents: []
  };
}

export function cloneHouseholdPlan(plan: HouseholdPlan): HouseholdPlan {
  return {
    ...plan,
    people: plan.people.map((person) => ({
      ...person,
      inputs: {
        ...person.inputs,
        customIncomeStreams: [...person.inputs.customIncomeStreams],
        oneTimeEvents: [...person.inputs.oneTimeEvents]
      }
    })) as HouseholdPlan["people"],
    oneTimeEvents: [...plan.oneTimeEvents]
  };
}
