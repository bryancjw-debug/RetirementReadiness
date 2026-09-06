import { describe, expect, it } from "vitest";
import { createNewOnboardingAnswers, onboardingAnswersToRetirementInputs } from "../onboarding";
import { defaultInputs, projectRetirement } from "./projection";
import { matchesQuizShape, readQuizDraft, writeQuizDraft } from "./quizDraft";

describe("guided input safeguards", () => {
  it("does not put sample cash or investments into a new real plan", () => {
    const answers = createNewOnboardingAnswers(defaultInputs);
    expect([answers.currentCashSavings, answers.currentInvestments, answers.monthlyCashContribution, answers.monthlyInvestmentContribution]).toEqual([0, 0, 0, 0]);
    expect(defaultInputs.currentCashSavings).toBeGreaterThan(0);
  });
  it("keeps exact values and incomplete-input notices independent of projection math", () => {
    const answers = { ...createNewOnboardingAnswers(defaultInputs), currentCashSavings: 123456, contributionApproach: "none" as const, spendingPath: "known" as const, unknownBalances: ["Investments"] };
    const before = onboardingAnswersToRetirementInputs(answers, defaultInputs);
    const after = onboardingAnswersToRetirementInputs({ ...answers, unknownBalances: [] }, defaultInputs);
    expect(before.currentCashSavings).toBe(123456);
    expect(projectRetirement(before)).toEqual(projectRetirement(after));
  });
  it("restores a completed quiz with optional insurance and top-up fields", () => {
    const fresh = createNewOnboardingAnswers(defaultInputs);
    const saved = { ...fresh, spendingPath: "known", contributionApproach: "cash", retirementTopUp: { enabled: true, annualAmount: 7500, startAge: 30, endAge: 64 } };
    let raw = "";
    const storage = { setItem: (_: string, value: string) => { raw = value; }, getItem: () => raw };
    writeQuizDraft(storage, "individual", saved);
    const result = readQuizDraft(storage, "individual", (value): value is typeof saved => matchesQuizShape(value, fresh));
    expect(result?.data.retirementTopUp.annualAmount).toBe(7500);
  });
});
