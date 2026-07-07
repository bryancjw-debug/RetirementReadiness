import { describe, expect, it } from "vitest";
import { defaultInputs, projectRetirement } from "./projection";

describe("projectRetirement", () => {
  it("projects every age from current age to end age", () => {
    const projection = projectRetirement({ ...defaultInputs, currentAge: 40, retirementAge: 65, endAge: 90 });

    expect(projection.rows).toHaveLength(51);
    expect(projection.rows[0].age).toBe(40);
    expect(projection.rows.at(-1)?.age).toBe(90);
  });

  it("adds regular savings only before retirement", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 62,
      endAge: 63,
      cashSavingsContribution: 400,
      investmentContribution: 600,
      contributionFrequency: "monthly"
    });

    expect(projection.rows.find((row) => row.age === 60)?.cashContribution).toBeGreaterThan(0);
    expect(projection.rows.find((row) => row.age === 60)?.investmentContribution).toBeGreaterThan(0);
    expect(projection.rows.find((row) => row.age === 62)?.cashContribution).toBe(0);
    expect(projection.rows.find((row) => row.age === 62)?.investmentContribution).toBe(0);
  });

  it("marks a projection as not ready when retirement spending creates a shortfall", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentCashSavings: 5_000,
      currentInvestments: 5_000,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeLumpSum: false,
      lumpSumAmount: 0,
      retirementSpendingAnnual: 100_000,
      currentAge: 64,
      retirementAge: 65,
      endAge: 70
    });

    expect(projection.summary.status).toBe("not-ready");
    expect(projection.summary.firstShortfallAge).not.toBeNull();
  });

  it("supports a ready projection through the selected end age", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentCashSavings: 200_000,
      currentInvestments: 2_800_000,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeLumpSum: false,
      lumpSumAmount: 0,
      retirementSpendingAnnual: 50_000,
      currentAge: 64,
      retirementAge: 65,
      endAge: 90,
      retirementIncomeMethod: "passive",
      passiveIncomeYieldRate: 4
    });

    expect(projection.summary.status).toBe("ready");
    expect(projection.summary.runwayAge).toBe(90);
  });

  it("ignores future lump sums unless the option is enabled", () => {
    const withoutLumpSum = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeLumpSum: false,
      lumpSumAmount: 500_000,
      lumpSumAge: 65
    });
    const withLumpSum = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeLumpSum: true,
      lumpSumAmount: 500_000,
      lumpSumAge: 65
    });

    expect(withoutLumpSum.rows.at(-1)?.lumpSum).toBe(0);
    expect(withLumpSum.rows.at(-1)?.lumpSum).toBe(500_000);
  });

  it("forms CPF RA at age 55 and estimates CPF LIFE income from the selected sum", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 54,
      retirementAge: 65,
      endAge: 66,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 100_000,
      cpfSa: 200_000,
      cpfMa: 50_000,
      cpfLifeStartAge: 65,
      cpfRetirementSum: "Full",
      cpfLifePlan: "Standard"
    });

    expect(projection.rows.find((row) => row.age === 55)?.cpfRa).toBeGreaterThan(0);
    expect(projection.rows.find((row) => row.age === 65)?.cpfLifeIncome).toBeGreaterThan(0);
  });

  it("uses a higher estimated CPF LIFE payout for Enhanced than Full retirement sum", () => {
    const full = projectRetirement({
      ...defaultInputs,
      currentAge: 54,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 700_000,
      cpfSa: 700_000,
      cpfMa: 50_000,
      cpfLifeStartAge: 65,
      cpfRetirementSum: "Full"
    });
    const enhanced = projectRetirement({
      ...defaultInputs,
      currentAge: 54,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 700_000,
      cpfSa: 700_000,
      cpfMa: 50_000,
      cpfLifeStartAge: 65,
      cpfRetirementSum: "Enhanced"
    });

    expect(enhanced.summary.cpfLifeMonthlyAtStart).toBeGreaterThan(full.summary.cpfLifeMonthlyAtStart);
  });
});
