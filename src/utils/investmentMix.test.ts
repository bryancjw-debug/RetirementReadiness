import { describe, expect, it } from "vitest";
import { calculateInvestmentMix } from "./investmentMix";
import { defaultInputs, projectRetirement } from "./projection";
import { createInitialOnboardingAnswers, onboardingAnswersToRetirementInputs } from "../onboarding";
import { matchesQuizShape } from "./quizDraft";

const items = [
  { label: "Equities", amount: 60000, returnRate: 6, incomeYield: 3 },
  { label: "Bonds", amount: 40000, returnRate: 3, incomeYield: 3 }
];
describe("blended investment assumptions", () => {
  it("weights by invested amount and separates income from total return", () => {
    const result = calculateInvestmentMix(items)!;
    expect(result.totalReturn).toBeCloseTo(4.8);
    expect(result.incomeYield).toBeCloseTo(3);
    expect(result.capitalGrowth).toBeCloseTo(1.8);
    expect(calculateInvestmentMix(items.map(item => ({ ...item, amount: item.amount * 10 })))?.totalReturn).toBeCloseTo(4.8);
  });
  it("rejects empty, negative and nonfinite allocations", () => {
    expect(calculateInvestmentMix([])).toBeNull();
    expect(calculateInvestmentMix([{ ...items[0], amount: 0 }])).toBeNull();
    expect(calculateInvestmentMix([{ ...items[0], amount: -1 }])).toBeNull();
    expect(calculateInvestmentMix([{ ...items[0], returnRate: NaN }])).toBeNull();
  });
  it("carries the blend through the quiz and grows existing and contributed investments", () => {
    const answers = { ...createInitialOnboardingAnswers(defaultInputs), currentAge: 60, retirementAge: 61, endAge: 62, includeCpf: false, currentInvestments: 100000, monthlyInvestmentContribution: 1000, contributionApproach: "invest" as const, investmentMix: items, preRetirementInvestmentReturnRate: 4.8 };
    const inputs = onboardingAnswersToRetirementInputs(answers, defaultInputs);
    const row = projectRetirement(inputs).rows[0];
    expect(row.investmentContribution).toBe(12000);
    expect(row.investmentGrowth).toBeCloseTo(112000 * .048);
    expect(projectRetirement(inputs).rows[1].investmentContribution).toBe(0);
    expect(inputs.investmentMix).toEqual(items);
    expect(matchesQuizShape(answers, createInitialOnboardingAnswers(defaultInputs))).toBe(true);
  });
});
