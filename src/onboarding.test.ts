import { describe, expect, it } from "vitest";
import { defaultInputs } from "./utils/projection";
import {
  createInitialOnboardingAnswers,
  onboardingAnswersToRetirementInputs,
  type OnboardingAnswers
} from "./onboarding";

describe("RetirementReadiness onboarding mapping", () => {
  it("maps guided answers into the existing projection inputs", () => {
    const answers: OnboardingAnswers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      preferredName: "Alex",
      currentAge: 35,
      retirementAge: 62,
      spendingPath: "guided",
      guidedLifestyle: "More flexibility",
      monthlySpendingToday: 5_500,
      currentCashSavings: 80_000,
      currentInvestments: 150_000,
      contributionApproach: "both",
      monthlyCashContribution: 600,
      monthlyInvestmentContribution: 1_200
    };

    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);

    expect(mapped.currentAge).toBe(35);
    expect(mapped.retirementAge).toBe(62);
    expect(mapped.retirementLifestylePreset).toBe("Luxurious");
    expect(mapped.retirementSpendingAnnual).toBe(66_000);
    expect(mapped.currentCashSavings).toBe(80_000);
    expect(mapped.currentInvestments).toBe(150_000);
    expect(mapped.cashSavingsContribution).toBe(600);
    expect(mapped.investmentContribution).toBe(1_200);
    expect(mapped.includeCpf).toBe(true);
    expect(mapped.includeSrs).toBe(false);
    expect(mapped.includeOneTimeEvents).toBe(false);
  });

  it("maps guided events, other income, and refined assumptions transparently", () => {
    const answers: OnboardingAnswers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      spendingPath: "known",
      contributionApproach: "none",
      includeOneTimeEvents: true,
      oneTimeEvents: [{ id: "event", label: "Property sale", age: 70, amount: 300_000, direction: "inflow", certainty: "possible" }],
      includeOtherIncome: true,
      customIncomeStreams: [{ id: "income", label: "Rental income", startAge: 65, endAge: 90, amount: 1_500, frequency: "monthly", growthMode: "fixed", annualIncreaseRate: 0 }],
      refineAssumptions: true,
      endAge: 95,
      retirementSpendingInflationRate: 3,
      cashInterestRate: 1.5,
      preRetirementInvestmentReturnRate: 6,
      retirementReturnRate: 3,
      annualContributionIncreaseRate: 2.5
    };

    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);

    expect(mapped.oneTimeEvents[0]).toMatchObject({ label: "Property sale", certainty: "possible" });
    expect(mapped.customIncomeStreams[0]).toMatchObject({ label: "Rental income", amount: 1_500 });
    expect(mapped.endAge).toBe(95);
    expect(mapped.retirementSpendingInflationRate).toBe(3);
    expect(mapped.preRetirementInvestmentReturnRate).toBe(6);
  });

  it("keeps a no-contribution baseline at zero", () => {
    const answers: OnboardingAnswers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      spendingPath: "known",
      contributionApproach: "none"
    };

    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);

    expect(mapped.cashSavingsContribution).toBe(0);
    expect(mapped.investmentContribution).toBe(0);
  });

  it("keeps retirement after the current age", () => {
    const answers: OnboardingAnswers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      currentAge: 67,
      retirementAge: 60,
      spendingPath: "known",
      contributionApproach: "none"
    };

    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);
    expect(mapped.retirementAge).toBe(68);
    expect(mapped.endAge).toBeGreaterThan(mapped.retirementAge);
  });

  it("maps an age-55-plus working profile to OA, RA and MA without SA", () => {
    const answers: OnboardingAnswers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      currentAge: 58,
      retirementAge: 67,
      spendingPath: "known",
      contributionApproach: "none",
      includeCpf: true,
      cpfWorkStatus: "Employed",
      grossMonthlyIncome: 6_000,
      cpfOa: 80_000,
      cpfSa: 90_000,
      cpfRa: 220_000,
      cpfMa: 70_000,
      cpfLifeStartAge: 67
    };

    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);
    expect(mapped.includeCpf).toBe(true);
    expect(mapped.cpfWorkStatus).toBe("Employed");
    expect(mapped.grossMonthlyIncome).toBe(6_000);
    expect(mapped.cpfSa).toBe(0);
    expect(mapped.cpfRa).toBe(220_000);
  });

  it("preserves an explicit choice to exclude CPF", () => {
    const answers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      spendingPath: "known" as const,
      contributionApproach: "none" as const,
      includeCpf: false
    };
    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);
    expect(mapped.includeCpf).toBe(false);
    expect(mapped.cpfOa).toBe(0);
    expect(mapped.cpfLifeMonthlyOverride).toBe(0);
  });

  it("maps self-employed CPF, deductions, and the selected retirement-income method", () => {
    const answers: OnboardingAnswers = {
      ...createInitialOnboardingAnswers(defaultInputs),
      spendingPath: "known",
      contributionApproach: "both",
      cpfWorkStatus: "Self-employed",
      selfEmployedNetTradeIncomeAnnual: 72_000,
      selfEmployedVoluntaryCpfAnnual: 12_000,
      cpfOaHousingMonthly: 1_500,
      cpfOaHousingEndAge: 60,
      cpfMaMedicalPremiumAnnual: 2_000,
      passiveIncomeYieldRate: 4.5,
      retirementIncomePreference: "growth"
    };

    const mapped = onboardingAnswersToRetirementInputs(answers, defaultInputs);
    expect(mapped.grossMonthlyIncome).toBe(6_000);
    expect(mapped.selfEmployedNetTradeIncomeAnnual).toBe(72_000);
    expect(mapped.selfEmployedVoluntaryCpfAnnual).toBe(12_000);
    expect(mapped.cpfOaHousingMonthly).toBe(1_500);
    expect(mapped.cpfOaHousingEndAge).toBe(60);
    expect(mapped.cpfMaMedicalPremiumAnnual).toBe(2_000);
    expect(mapped.passiveIncomeYieldRate).toBe(4.5);
    expect(mapped.retirementIncomeMethod).toBe("drawdown");
  });
});
