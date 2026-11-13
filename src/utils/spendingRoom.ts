import type { HouseholdPlan } from "../household";
import type { RetirementInputs } from "../types";
import { projectHousehold } from "./householdProjection";
import { projectRetirement } from "./projection";
import type { SpendingScenario } from "./spendingScenario";

export type RoomPlan = { individual: RetirementInputs } | { household: HouseholdPlan };
export interface RoomSettings {
  reserve: number;
  careMonthly: number;
  careStartAge: number;
  careYears: number;
  lifestyleReduction: number;
  lifestyleStartAge: number;
}

export function roomPlanFacts(plan: RoomPlan) {
  const inputs = "individual" in plan ? [plan.individual] : plan.household.people.map(person => person.inputs);
  return {
    budget: ("individual" in plan ? plan.individual : plan.household).retirementSpendingAnnual / 12,
    contributions: inputs.reduce((sum, input) => sum + (input.currentAge < input.retirementAge
      ? input.cashSavingsContribution + input.investmentContribution : 0), 0),
    referenceAge: Math.min(...inputs.map(input => input.currentAge))
  };
}

export function evaluateRoom(plan: RoomPlan, settings: RoomSettings, cautious: boolean, extraMonthly = 0, spendNow = 0, exploreLifestyle = false) {
  const facts = roomPlanFacts(plan);
  const fraction = facts.contributions > 0 ? Math.min(1, Math.max(0, spendNow / facts.contributions)) : 0;
  const years = cautious ? 5 : 0;
  const rateChange = cautious ? 1 : 0;
  const adjust = (input: RetirementInputs) => ({
    ...input,
    endAge: input.endAge + years,
    cashSavingsContribution: input.cashSavingsContribution * (1 - fraction),
    investmentContribution: input.investmentContribution * (1 - fraction),
    preRetirementInvestmentReturnRate: Math.max(-100, input.preRetirementInvestmentReturnRate - rateChange),
    retirementReturnRate: Math.max(-100, input.retirementReturnRate - rateChange),
    retirementSpendingInflationRate: input.retirementSpendingInflationRate + rateChange
  });
  const scenario: SpendingScenario = {
    extraMonthly,
    careMonthly: cautious ? settings.careMonthly : 0,
    careStartOffset: Math.max(0, settings.careStartAge - facts.referenceAge),
    careYears: settings.careYears,
    lifestyleReductionMonthly: exploreLifestyle ? settings.lifestyleReduction : 0,
    lifestyleStartOffset: Math.max(0, settings.lifestyleStartAge - facts.referenceAge)
  };
  const inflation = ("individual" in plan ? plan.individual : plan.household).retirementSpendingInflationRate + rateChange;
  const rows = "individual" in plan
    ? projectRetirement(adjust(plan.individual), scenario).rows
    : projectHousehold({
      ...plan.household,
      preRetirementInvestmentReturnRate: Math.max(-100, plan.household.preRetirementInvestmentReturnRate - rateChange),
      retirementReturnRate: Math.max(-100, plan.household.retirementReturnRate - rateChange),
      retirementSpendingInflationRate: inflation,
      people: plan.household.people.map(person => ({ ...person, inputs: adjust(person.inputs) })) as HouseholdPlan["people"]
    }, scenario).rows;
  const minimumReserve = Math.min(...rows.filter(row => row.phase === "retirement").map(row =>
    (row.endingCashSavings + row.endingInvestments) / (1 + inflation / 100) ** row.yearIndex));
  const funded = rows.length > 0 && rows.every(row => Number.isFinite(row.shortfall) && row.shortfall <= 0.01);
  return {
    funded,
    passes: funded && Number.isFinite(minimumReserve) && minimumReserve >= settings.reserve - 0.01,
    minimumReserve
  };
}

export function spendingRoom(plan: RoomPlan, settings: RoomSettings, cautious: boolean, beforeRetirement: boolean) {
  const limit = beforeRetirement ? roomPlanFacts(plan).contributions : 100_000;
  const accepts = (amount: number) => evaluateRoom(plan, settings, cautious, beforeRetirement ? 0 : amount, beforeRetirement ? amount : 0).passes;
  if (!accepts(0)) return { amount: 0, baselinePasses: false, atLimit: false };
  // Search in units of $10, so the number shown never rounds above a tested amount.
  let low = 0;
  let high = Math.floor(limit / 10);
  const ceiling = high;
  while (low < high) {
    const next = Math.ceil((low + high) / 2);
    if (accepts(next * 10)) low = next;
    else high = next - 1;
  }
  return { amount: low * 10, baselinePasses: true, atLimit: !beforeRetirement && low === ceiling };
}
