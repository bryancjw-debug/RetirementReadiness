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

  it("treats regular savings and investments as monthly amounts by default", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 62,
      endAge: 62,
      cashSavingsContribution: 400,
      investmentContribution: 600,
      contributionFrequency: "yearly",
      annualContributionIncreaseRate: 0
    });

    const firstYear = projection.rows.find((row) => row.age === 60);
    expect(firstYear?.cashContribution).toBe(4_800);
    expect(firstYear?.investmentContribution).toBe(7_200);
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

  it("uses CPF LIFE monthly override from the official estimator when supplied", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 62,
      retirementAge: 65,
      endAge: 66,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0,
      cpfRa: 314_018,
      cpfLifeStartAge: 65,
      cpfRetirementSum: "Full",
      cpfLifePlan: "Standard",
      cpfLifeMonthlyOverride: 1900
    });

    expect(projection.summary.cpfLifeMonthlyAtStart).toBeCloseTo(1900, 0);
    expect(projection.rows.find((row) => row.age === 65)?.cpfLifeIncome).toBeCloseTo(22_800, 0);
    expect(projection.rows.find((row) => row.age === 66)?.cpfLifeIncome).toBeCloseTo(22_800, 0);
  });

  it("keeps Basic CPF LIFE payout level even as the modeled RA reserve draws down", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 62,
      retirementAge: 65,
      endAge: 68,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0,
      cpfRa: 314_018,
      cpfLifeStartAge: 65,
      cpfRetirementSum: "Full",
      cpfLifePlan: "Basic"
    });

    const age65 = projection.rows.find((row) => row.age === 65)!;
    const age68 = projection.rows.find((row) => row.age === 68)!;
    expect(age65.cpfLifeIncome).toBeGreaterThan(0);
    expect(age68.cpfLifeIncome).toBeCloseTo(age65.cpfLifeIncome, 0);
  });

  it("does not refill CPF RA after CPF LIFE starts", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 64,
      retirementAge: 65,
      endAge: 66,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 200_000,
      cpfRa: 314_018,
      cpfLifeStartAge: 65,
      cpfRetirementSum: "Full",
      cpfLifePlan: "Standard",
      retirementSpendingAnnual: 0
    });

    const age65 = projection.rows.find((row) => row.age === 65)!;
    const age66 = projection.rows.find((row) => row.age === 66)!;
    expect(age65.cpfRa).toBe(0);
    expect(age66.cpfRa).toBe(0);
    expect(age66.cpfLifeReserve).toBeGreaterThan(0);
  });

  it("uses CPF OA drawdown before reporting a true retirement shortfall", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 64,
      retirementAge: 65,
      endAge: 70,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 120_000,
      cpfSa: 0,
      cpfMa: 50_000,
      cpfRa: 600_000,
      cpfLifeStartAge: 70,
      retirementSpendingAnnual: 100_000,
      passiveIncomeYieldRate: 0
    });

    const retirementYear = projection.rows.find((row) => row.age === 65)!;
    expect(retirementYear.cpfOaDrawdown).toBeCloseTo(retirementYear.spendingNeed, 0);
    expect(retirementYear.cpfDrawdown).toBeCloseTo(retirementYear.spendingNeed, 0);
    expect(retirementYear.shortfall).toBe(0);
  });

  it("uses remaining CPF SA before OA when cash and investments are exhausted", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 50,
      retirementAge: 51,
      endAge: 51,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 80_000,
      cpfSa: 40_000,
      cpfMa: 20_000,
      cpfRa: 0,
      cpfLifeStartAge: 65,
      retirementSpendingAnnual: 90_000,
      passiveIncomeYieldRate: 0
    });

    const retirementYear = projection.rows.find((row) => row.age === 51)!;
    expect(retirementYear.cpfSaDrawdown).toBeGreaterThan(40_000);
    expect(retirementYear.cpfOaDrawdown).toBeCloseTo(retirementYear.spendingNeed - retirementYear.cpfSaDrawdown, 0);
    expect(retirementYear.shortfall).toBe(0);
  });

  it("does not use CPF MediSave as retirement drawdown funding", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 64,
      retirementAge: 65,
      endAge: 70,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 70_000,
      cpfRa: 600_000,
      cpfLifeStartAge: 70,
      retirementSpendingAnnual: 100_000,
      passiveIncomeYieldRate: 0
    });

    const retirementYear = projection.rows.find((row) => row.age === 65)!;
    expect(retirementYear.cpfDrawdown).toBe(0);
    expect(retirementYear.cpfMa).toBeLessThan(100_000);
    expect(retirementYear.shortfall).toBeGreaterThan(0);
  });

  it("adds employed CPF contributions from gross income before retirement", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 35,
      retirementAge: 37,
      endAge: 37,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfWorkStatus: "Employed",
      cpfResidency: "Singapore Citizen",
      grossMonthlyIncome: 8_000,
      incomeGrowthRate: 0,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0
    });

    const firstYear = projection.rows.find((row) => row.age === 35)!;
    expect(firstYear.activeIncomeAnnual).toBe(96_000);
    expect(firstYear.cpfEmployeeContribution).toBeCloseTo(19_200, 0);
    expect(firstYear.cpfEmployerContribution).toBeCloseTo(16_320, 0);
    expect(firstYear.cpfTotalContribution).toBeCloseTo(35_520, 0);
    expect(firstYear.cpfOa).toBeGreaterThan(0);
    expect(firstYear.cpfMa).toBeGreaterThan(0);
  });

  it("adds self-employed CPF as MediSave-only contributions", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 45,
      retirementAge: 47,
      endAge: 47,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfWorkStatus: "Self-employed",
      grossMonthlyIncome: 6_000,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0
    });

    const firstYear = projection.rows.find((row) => row.age === 45)!;
    expect(firstYear.cpfOaContribution).toBe(0);
    expect(firstYear.cpfSaContribution).toBe(0);
    expect(firstYear.cpfMaContribution).toBeGreaterThan(0);
    expect(firstYear.cpfEmployerContribution).toBe(0);
  });

  it("caps self-employed MediSave and routes pre-55 overflow to SA", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 45,
      retirementAge: 60,
      endAge: 45,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfWorkStatus: "Self-employed",
      grossMonthlyIncome: 20_000,
      selfEmployedAnnualMedisaveOverride: 37_740,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 78_000
    });

    const firstYear = projection.rows[0];
    expect(firstYear.cpfMa).toBeLessThanOrEqual(79_000);
    expect(firstYear.medisaveOverflow).toBeGreaterThan(0);
    expect(firstYear.cpfSa).toBeGreaterThan(firstYear.medisaveOverflow - 1);
  });

  it("continues income CPF contributions after age 65 when retirement is later", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 64,
      retirementAge: 68,
      endAge: 68,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfWorkStatus: "Employed",
      grossMonthlyIncome: 5_000,
      cpfOa: 20_000,
      cpfSa: 20_000,
      cpfMa: 20_000,
      cpfLifeStartAge: 70
    });

    const age66 = projection.rows.find((row) => row.age === 66)!;
    expect(age66.cpfTotalContribution).toBeGreaterThan(0);
    expect(age66.cpfOaContribution).toBeGreaterThan(0);
    expect(age66.cpfMaContribution).toBeGreaterThan(0);
  });
});
