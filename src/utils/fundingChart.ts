import type { RetirementYear } from "../types";

export type FundingValueMode = "future" | "today";

export interface RetirementFundingRow {
  taxableIncome: number;
  srsGross: number;
  srsTax: number;
  srsNet: number;
  totalIncomeTax: number;
  age: number;
  spending: number;
  recurringSpending: number;
  oneTimeOutflow: number;
  cpfLife: number;
  dividends: number;
  customIncome: number;
  srs: number;
  cash: number;
  investments: number;
  cpf: number;
  shortfall: number;
  surplusIncome: number;
}

function allocate(available: number, remaining: number) {
  return Math.min(Math.max(available, 0), Math.max(remaining, 0));
}

export function buildRetirementFundingRows(rows: RetirementYear[]): RetirementFundingRow[] {
  return rows.filter((row) => row.phase === "retirement").map((row) => {
    const spending = Math.max(row.spendingNeed + row.oneTimeOutflow, 0);
    let remaining = spending;

    const cpfLife = allocate(row.cpfLifeIncome, remaining);
    remaining -= cpfLife;
    const dividends = allocate(row.passiveIncomeGenerated, remaining);
    remaining -= dividends;
    const customIncome = allocate(row.customIncomeGenerated, remaining);
    remaining -= customIncome;
    const taxableIncome = allocate((row.otherTaxableIncome ?? 0) - (row.otherIncomeTax ?? 0), remaining);
    remaining -= taxableIncome;
    const srs = allocate(row.srsNetWithdrawal, remaining);
    remaining -= srs;
    const cash = allocate(row.cashWithdrawal, remaining);
    remaining -= cash;
    const investments = allocate(row.investmentWithdrawal, remaining);
    remaining -= investments;
    const cpf = allocate(row.cpfDrawdown, remaining);
    remaining -= cpf;
    const shortfall = Math.max(remaining, 0);
    const totalIncome = row.cpfLifeIncome + row.passiveIncomeGenerated + row.customIncomeGenerated + row.srsNetWithdrawal + (row.otherTaxableIncome ?? 0) - (row.otherIncomeTax ?? 0);

    return {
      taxableIncome,
      srsGross: row.srsWithdrawal ?? 0,
      srsTax: row.srsEstimatedTax ?? 0,
      srsNet: row.srsNetWithdrawal,
      totalIncomeTax: row.totalIncomeTax ?? row.srsEstimatedTax ?? 0,
      age: row.age,
      spending,
      recurringSpending: row.spendingNeed,
      oneTimeOutflow: row.oneTimeOutflow,
      cpfLife,
      dividends,
      customIncome,
      srs,
      cash,
      investments,
      cpf,
      shortfall,
      surplusIncome: Math.max(totalIncome - spending, 0)
    };
  });
}

export function convertFundingRowsToTodayDollars(
  rows: RetirementFundingRow[],
  currentAge: number,
  inflationRate: number
): RetirementFundingRow[] {
  return rows.map((row) => {
    const divisor = Math.pow(1 + Math.max(inflationRate, 0) / 100, Math.max(row.age - currentAge, 0));
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, key === "age" ? value : Number(value) / divisor])
    ) as unknown as RetirementFundingRow;
  });
}
