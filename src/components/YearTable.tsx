import { useMemo, useState } from "react";
import type { RetirementYear } from "../types";
import { formatCurrency } from "../utils/formatters";

type TablePreset = "Overview" | "Income And SRS" | "CPF" | "Insurance" | "Drawdowns";

type Column = {
  key: string;
  label: string;
  value: (row: RetirementYear) => string;
};

const money = (value: number) => formatCurrency(value);

const columnsByPreset: Record<TablePreset, Column[]> = {
  Overview: [
    { key: "age", label: "Age", value: (row) => String(row.age) },
    { key: "phase", label: "Phase", value: (row) => row.phase === "build-up" ? "Build-up" : "Retirement" },
    { key: "cash", label: "Cash", value: (row) => money(row.endingCashSavings) },
    { key: "investments", label: "Investments", value: (row) => money(row.endingInvestments) },
    { key: "cpf", label: "CPF Total", value: (row) => money(row.cpfTotal) },
    { key: "srs", label: "SRS Balance", value: (row) => money(row.srsBalance) },
    { key: "spending", label: "Spending", value: (row) => money(row.spendingNeed) },
    { key: "shortfall", label: "Shortfall", value: (row) => money(row.shortfall) },
    { key: "wealth", label: "Total Wealth", value: (row) => money(row.endingBalance) }
  ],
  "Income And SRS": [
    { key: "age", label: "Age", value: (row) => String(row.age) },
    { key: "cpf-life", label: "CPF LIFE", value: (row) => money(row.cpfLifeIncome) },
    { key: "dividends", label: "Dividends", value: (row) => money(row.passiveIncomeGenerated) },
    { key: "custom", label: "Custom Income", value: (row) => money(row.customIncomeGenerated) },
    { key: "srs-contribution", label: "SRS Contribution", value: (row) => money(row.srsContribution) },
    { key: "srs-growth", label: "SRS Growth", value: (row) => money(row.srsGrowth) },
    { key: "srs-gross", label: "SRS Gross Withdrawal", value: (row) => money(row.srsWithdrawal) },
    { key: "srs-taxable", label: "SRS Taxable Amount", value: (row) => money(row.srsTaxableAmount) },
    { key: "srs-tax", label: "Estimated SRS Tax", value: (row) => money(row.srsEstimatedTax) },
    { key: "srs-net", label: "SRS Net Withdrawal", value: (row) => money(row.srsNetWithdrawal) },
    { key: "srs-cash", label: "SRS To Cash", value: (row) => money(row.srsTransferToCash) },
    { key: "srs-balance", label: "SRS Balance", value: (row) => money(row.srsBalance) }
  ],
  CPF: [
    { key: "age", label: "Age", value: (row) => String(row.age) },
    { key: "oa", label: "CPF OA", value: (row) => money(row.cpfOa) },
    { key: "sa", label: "CPF SA", value: (row) => money(row.cpfSa) },
    { key: "ma", label: "CPF MA", value: (row) => money(row.cpfMa) },
    { key: "ra", label: "CPF RA", value: (row) => money(row.cpfRa) },
    { key: "reserve", label: "CPF LIFE Reserve", value: (row) => money(row.cpfLifeReserve) },
    { key: "contribution", label: "CPF Contribution", value: (row) => money(row.cpfTotalContribution) },
    { key: "topup", label: "Retirement Cash Top-up", value: (row) => money(row.cpfRetirementTopUp) },
    { key: "topup-unfilled", label: "Top-up Not Funded / Capped", value: (row) => money(row.cpfRetirementTopUpUnfilled) },
    { key: "housing", label: "OA Housing Use", value: (row) => money(row.cpfOaHousingUsage) },
    { key: "medical", label: "MA Premiums", value: (row) => money(row.cpfMaMedicalPremium) }
  ],
  Insurance: [
    { key: "age", label: "Age", value: (row) => String(row.age) },
    { key: "total", label: "Total Annual Premium", value: (row) => money(row.insurancePremiumTotal) },
    { key: "ma-paid", label: "Paid From MediSave", value: (row) => money(row.cpfMaMedicalPremium) },
    { key: "cash", label: "Cash Premium Required", value: (row) => money(row.insuranceCashPremium) },
    { key: "ma", label: "Ending MediSave", value: (row) => money(row.cpfMa) },
    { key: "housing-cash", label: "Mortgage Cash Remainder", value: (row) => money(row.housingCashPayment) }
  ],
  Drawdowns: [
    { key: "age", label: "Age", value: (row) => String(row.age) },
    { key: "spending", label: "Spending", value: (row) => money(row.spendingNeed) },
    { key: "cash", label: "Cash Drawdown", value: (row) => money(row.cashWithdrawal) },
    { key: "investment", label: "Investment Drawdown", value: (row) => money(row.investmentWithdrawal) },
    { key: "sa", label: "CPF SA Drawdown", value: (row) => money(row.cpfSaDrawdown) },
    { key: "oa", label: "CPF OA Drawdown", value: (row) => money(row.cpfOaDrawdown) },
    { key: "shortfall", label: "Unfunded Shortfall", value: (row) => money(row.shortfall) }
  ]
};

export function YearTable({ rows }: { rows: RetirementYear[] }) {
  const [preset, setPreset] = useState<TablePreset>("Overview");
  const [ageFilter, setAgeFilter] = useState("");
  const columns = columnsByPreset[preset];
  const filteredRows = useMemo(() => {
    if (!ageFilter) return rows;
    const age = Number(ageFilter);
    return Number.isFinite(age) ? rows.filter((row) => row.age === age) : rows;
  }, [ageFilter, rows]);

  return (
    <div className="year-data-view">
      <div className="year-data-controls">
        <div className="year-data-presets" aria-label="Year data view">
          {(Object.keys(columnsByPreset) as TablePreset[]).map((option) => (
            <button
              className={preset === option ? "is-active" : ""}
              type="button"
              key={option}
              onClick={() => setPreset(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="year-age-filter">
          <span>Jump To Age</span>
          <input
            type="number"
            inputMode="numeric"
            min={rows[0]?.age}
            max={rows.at(-1)?.age}
            placeholder="All"
            value={ageFilter}
            onChange={(event) => setAgeFilter(event.target.value)}
          />
        </label>
      </div>

      <p className="year-data-note">
        {preset === "Insurance" ? "Premiums are annual estimates, split between actual MediSave use and the cash amount required. Cash premiums and any mortgage remainder are included in spending; if assets cannot cover them they become an unfunded shortfall. Balances are year-end values."
          : preset === "CPF" ? "Balances are at year end. Contributions exclude the separately shown retirement cash top-up. Top-ups are limited by cash and estimated FRS/ERS headroom; unfilled amounts are not credited. Annual timing and existing RA principal are approximations, not CPF account statements."
          : "Values are annual flows or end-of-year balances. SRS tax is an estimate based on 50% of a qualifying withdrawal being taxable and assumes no other taxable income."}
      </p>

      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.age} className={row.shortfall > 0 ? "has-shortfall" : ""}>
                {columns.map((column) => <td key={column.key}>{column.value(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="year-cards">
        {filteredRows.map((row) => (
          <article className={row.shortfall > 0 ? "has-shortfall" : ""} key={row.age}>
            <header><strong>Age {row.age}</strong><span>{row.phase === "build-up" ? "Build-up" : "Retirement"}</span></header>
            <dl>
              {columns.filter((column) => !["age", "phase"].includes(column.key)).map((column) => (
                <div key={column.key}><dt>{column.label}</dt><dd>{column.value(row)}</dd></div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
