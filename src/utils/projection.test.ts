import { describe, expect, it } from "vitest";
import { defaultInputs, projectRetirement, selfEmployedMandatoryMedisave } from "./projection";

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

  it("uses custom income streams to reduce retirement drawdown and shortfall", () => {
    const baseInputs = {
      ...defaultInputs,
      currentAge: 64,
      retirementAge: 65,
      endAge: 66,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: false,
      retirementSpendingAnnual: 36_000,
      passiveIncomeYieldRate: 0,
      customIncomeStreams: []
    };
    const withoutCustomIncome = projectRetirement(baseInputs);
    const withCustomIncome = projectRetirement({
      ...baseInputs,
      customIncomeStreams: [
        {
          id: "annuity",
          label: "Annuity",
          startAge: 65,
          endAge: 66,
          amount: 1_000,
          frequency: "monthly",
          growthMode: "fixed",
          annualIncreaseRate: 0
        }
      ]
    });

    expect(withCustomIncome.rows.find((row) => row.age === 65)?.customIncomeGenerated).toBe(12_000);
    expect(withCustomIncome.summary.totalCustomIncome).toBe(24_000);
    expect(withCustomIncome.summary.totalShortfall).toBeLessThan(withoutCustomIncome.summary.totalShortfall);
  });

  it("compounds increasing custom income streams annually from their start age", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 64,
      retirementAge: 65,
      endAge: 67,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: false,
      retirementSpendingAnnual: 0,
      customIncomeStreams: [
        {
          id: "income-plan",
          label: "Income Plan",
          startAge: 65,
          endAge: 67,
          amount: 12_000,
          frequency: "yearly",
          growthMode: "increasing",
          annualIncreaseRate: 5
        }
      ]
    });

    expect(projection.rows.find((row) => row.age === 65)?.customIncomeGenerated).toBeCloseTo(12_000, 0);
    expect(projection.rows.find((row) => row.age === 66)?.customIncomeGenerated).toBeCloseTo(12_600, 0);
    expect(projection.rows.find((row) => row.age === 67)?.customIncomeGenerated).toBeCloseTo(13_230, 0);
  });

  it("shows separate cash, investment, and spending levers to close a projected gap", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 50,
      retirementAge: 65,
      endAge: 90,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      cashInterestRate: 1,
      preRetirementInvestmentReturnRate: 5,
      retirementSpendingAnnual: 80_000,
      includeCpf: false
    });

    expect(projection.summary.totalShortfall).toBeGreaterThan(0);
    expect(projection.summary.extraMonthlyCashSavingsRequired).toBeGreaterThan(
      projection.summary.extraMonthlyInvestmentRequired
    );
    expect(projection.summary.monthlySpendingReductionRequired).toBeGreaterThan(0);
    expect(projection.summary.additionalMonthlyRequired).toBe(
      projection.summary.extraMonthlyInvestmentRequired
    );
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

  it("applies enabled one-time events only at their selected age", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 40,
      retirementAge: 65,
      endAge: 66,
      currentCashSavings: 100_000,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: false,
      includeOneTimeEvents: true,
      oneTimeEvents: [
        { id: "sale", label: "Sale", age: 50, amount: 20_000, direction: "inflow" },
        { id: "car", label: "Car", age: 60, amount: 10_000, direction: "outflow" }
      ]
    });

    expect(projection.rows.find((row) => row.age === 49)?.oneTimeInflow).toBe(0);
    expect(projection.rows.find((row) => row.age === 50)?.oneTimeInflow).toBe(20_000);
    expect(projection.rows.find((row) => row.age === 50)?.oneTimeOutflow).toBe(0);
    expect(projection.rows.find((row) => row.age === 60)?.oneTimeOutflow).toBe(10_000);
    expect(projection.rows.find((row) => row.age === 61)?.oneTimeOutflow).toBe(0);
  });

  it("projects SRS contributions and spreads withdrawals over the ten-year window", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 65,
      endAge: 74,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: false,
      includeSrs: true,
      srsCurrentBalance: 100_000,
      srsAnnualContribution: 10_000,
      srsContributionEndAge: 64,
      srsReturnRate: 0,
      srsFirstWithdrawalAge: 65
    });

    expect(projection.summary.totalSrsContributions).toBe(50_000);
    expect(projection.rows.find((row) => row.age === 64)?.srsBalance).toBe(150_000);
    expect(projection.rows.find((row) => row.age === 65)?.srsWithdrawal).toBe(15_000);
    expect(projection.rows.find((row) => row.age === 74)?.srsWithdrawal).toBe(15_000);
    expect(projection.summary.totalSrsWithdrawals).toBe(150_000);
    expect(projection.rows.at(-1)?.srsBalance).toBe(0);
  });

  it("deems the remaining SRS balance withdrawn in year ten and transfers unused funds to cash", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 65,
      retirementAge: 65,
      endAge: 74,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      cashInterestRate: 0,
      retirementSpendingAnnual: 0,
      includeCpf: false,
      includeSrs: true,
      srsCurrentBalance: 100_000,
      srsAnnualContribution: 0,
      srsContributionEndAge: 65,
      srsReturnRate: 5,
      srsWithdrawalStrategy: "Even Over Ten Years",
      srsFirstWithdrawalAge: 65
    });

    const finalRow = projection.rows.find((row) => row.age === 74);
    expect(finalRow?.srsBalance).toBe(0);
    expect(finalRow?.srsWithdrawal).toBeGreaterThan(10_500);
    expect(finalRow?.srsTransferToCash).toBe(finalRow?.srsNetWithdrawal);
    expect(finalRow?.endingCashSavings).toBeCloseTo(projection.summary.totalSrsNetWithdrawals, 6);
  });

  it("caps annual SRS contributions according to residency", () => {
    const local = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 65,
      endAge: 60,
      includeCpf: false,
      includeSrs: true,
      srsResidency: "Singapore Citizen Or Permanent Resident",
      srsAnnualContribution: 50_000
    });
    const foreigner = projectRetirement({
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 65,
      endAge: 60,
      includeCpf: false,
      includeSrs: true,
      srsResidency: "Foreigner",
      srsAnnualContribution: 50_000
    });

    expect(local.rows[0].srsContribution).toBe(15_300);
    expect(foreigner.rows[0].srsContribution).toBe(35_700);
  });

  it("estimates resident tax only when half of the qualifying SRS withdrawal exceeds the zero-rate band", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 65,
      retirementAge: 65,
      endAge: 65,
      retirementSpendingAnnual: 0,
      cashInterestRate: 0,
      includeCpf: false,
      includeSrs: true,
      srsResidency: "Singapore Citizen Or Permanent Resident",
      srsCurrentBalance: 500_000,
      srsReturnRate: 0,
      srsFirstWithdrawalAge: 65,
      srsWithdrawalStrategy: "Tax Aware"
    });

    const firstWithdrawal = projection.rows[0];
    expect(firstWithdrawal.srsWithdrawal).toBe(50_000);
    expect(firstWithdrawal.srsTaxableAmount).toBe(25_000);
    expect(firstWithdrawal.srsEstimatedTax).toBe(100);
    expect(firstWithdrawal.srsNetWithdrawal).toBe(49_900);
  });

  it("shows foreigner withholding separately from the net SRS withdrawal", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 65,
      retirementAge: 65,
      endAge: 65,
      retirementSpendingAnnual: 0,
      cashInterestRate: 0,
      includeCpf: false,
      includeSrs: true,
      srsResidency: "Foreigner",
      srsCurrentBalance: 400_000,
      srsReturnRate: 0,
      srsFirstWithdrawalAge: 65,
      srsWithdrawalStrategy: "Tax Aware"
    });

    const firstWithdrawal = projection.rows[0];
    expect(firstWithdrawal.srsWithdrawal).toBe(40_000);
    expect(firstWithdrawal.srsTaxableAmount).toBe(20_000);
    expect(firstWithdrawal.srsEstimatedTax).toBe(4_800);
    expect(firstWithdrawal.srsNetWithdrawal).toBe(35_200);
  });

  it("uses the statutory retirement age tied to the first SRS contribution period", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 62,
      retirementAge: 62,
      endAge: 64,
      retirementSpendingAnnual: 0,
      includeCpf: false,
      includeSrs: true,
      srsCurrentBalance: 100_000,
      srsReturnRate: 0,
      srsFirstContributionPeriod: "Not Sure",
      srsFirstWithdrawalAge: 62
    });

    expect(projection.rows.find((row) => row.age === 62)?.srsWithdrawal).toBe(0);
    expect(projection.rows.find((row) => row.age === 64)?.srsWithdrawal).toBeGreaterThan(0);
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

  it("shows CPF SA before age 55 and converts it into RA at age 55", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 54,
      retirementAge: 65,
      endAge: 55,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 100_000,
      cpfSa: 200_000,
      cpfMa: 50_000,
      cpfRetirementSum: "Full"
    });

    expect(projection.rows.find((row) => row.age === 54)?.cpfSa).toBeGreaterThan(0);
    expect(projection.rows.find((row) => row.age === 55)?.cpfRa).toBeGreaterThan(0);
  });

  it("allows optional CPF OA transfer into RA at 55 up to the ERS cap", () => {
    const withoutTransfer = projectRetirement({
      ...defaultInputs,
      currentAge: 54,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 400_000,
      cpfSa: 0,
      cpfMa: 50_000,
      cpfRetirementSum: "Full",
      cpfLifeStartAge: 65,
      cpfOaToRaTransferAt55: 0
    });
    const withTransfer = projectRetirement({
      ...defaultInputs,
      currentAge: 54,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: true,
      cpfOa: 400_000,
      cpfSa: 0,
      cpfMa: 50_000,
      cpfRetirementSum: "Full",
      cpfLifeStartAge: 65,
      cpfOaToRaTransferAt55: 100_000
    });

    expect(withTransfer.summary.projectedCpfRaAt55).toBeGreaterThan(withoutTransfer.summary.projectedCpfRaAt55);
    expect(withTransfer.summary.projectedCpfOaAt55).toBeLessThan(withoutTransfer.summary.projectedCpfOaAt55);
    expect(withTransfer.summary.cpfLifeMonthlyAtStart).toBeGreaterThan(withoutTransfer.summary.cpfLifeMonthlyAtStart);
    expect(withTransfer.summary.projectedCpfRaAt55).toBeLessThanOrEqual(withTransfer.summary.cpfEnhancedRetirementSumAt55);
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

  it("does not unlock CPF OA or SA for ordinary spending before age 55", () => {
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
    expect(retirementYear.cpfSaDrawdown).toBe(0);
    expect(retirementYear.cpfOaDrawdown).toBe(0);
    expect(retirementYear.cpfLifeIncome).toBe(0);
    expect(retirementYear.shortfall).toBe(retirementYear.spendingNeed);
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

  it("does not count a dividend stream for the capital-growth drawdown method", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 65,
      retirementAge: 65,
      endAge: 66,
      currentInvestments: 500_000,
      passiveIncomeYieldRate: 4,
      retirementIncomeMethod: "drawdown",
      includeCpf: false
    });

    const retirementYear = projection.rows.find((row) => row.phase === "retirement")!;
    expect(retirementYear.passiveIncomeGenerated).toBe(0);
    expect(retirementYear.withdrawal).toBeGreaterThan(0);
  });

  it("uses the official 2026 self-employed MediSave schedule and NTI ceiling", () => {
    expect(selfEmployedMandatoryMedisave(35, 72_000)).toBe(6_480);
    expect(selfEmployedMandatoryMedisave(45, 12_000)).toBe(600);
    expect(selfEmployedMandatoryMedisave(45, 15_000)).toBe(1_200);
    expect(selfEmployedMandatoryMedisave(45, 200_000)).toBe(9_600);
  });

  it("allocates voluntary self-employed CPF across accounts within the Annual Limit", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 35,
      retirementAge: 36,
      endAge: 35,
      includeCpf: true,
      cpfWorkStatus: "Self-employed",
      grossMonthlyIncome: 6_000,
      selfEmployedNetTradeIncomeAnnual: 72_000,
      selfEmployedVoluntaryCpfAnnual: 37_740,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0
    });

    const firstYear = projection.rows[0];
    expect(firstYear.cpfTotalContribution).toBeCloseTo(37_740, 0);
    expect(firstYear.cpfMaContribution).toBeGreaterThan(6_480);
    expect(firstYear.cpfOaContribution).toBeGreaterThan(0);
    expect(firstYear.cpfSaContribution).toBeGreaterThan(0);
    expect(firstYear.cpfEmployerContribution).toBe(0);
  });

  it("uses the 2026 age-55-to-60 contribution rate for someone still working", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 56,
      retirementAge: 60,
      endAge: 56,
      currentCashSavings: 0,
      currentInvestments: 0,
      includeCpf: true,
      cpfWorkStatus: "Employed",
      grossMonthlyIncome: 5_000,
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0,
      cpfRa: 0,
      cpfLifeStartAge: 65,
      retirementSpendingAnnual: 0
    });

    const first = projection.rows[0];
    expect(first.cpfTotalContribution).toBeCloseTo(20_400, 0);
    expect(first.cpfEmployeeContribution).toBeCloseTo(10_800, 0);
    expect(first.cpfSaContribution).toBe(0);
    expect(first.cpfRaContribution).toBeGreaterThan(0);
  });

  it("migrates a legacy SA balance for a current age-55-plus profile", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 58,
      retirementAge: 65,
      endAge: 58,
      includeCpf: true,
      cpfWorkStatus: "Not contributing",
      cpfOa: 10_000,
      cpfSa: 100_000,
      cpfRa: 150_000,
      cpfMa: 0,
      retirementSpendingAnnual: 0
    });

    expect(projection.rows[0].cpfSa).toBe(0);
    expect(projection.rows[0].cpfRa).toBeGreaterThan(150_000);
  });

  it("aligns the age-65 Standard Plan estimate with CPF Board's 2026 reference example", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 55,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      includeCpf: true,
      cpfWorkStatus: "Not contributing",
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 0,
      cpfRa: 50_000,
      cpfLifeStartAge: 65,
      cpfLifePlan: "Standard",
      cpfLifeMonthlyOverride: 0,
      retirementSpendingAnnual: 0
    });

    expect(projection.summary.cpfLifeMonthlyAtStart).toBeCloseTo(490, -1);
  });

  it("deducts estimated CPF OA housing usage before retirement", () => {
    const withoutHousing = projectRetirement({
      ...defaultInputs,
      currentAge: 50,
      retirementAge: 65,
      endAge: 55,
      includeCpf: true,
      cpfWorkStatus: "Not contributing",
      grossMonthlyIncome: 0,
      cpfOa: 200_000,
      cpfSa: 0,
      cpfMa: 50_000,
      cpfOaHousingMonthly: 0
    });
    const withHousing = projectRetirement({
      ...defaultInputs,
      currentAge: 50,
      retirementAge: 65,
      endAge: 55,
      includeCpf: true,
      cpfWorkStatus: "Not contributing",
      grossMonthlyIncome: 0,
      cpfOa: 200_000,
      cpfSa: 0,
      cpfMa: 50_000,
      cpfOaHousingMonthly: 2_000
    });

    const housingYear = withHousing.rows.find((row) => row.age === 50)!;
    expect(housingYear.cpfOaHousingUsage).toBeCloseTo(24_000, 0);
    expect(withHousing.summary.projectedCpfRetirementFundingAt55).toBeLessThan(
      withoutHousing.summary.projectedCpfRetirementFundingAt55
    );
  });

  it("deducts estimated MediSave-paid medical premiums and leaves MA out of retirement funding target", () => {
    const projection = projectRetirement({
      ...defaultInputs,
      currentAge: 50,
      retirementAge: 65,
      endAge: 50,
      includeCpf: true,
      cpfWorkStatus: "Not contributing",
      cpfOa: 0,
      cpfSa: 0,
      cpfMa: 50_000,
      cpfMaMedicalPremiumAnnual: 2_400
    });

    const firstYear = projection.rows[0];
    expect(firstYear.cpfMaMedicalPremium).toBeCloseTo(2_400, 0);
    expect(firstYear.cpfMa).toBeLessThan(50_000 * 1.05);
    expect(projection.summary.projectedCpfRetirementFundingAt55).toBeGreaterThan(0);
    expect(projection.summary.projectedCpfRetirementFundingAt55).toBeLessThan(projection.summary.cpfBasicRetirementSumAt55);
    expect(projection.summary.cpfRetirementSumTierAt55).toBe("Below BRS");
  });

  it("ignores legacy healthcare add-ons because lifestyle presets include the health buffer", () => {
    const baseInputs = {
      ...defaultInputs,
      currentAge: 60,
      retirementAge: 65,
      endAge: 65,
      currentCashSavings: 0,
      currentInvestments: 0,
      cashSavingsContribution: 0,
      investmentContribution: 0,
      includeCpf: false,
      retirementSpendingAnnual: 36_000,
      retirementSpendingInflationRate: 0,
      healthcareCostAnnualToday: 6_000,
      healthcareInflationRate: 0,
      passiveIncomeYieldRate: 0
    };

    const withoutHealthcare = projectRetirement({ ...baseInputs, includeHealthcareCosts: false });
    const withLegacyHealthcare = projectRetirement({ ...baseInputs, includeHealthcareCosts: true });

    expect(withoutHealthcare.rows.find((row) => row.age === 65)?.healthcareCost).toBe(0);
    expect(withLegacyHealthcare.rows.find((row) => row.age === 65)?.healthcareCost).toBe(0);
    expect(withLegacyHealthcare.summary.totalRetirementNeed).toBe(withoutHealthcare.summary.totalRetirementNeed);
    expect(withLegacyHealthcare.summary.totalHealthcareCosts).toBe(0);
  });
});
