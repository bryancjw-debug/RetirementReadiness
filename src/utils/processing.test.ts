import { describe, expect, it } from "vitest";
import { defaultInputs } from "./projection";
import { projectionComplexityPoints, projectionProcessingDuration } from "./processing";

describe("projection processing duration", () => {
  it("uses a two-second floor for a minimal plan", () => {
    const minimal = {
      ...defaultInputs,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: false,
      includeSrs: false,
      customIncomeStreams: [],
      includeOneTimeEvents: false,
      oneTimeEvents: [],
      spendingProfile: { adults: 1 as const, dependants: [] }
    };
    expect(projectionComplexityPoints(minimal)).toBe(0);
    expect(projectionProcessingDuration(minimal)).toBe(2_000);
  });

  it("scales to five seconds for a fully refined plan", () => {
    const full = {
      ...defaultInputs,
      currentCashSavings: 100_000,
      currentInvestments: 200_000,
      cashSavingsContribution: 500,
      investmentContribution: 1_000,
      includeCpf: true,
      cpfOa: 20_000,
      cpfOaHousingMonthly: 1_000,
      insuranceEstimate: { enabled: true } as typeof defaultInputs.insuranceEstimate,
      retirementTopUp: { enabled: true, annualAmount: 1_000, startAge: 40, endAge: 50 },
      includeSrs: true,
      srsCurrentBalance: 20_000,
      srsAnnualContribution: 5_000,
      customIncomeStreams: [{ id: "income", label: "Income", startAge: 65, endAge: 80, amount: 500, frequency: "monthly" as const, growthMode: "fixed" as const, annualIncreaseRate: 0 }],
      includeOneTimeEvents: true,
      oneTimeEvents: [{ id: "event", label: "Event", age: 70, amount: 10_000, direction: "inflow" as const }],
      spendingProfile: { adults: 2 as const, dependants: [{ id: "child", label: "Child", currentAge: 5, supportUntilAge: 25, monthlyAmountToday: 750 }] },
      investmentMix: [{ label: "Fund", amount: 200_000, returnRate: 5, incomeYield: 2 }],
      retirementInvestmentMix: [{ label: "Fund", amount: 200_000, returnRate: 4, incomeYield: 3 }],
      otherTaxableIncome: { annualAmount: 20_000, startAge: 65, endAge: 80, growthRate: 0 }
    };
    expect(projectionComplexityPoints(full)).toBe(14);
    expect(projectionProcessingDuration(full)).toBe(5_000);
  });
});
