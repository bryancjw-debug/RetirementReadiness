import { describe, expect, it } from "vitest";
import type { RetirementYear } from "../types";
import { buildRetirementFundingRows, convertFundingRowsToTodayDollars } from "./fundingChart";

function retirementRow(overrides: Partial<RetirementYear> = {}): RetirementYear {
  return {
    age: 65,
    phase: "retirement",
    spendingNeed: 60_000,
    oneTimeOutflow: 0,
    cpfLifeIncome: 24_000,
    passiveIncomeGenerated: 6_000,
    customIncomeGenerated: 0,
    srsNetWithdrawal: 0,
    cashWithdrawal: 12_000,
    investmentWithdrawal: 18_000,
    cpfDrawdown: 0,
    shortfall: 0,
    ...overrides
  } as RetirementYear;
}

describe("retirement funding chart", () => {
  it("reconciles the funding stack to the annual spending requirement", () => {
    const [row] = buildRetirementFundingRows([retirementRow()]);
    const displayedFunding = row.cpfLife + row.dividends + row.customIncome + row.srs + row.cash + row.investments + row.cpf + row.shortfall;

    expect(displayedFunding).toBe(row.spending);
    expect(row.cpfLife).toBe(24_000);
    expect(row.investments).toBe(18_000);
  });

  it("caps income shown as used and records surplus income separately", () => {
    const [row] = buildRetirementFundingRows([retirementRow({ spendingNeed: 20_000, cpfLifeIncome: 24_000, cashWithdrawal: 0, investmentWithdrawal: 0 })]);

    expect(row.cpfLife).toBe(20_000);
    expect(row.cash).toBe(0);
    expect(row.surplusIncome).toBe(10_000);
  });

  it("includes one-time retirement outflows in the requirement", () => {
    const [row] = buildRetirementFundingRows([retirementRow({ oneTimeOutflow: 10_000, investmentWithdrawal: 28_000 })]);

    expect(row.spending).toBe(70_000);
    expect(row.investments).toBe(28_000);
  });

  it("converts every monetary series to purchasing power without changing age", () => {
    const [row] = convertFundingRowsToTodayDollars(buildRetirementFundingRows([retirementRow()]), 64, 2.5);

    expect(row.age).toBe(65);
    expect(row.spending).toBeCloseTo(60_000 / 1.025, 4);
  });
});
