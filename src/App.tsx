import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { BadgeCheck, Calculator, CircleAlert, Moon, Plus, RotateCcw, ShieldCheck, Sun, Trash2 } from "lucide-react";
import { cpfContributionForYear, defaultInputs, projectRetirement } from "./utils/projection";
import { formatCurrency, formatNumber, formatPercent } from "./utils/formatters";
import type {
  CpfLifePlan,
  CpfPrRateType,
  CpfPrYear,
  CpfResidencyStatus,
  CpfWorkStatus,
  CustomIncomeFrequency,
  CustomIncomeGrowthMode,
  CustomIncomeStream,
  RetirementIncomeMethod,
  RetirementInputs,
  RetirementLifestylePreset,
  RetirementSumChoice,
  RetirementYear
} from "./types";

const lifestylePresets: Array<{
  id: Exclude<RetirementLifestylePreset, "Custom">;
  label: string;
  monthlyAmount: number;
  note: string;
  breakdown: Array<{ label: string; share: number }>;
}> = [
  {
    id: "Essential",
    label: "Essential",
    monthlyAmount: 2_500,
    note: "A practical baseline for food, transport, utilities, basic leisure, and a built-in health buffer.",
    breakdown: [
      { label: "Daily living", share: 45 },
      { label: "Housing and utilities", share: 20 },
      { label: "Transport", share: 12 },
      { label: "Healthcare buffer", share: 13 },
      { label: "Leisure and family", share: 10 }
    ]
  },
  {
    id: "Comfortable",
    label: "Comfortable",
    monthlyAmount: 3_500,
    note: "A balanced target for regular dining, hobbies, family support, medical buffer, and local leisure.",
    breakdown: [
      { label: "Daily living", share: 36 },
      { label: "Housing and utilities", share: 18 },
      { label: "Transport", share: 12 },
      { label: "Healthcare buffer", share: 16 },
      { label: "Leisure and family", share: 18 }
    ]
  },
  {
    id: "Luxurious",
    label: "Luxurious",
    monthlyAmount: 8_000,
    note: "A generous lifestyle allowance for travel, family giving, premium experiences, and wider discretionary choices.",
    breakdown: [
      { label: "Daily living", share: 28 },
      { label: "Housing and utilities", share: 16 },
      { label: "Transport", share: 12 },
      { label: "Healthcare buffer", share: 18 },
      { label: "Travel and lifestyle", share: 26 }
    ]
  }
];

function numberValue(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function annualToMonthly(value: number) {
  return Number.isFinite(value) ? value / 12 : 0;
}

function monthlyToAnnual(value: number) {
  return Number.isFinite(value) ? value * 12 : 0;
}

function NumberField({
  label,
  helper,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  step = 1
}: {
  label: string;
  helper?: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field__input">
        {prefix ? <b>{prefix}</b> : null}
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={numberValue(value)}
          onChange={(event) => onChange(event.target.value === "" ? 0 : Number(event.target.value))}
        />
        {suffix ? <b>{suffix}</b> : null}
      </div>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  helper,
  value,
  options,
  labels,
  onChange
}: {
  label: string;
  helper?: string;
  value: T;
  options: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function TextField({
  label,
  helper,
  value,
  onChange,
  placeholder
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button className={`toggle-row ${checked ? "is-on" : ""}`} type="button" onClick={() => onChange(!checked)}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <i aria-hidden="true" />
    </button>
  );
}

function Section({
  number,
  title,
  helper,
  children
}: {
  number: string;
  title: string;
  helper: string;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <div className="section-card__header">
        <span>{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{helper}</p>
        </div>
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  note,
  tone = "neutral"
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "good" | "warn" | "blue";
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function GapOptionCard({
  label,
  value,
  note,
  tone = "blue"
}: {
  label: string;
  value: string;
  note: string;
  tone?: "good" | "warn" | "blue";
}) {
  return (
    <article className={`gap-option gap-option--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>Age {label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} style={{ color: item.color }}>
          <span>{item.name}</span>
          <b>{formatCurrency(Number(item.value))}</b>
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <span key={item.label}>
          <i className={item.className} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

type ThemePreference = "light" | "dark";

function getInitialTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem("retirement-readiness-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function createCustomIncomeStream(inputs: RetirementInputs): CustomIncomeStream {
  return {
    id: `income-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: "Retirement plan payout",
    startAge: inputs.retirementAge,
    endAge: inputs.endAge,
    amount: 0,
    frequency: "monthly",
    growthMode: "fixed",
    annualIncreaseRate: 0
  };
}

function YearTable({ rows }: { rows: RetirementYear[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Age</th>
            <th>Phase</th>
            <th>Cash</th>
            <th>Investments</th>
            <th>CPF OA</th>
            <th>CPF SA</th>
            <th>CPF MA</th>
            <th>CPF RA</th>
            <th>CPF LIFE Reserve</th>
            <th>OA Housing Use</th>
            <th>MA Premiums</th>
            <th>CPF LIFE</th>
            <th>Dividends</th>
            <th>Custom Income</th>
            <th>Healthcare Costs</th>
            <th>Spending</th>
            <th>Cash Drawdown</th>
            <th>Investment Drawdown</th>
            <th>CPF SA Drawdown</th>
            <th>CPF OA Drawdown</th>
            <th>Shortfall</th>
            <th>Total Wealth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.age} className={row.shortfall > 0 ? "has-shortfall" : ""}>
              <td>{row.age}</td>
              <td>{row.phase === "build-up" ? "Build-up" : "Retirement"}</td>
              <td>{formatCurrency(row.endingCashSavings)}</td>
              <td>{formatCurrency(row.endingInvestments)}</td>
              <td>{formatCurrency(row.cpfOa)}</td>
              <td>{formatCurrency(row.cpfSa)}</td>
              <td>{formatCurrency(row.cpfMa)}</td>
              <td>{formatCurrency(row.cpfRa)}</td>
              <td>{formatCurrency(row.cpfLifeReserve)}</td>
              <td>{formatCurrency(row.cpfOaHousingUsage)}</td>
              <td>{formatCurrency(row.cpfMaMedicalPremium)}</td>
              <td>{formatCurrency(row.cpfLifeIncome)}</td>
              <td>{formatCurrency(row.passiveIncomeGenerated)}</td>
              <td>{formatCurrency(row.customIncomeGenerated)}</td>
              <td>{formatCurrency(row.healthcareCost)}</td>
              <td>{formatCurrency(row.spendingNeed)}</td>
              <td>{formatCurrency(row.cashWithdrawal)}</td>
              <td>{formatCurrency(row.investmentWithdrawal)}</td>
              <td>{formatCurrency(row.cpfSaDrawdown)}</td>
              <td>{formatCurrency(row.cpfOaDrawdown)}</td>
              <td>{formatCurrency(row.shortfall)}</td>
              <td>{formatCurrency(row.endingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadinessPanel({ projection, inputs }: { projection: ReturnType<typeof projectRetirement>; inputs: RetirementInputs }) {
  const ready = projection.summary.status === "ready";
  return (
    <aside className={`readiness-panel ${ready ? "is-ready" : "needs-work"}`}>
      <div className="readiness-gauge" style={{ "--score": `${projection.summary.readinessPercent}%` } as CSSProperties}>
        <div>
          <strong>{Math.round(projection.summary.readinessPercent)}%</strong>
          <span>Ready</span>
        </div>
      </div>
      <div className="readiness-panel__copy">
        <p className="eyebrow">RetirementReadiness</p>
        <h2>{ready ? "You look retirement ready." : "There is a projected gap."}</h2>
        <p>{projection.summary.headline}</p>
      </div>
      <div className="readiness-panel__stats">
        <div>
          <span>Shortfall</span>
          <strong className={projection.summary.totalShortfall > 0 ? "negative" : "positive"}>
            {formatCurrency(projection.summary.totalShortfall)}
          </strong>
        </div>
        <div>
          <span>Invest More Monthly</span>
          <strong>{formatCurrency(projection.summary.extraMonthlyInvestmentRequired)}</strong>
        </div>
        <div>
          <span>Funds Last Until</span>
          <strong>Age {projection.summary.runwayAge}</strong>
        </div>
        <div>
          <span>CPF LIFE Starts</span>
          <strong>Age {inputs.cpfLifeStartAge}</strong>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [inputs, setInputs] = useState<RetirementInputs>(defaultInputs);
  const [showTable, setShowTable] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);
  const projection = useMemo(() => projectRetirement(inputs), [inputs]);
  const cpfPreview = cpfContributionForYear(inputs, inputs.currentAge);
  const retirementRow = projection.rows.find((row) => row.age === inputs.retirementAge);
  const monthlyRetirementSpendingToday = annualToMonthly(inputs.retirementSpendingAnnual);
  const yearsUntilRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const projectedMonthlyRetirementSpending =
    monthlyRetirementSpendingToday * Math.pow(1 + inputs.retirementSpendingInflationRate / 100, yearsUntilRetirement);
  const cpfLifeBridgeYears = Math.max(0, inputs.cpfLifeStartAge - inputs.retirementAge);
  const selectedLifestylePreset = lifestylePresets.find((preset) => preset.id === inputs.retirementLifestylePreset);
  const projectedMonthlyGoalAtRetirement = projectedMonthlyRetirementSpending;
  const drawdownTotals = projection.rows.reduce(
    (totals, row) => {
      if (row.phase !== "retirement") return totals;
      totals.retirementIncome += row.cpfLifeIncome + row.passiveIncomeGenerated + row.customIncomeGenerated;
      totals.cash += row.cashWithdrawal;
      totals.investments += row.investmentWithdrawal;
      totals.cpf += row.cpfDrawdown;
      totals.shortfall += row.shortfall;
      return totals;
    },
    { retirementIncome: 0, cash: 0, investments: 0, cpf: 0, shortfall: 0 }
  );
  const drawdownWaterfallTotal = Math.max(
    1,
    drawdownTotals.retirementIncome + drawdownTotals.cash + drawdownTotals.investments + drawdownTotals.cpf + drawdownTotals.shortfall
  );

  const chartRows = projection.rows.map((row) => ({
    age: row.age,
    totalWealth: Math.round(row.endingBalance),
    cash: Math.round(row.endingCashSavings),
    investments: Math.round(row.endingInvestments),
    cpfOa: Math.round(row.cpfOa),
    cpfSa: Math.round(row.cpfSa),
    cpfRa: Math.round(row.cpfRa + row.cpfLifeReserve),
    cpfMa: Math.round(row.cpfMa),
    cpfLifeIncome: Math.round(row.cpfLifeIncome),
    passiveIncome: Math.round(row.passiveIncomeGenerated),
    customIncome: Math.round(row.customIncomeGenerated),
    healthcareCost: Math.round(row.healthcareCost),
    income: Math.round(row.passiveIncomeGenerated + row.cpfLifeIncome + row.customIncomeGenerated),
    spending: Math.round(row.spendingNeed),
    cashWithdrawal: Math.round(row.cashWithdrawal),
    investmentWithdrawal: Math.round(row.investmentWithdrawal),
    cpfDrawdown: Math.round(row.cpfDrawdown),
    shortfall: Math.round(row.shortfall)
  }));

  function updateInput<K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function addCustomIncomeStream() {
    setInputs((current) => ({
      ...current,
      customIncomeStreams: [...current.customIncomeStreams, createCustomIncomeStream(current)]
    }));
  }

  function updateCustomIncomeStream(id: string, patch: Partial<CustomIncomeStream>) {
    setInputs((current) => ({
      ...current,
      customIncomeStreams: current.customIncomeStreams.map((stream) => (
        stream.id === id ? { ...stream, ...patch } : stream
      ))
    }));
  }

  function removeCustomIncomeStream(id: string) {
    setInputs((current) => ({
      ...current,
      customIncomeStreams: current.customIncomeStreams.filter((stream) => stream.id !== id)
    }));
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("retirement-readiness-theme", theme);
  }, [theme]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Simple Singapore Retirement Checkup</p>
          <h1>RetirementReadiness</h1>
          <p>
            A calm, one-page retirement projection. Enter a few numbers, and see whether your cash, investments,
            CPF drawdowns, and CPF LIFE can support your retirement spending.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button className="reset-button" type="button" onClick={() => setInputs(defaultInputs)}>
            <RotateCcw size={18} />
            Reset Sample
          </button>
        </div>
      </section>

      <section className="summary-strip" aria-label="Projection assumptions">
        <div>
          <span>Inflation</span>
          <strong>2.5% p.a.</strong>
        </div>
        <div>
          <span>Cash Savings</span>
          <strong>1% p.a.</strong>
        </div>
        <div>
          <span>Investments</span>
          <strong>5% p.a.</strong>
        </div>
        <div>
          <span>CPF</span>
          <strong>Official Rate Tables</strong>
        </div>
      </section>

      <div className="page-grid">
        <div className="input-flow">
          <Section number="1" title="About You" helper="These ages decide when saving stops, retirement spending starts, and when CPF LIFE begins.">
            <div className="field-grid">
              <NumberField label="Current Age" value={inputs.currentAge} onChange={(value) => updateInput("currentAge", value)} />
              <NumberField label="Retirement Age" value={inputs.retirementAge} onChange={(value) => updateInput("retirementAge", value)} />
              <NumberField label="Project Until Age" helper="Use 90 or 100 if unsure." value={inputs.endAge} onChange={(value) => updateInput("endAge", value)} />
            </div>
          </Section>

          <Section number="2" title="Your Retirement Goal" helper="Start with the spending target. This immediately shows how inflation changes the number by retirement age.">
            <div className="lifestyle-grid" aria-label="Retirement lifestyle presets">
              {lifestylePresets.map((preset) => (
                <button
                  className={`lifestyle-card ${inputs.retirementLifestylePreset === preset.id ? "is-selected" : ""}`}
                  type="button"
                  key={preset.id}
                  onClick={() => {
                    updateInput("retirementLifestylePreset", preset.id);
                    updateInput("retirementSpendingAnnual", monthlyToAnnual(preset.monthlyAmount));
                  }}
                >
                  <span>{preset.label}</span>
                  <strong>{formatCurrency(preset.monthlyAmount)} / month</strong>
                  <small>Today's SGD</small>
                </button>
              ))}
            </div>
            <div className="lifestyle-breakdown">
              <div>
                <p className="eyebrow">Lifestyle Preset</p>
                <h3>{selectedLifestylePreset?.label ?? "Custom"} spending target</h3>
                <p>
                  {selectedLifestylePreset?.note ?? "Use your own monthly number if the preset does not match the client's retirement lifestyle."}
                </p>
              </div>
              {selectedLifestylePreset ? (
                <div className="lifestyle-bars" aria-label={`${selectedLifestylePreset.label} spending breakdown`}>
                  {selectedLifestylePreset.breakdown.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <i><b style={{ width: `${item.share}%` }} /></i>
                      <strong>{item.share}%</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="field-grid">
              <NumberField
                label="Monthly Retirement Spending"
                helper="Today's SGD. The app projects it to retirement age using inflation."
                prefix="$"
                value={monthlyRetirementSpendingToday}
                onChange={(value) => {
                  updateInput("retirementLifestylePreset", "Custom");
                  updateInput("retirementSpendingAnnual", monthlyToAnnual(value));
                }}
              />
              <NumberField label="Inflation" suffix="%" step={0.1} value={inputs.retirementSpendingInflationRate} onChange={(value) => updateInput("retirementSpendingInflationRate", value)} />
            </div>
            <div className="reality-check" aria-label="Retirement spending preview">
              <div className="reality-check__copy">
                <p className="eyebrow">Retirement Reality Check</p>
                <h3>{formatCurrency(projectedMonthlyGoalAtRetirement)} per month at age {inputs.retirementAge}</h3>
                <p>
                  This uses today's spending and your inflation assumption to show the future monthly target.
                </p>
              </div>
              <div className="reality-check__metrics">
                <MetricCard label="Today's Monthly Spending" value={formatCurrency(monthlyRetirementSpendingToday)} note="Entered in today's dollars" tone="blue" />
                <MetricCard label="Projected At Retirement" value={formatCurrency(projectedMonthlyRetirementSpending)} note={`After ${yearsUntilRetirement} years of inflation`} tone="good" />
                <MetricCard
                  label="CPF LIFE Bridge"
                  value={cpfLifeBridgeYears > 0 ? `${cpfLifeBridgeYears} years` : "No bridge gap"}
                  note={cpfLifeBridgeYears > 0 ? `Retirement starts before CPF LIFE at age ${inputs.cpfLifeStartAge}` : "CPF LIFE starts by retirement age"}
                  tone={cpfLifeBridgeYears > 0 ? "warn" : "good"}
                />
              </div>
            </div>
          </Section>

          <Section number="3" title="What You Have Today" helper="Enter today's retirement assets, CPF balances, and CPF contributions if CPF LIFE is part of the plan. CPF MA is tracked, but not used for retirement drawdown.">
            <div className="field-grid">
              <NumberField label="Cash Savings" prefix="$" value={inputs.currentCashSavings} onChange={(value) => updateInput("currentCashSavings", value)} />
              <NumberField label="Investment Portfolio" prefix="$" value={inputs.currentInvestments} onChange={(value) => updateInput("currentInvestments", value)} />
            </div>
            <ToggleRow
              title="Include CPF Balances"
              description="Recommended for Singapore users. This also unlocks CPF contributions from income, CPF housing usage, and CPF medical premium assumptions."
              checked={inputs.includeCpf}
              onChange={(checked) => updateInput("includeCpf", checked)}
            />
            {inputs.includeCpf ? (
              <>
                <div className="field-grid">
                  <NumberField label="CPF OA" prefix="$" value={inputs.cpfOa} onChange={(value) => updateInput("cpfOa", value)} />
                  <NumberField label="CPF SA" prefix="$" value={inputs.cpfSa} onChange={(value) => updateInput("cpfSa", value)} />
                  <NumberField label="CPF MA" prefix="$" value={inputs.cpfMa} onChange={(value) => updateInput("cpfMa", value)} />
                  <NumberField label="CPF RA" helper="Leave as 0 if you are below 55 and RA has not formed." prefix="$" value={inputs.cpfRa} onChange={(value) => updateInput("cpfRa", value)} />
                </div>
                <div className="field-grid">
                  <NumberField
                    label="CPF OA Used For Housing Monthly"
                    helper="Simple estimate for downpayment/loan instalments paid from OA before retirement."
                    prefix="$"
                    value={inputs.cpfOaHousingMonthly}
                    onChange={(value) => updateInput("cpfOaHousingMonthly", value)}
                  />
                  <NumberField
                    label="CPF MA Medical Premiums Yearly"
                    helper="Estimate MediShield Life, Integrated Shield, CareShield, or other MediSave-paid premiums."
                    prefix="$"
                    value={inputs.cpfMaMedicalPremiumAnnual}
                    onChange={(value) => updateInput("cpfMaMedicalPremiumAnnual", value)}
                  />
                </div>
                <div className="divider" />
                <ToggleRow
                  title="Include CPF Contributions From Income"
                  description="Turn this on if you are employed or self-employed before retirement. This affects CPF balances and estimated CPF LIFE funding."
                  checked={inputs.cpfWorkStatus !== "Not contributing"}
                  onChange={(checked) => {
                    updateInput("cpfWorkStatus", checked ? "Employed" : "Not contributing");
                  }}
                />
                {inputs.cpfWorkStatus !== "Not contributing" ? (
                  <>
                    <div className="field-grid">
                      <SelectField<CpfWorkStatus>
                        label="Work Type"
                        value={inputs.cpfWorkStatus}
                        options={["Employed", "Self-employed", "Not contributing"]}
                        onChange={(value) => updateInput("cpfWorkStatus", value)}
                      />
                      <NumberField label="Gross Monthly Income" prefix="$" value={inputs.grossMonthlyIncome} onChange={(value) => updateInput("grossMonthlyIncome", value)} />
                      <SelectField<CpfResidencyStatus>
                        label="CPF Residency"
                        value={inputs.cpfResidency}
                        options={["Singapore Citizen", "Permanent Resident"]}
                        onChange={(value) => updateInput("cpfResidency", value)}
                      />
                      <NumberField label="Income Growth" suffix="%" step={0.1} value={inputs.incomeGrowthRate} onChange={(value) => updateInput("incomeGrowthRate", value)} />
                    </div>
                    {inputs.cpfResidency === "Permanent Resident" ? (
                      <div className="field-grid">
                        <SelectField<CpfPrYear>
                          label="PR CPF Year"
                          value={inputs.cpfPrYear}
                          options={["First Year", "Second Year", "Third Year Or Later"]}
                          onChange={(value) => updateInput("cpfPrYear", value)}
                        />
                        <SelectField<CpfPrRateType>
                          label="PR Contribution Basis"
                          value={inputs.cpfPrRateType}
                          options={["Graduated Employer And Employee", "Full Employer And Graduated Employee", "Full Employer And Employee"]}
                          onChange={(value) => updateInput("cpfPrRateType", value)}
                        />
                      </div>
                    ) : null}
                    {inputs.cpfWorkStatus === "Self-employed" ? (
                      <NumberField
                        label="Annual MediSave Override"
                        helper="Optional. Leave as 0 to estimate mandatory self-employed MediSave."
                        prefix="$"
                        value={inputs.selfEmployedAnnualMedisaveOverride}
                        onChange={(value) => updateInput("selfEmployedAnnualMedisaveOverride", value)}
                      />
                    ) : null}
                    <div className="mini-metrics">
                      <MetricCard label="Annual Income" value={formatCurrency(inputs.grossMonthlyIncome * 12)} note="Before CPF contribution" tone="blue" />
                      <MetricCard label="Your CPF Portion" value={formatCurrency(cpfPreview.employee)} note={inputs.cpfWorkStatus === "Self-employed" ? "MediSave only" : "Employee contribution"} />
                      <MetricCard label="Employer CPF" value={formatCurrency(cpfPreview.employer)} note={inputs.cpfWorkStatus === "Self-employed" ? "Not applicable" : "Estimated employer portion"} />
                    </div>
                  </>
                ) : (
                  <p className="helper-note">No active-income CPF will be added. Existing CPF balances and CPF LIFE can still be projected below.</p>
                )}
              </>
            ) : null}
          </Section>

          <Section number="4" title="Building Towards Tomorrow" helper="Use monthly amounts. The app annualises them and stops them from your retirement age.">
            <div className="field-grid">
              <NumberField label="Monthly Cash Savings" prefix="$" value={inputs.cashSavingsContribution} onChange={(value) => updateInput("cashSavingsContribution", value)} />
              <NumberField label="Monthly Investment Amount" prefix="$" value={inputs.investmentContribution} onChange={(value) => updateInput("investmentContribution", value)} />
              <NumberField label="Yearly Increase" helper="Optional annual increase to your monthly saving amounts." suffix="%" step={0.1} value={inputs.annualContributionIncreaseRate} onChange={(value) => updateInput("annualContributionIncreaseRate", value)} />
              <NumberField label="Cash Savings Rate" suffix="%" step={0.1} value={inputs.cashInterestRate} onChange={(value) => updateInput("cashInterestRate", value)} />
              <NumberField label="Investment Return Before Retirement" suffix="%" step={0.1} value={inputs.preRetirementInvestmentReturnRate} onChange={(value) => updateInput("preRetirementInvestmentReturnRate", value)} />
            </div>
          </Section>

          <Section number="5" title="CPF LIFE Planning" helper="CPF LIFE begins at the selected start age. If you retire before 65, the app shows the gap before CPF LIFE starts.">
            {inputs.includeCpf ? (
              <>
                <div className="mini-metrics">
                  <MetricCard label="CPF OA At 55" value={formatCurrency(projection.summary.projectedCpfOaAt55)} note="Remaining OA after housing and RA transfer" tone="blue" />
                  <MetricCard label="CPF RA At 55" value={formatCurrency(projection.summary.projectedCpfRaAt55)} note="Amount supporting CPF LIFE payouts" tone="good" />
                  <MetricCard label="CPF MA At 55" value={formatCurrency(projection.summary.projectedCpfMaAt55)} note="Healthcare account; not used for retirement drawdown" tone="blue" />
                  <MetricCard label="Selected Target" value={formatCurrency(projection.summary.cpfRetirementSumAt55)} note={`${inputs.cpfRetirementSum} retirement sum`} tone="blue" />
                  <MetricCard label="CPF LIFE / Month" value={formatCurrency(projection.summary.cpfLifeMonthlyAtStart)} note={`Starts at age ${inputs.cpfLifeStartAge}`} tone="good" />
                </div>
                <div className="cpf-outlook">
                  <div>
                    <span>BRS</span>
                    <strong>{formatCurrency(projection.summary.cpfBasicRetirementSumAt55)}</strong>
                  </div>
                  <div>
                    <span>FRS</span>
                    <strong>{formatCurrency(projection.summary.cpfFullRetirementSumAt55)}</strong>
                  </div>
                  <div>
                    <span>ERS</span>
                    <strong>{formatCurrency(projection.summary.cpfEnhancedRetirementSumAt55)}</strong>
                  </div>
                  <div className={projection.summary.cpfRetirementSumShortfallAt55 > 0 ? "is-short" : "is-excess"}>
                    <span>{projection.summary.cpfRetirementSumShortfallAt55 > 0 ? "Target Shortfall" : "Excess Over FRS"}</span>
                    <strong>
                      {formatCurrency(
                        projection.summary.cpfRetirementSumShortfallAt55 > 0
                          ? projection.summary.cpfRetirementSumShortfallAt55
                          : projection.summary.cpfRetirementSumExcessAt55
                      )}
                    </strong>
                  </div>
                </div>
                <article className="cpf-readiness-card">
                  <div>
                    <p className="eyebrow">CPF Readiness Result</p>
                    <h3>{projection.summary.cpfRetirementSumTierAt55}</h3>
                    <p>
                      At age 55, CPF RA is formed using SA first, then OA. This estimate shows how much more OA
                      could still be transferred to RA, and the remaining CPF amount that may be available outside
                      the selected RA target.
                    </p>
                  </div>
                  <div className="cpf-readiness-card__metrics">
                    <MetricCard
                      label="OA Transfer Room"
                      value={formatCurrency(projection.summary.availableOaTransferToRaAt55)}
                      note="Estimated room up to ERS"
                      tone="blue"
                    />
                    <MetricCard
                      label="Estimated CPF Withdrawable"
                      value={formatCurrency(projection.summary.estimatedCpfWithdrawableAt55)}
                      note="Approximation; CPF withdrawal rules depend on eligibility and property pledge"
                      tone="good"
                    />
                  </div>
                </article>
                <div className="field-grid">
                  <NumberField label="CPF LIFE Start Age" value={inputs.cpfLifeStartAge} onChange={(value) => updateInput("cpfLifeStartAge", value)} />
                  <NumberField
                    label="OA To RA Transfer At 55"
                    helper="Optional. Models moving available OA into RA to increase CPF LIFE payouts, capped by ERS."
                    prefix="$"
                    value={inputs.cpfOaToRaTransferAt55}
                    onChange={(value) => updateInput("cpfOaToRaTransferAt55", value)}
                  />
                  <SelectField<RetirementSumChoice>
                    label="Retirement Sum"
                    value={inputs.cpfRetirementSum}
                    options={["Basic", "Full", "Enhanced"]}
                    labels={{ Basic: "Basic Retirement Sum", Full: "Full Retirement Sum", Enhanced: "Enhanced Retirement Sum" }}
                    onChange={(value) => updateInput("cpfRetirementSum", value)}
                  />
                  <SelectField<CpfLifePlan>
                    label="CPF LIFE Plan"
                    value={inputs.cpfLifePlan}
                    options={["Standard", "Basic", "Escalating"]}
                    onChange={(value) => updateInput("cpfLifePlan", value)}
                  />
                  <NumberField label="Official Monthly Payout Override" helper="Optional. Enter CPF estimator result if known." prefix="$" value={inputs.cpfLifeMonthlyOverride} onChange={(value) => updateInput("cpfLifeMonthlyOverride", value)} />
                </div>
              </>
            ) : (
              <p className="helper-note">Turn on CPF balances in step 3 to project CPF LIFE.</p>
            )}
          </Section>

          <Section number="6" title="Other Retirement Income" helper="Add plan payouts, annuities, and portfolio-income assumptions that support retirement spending.">
            <details className="assumption-details">
              <summary>Fine tune retirement income assumptions</summary>
              <div className="field-grid">
                <NumberField label="Investment Growth During Retirement" suffix="%" step={0.1} value={inputs.retirementReturnRate} onChange={(value) => updateInput("retirementReturnRate", value)} />
                <NumberField label="Passive Income Yield" helper="Dividends, coupons, or portfolio income." suffix="%" step={0.1} value={inputs.passiveIncomeYieldRate} onChange={(value) => updateInput("passiveIncomeYieldRate", value)} />
                <SelectField<RetirementIncomeMethod>
                  label="Drawdown Style"
                  value={inputs.retirementIncomeMethod}
                  options={["passive", "fixed", "dynamic"]}
                  labels={{ passive: "Use income first", fixed: "Fixed annual withdrawal", dynamic: "Percentage withdrawal" }}
                  onChange={(value) => updateInput("retirementIncomeMethod", value)}
                />
                {inputs.retirementIncomeMethod === "fixed" ? (
                  <NumberField label="Fixed Annual Withdrawal" prefix="$" value={inputs.fixedWithdrawalAnnual} onChange={(value) => updateInput("fixedWithdrawalAnnual", value)} />
                ) : null}
                {inputs.retirementIncomeMethod === "dynamic" ? (
                  <NumberField label="Withdrawal Rate" suffix="%" step={0.1} value={inputs.dynamicWithdrawalRate} onChange={(value) => updateInput("dynamicWithdrawalRate", value)} />
                ) : null}
              </div>
            </details>
            <div className="custom-income-panel">
              <div className="custom-income-panel__header">
                <div>
                  <h3>Other Retirement Income</h3>
                  <p>
                    Add annuity, endowment, retirement-plan, or guaranteed payout streams. These payouts reduce
                    the drawdown needed from cash, investments, CPF OA, and CPF SA.
                  </p>
                </div>
                <button className="secondary-action" type="button" onClick={addCustomIncomeStream}>
                  <Plus size={18} />
                  Add Income Stream
                </button>
              </div>
              {inputs.customIncomeStreams.length === 0 ? (
                <div className="empty-state">
                  <strong>No extra income streams added.</strong>
                  <span>Skip this if CPF LIFE and portfolio income are the only retirement income sources.</span>
                </div>
              ) : (
                <div className="custom-income-list">
                  {inputs.customIncomeStreams.map((stream, index) => (
                    <article className="custom-income-card" key={stream.id}>
                      <div className="custom-income-card__top">
                        <strong>Income Stream {index + 1}</strong>
                        <button
                          className="icon-action danger"
                          type="button"
                          aria-label={`Remove ${stream.label || `Income Stream ${index + 1}`}`}
                          onClick={() => removeCustomIncomeStream(stream.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                      <div className="field-grid">
                        <TextField
                          label="Name"
                          placeholder="e.g. Annuity payout"
                          value={stream.label}
                          onChange={(value) => updateCustomIncomeStream(stream.id, { label: value })}
                        />
                        <NumberField
                          label="Payout Amount"
                          helper={stream.frequency === "monthly" ? "Monthly payout amount." : "Annual payout amount."}
                          prefix="$"
                          value={stream.amount}
                          onChange={(value) => updateCustomIncomeStream(stream.id, { amount: value })}
                        />
                        <NumberField
                          label="Start Age"
                          value={stream.startAge}
                          onChange={(value) => updateCustomIncomeStream(stream.id, { startAge: value })}
                        />
                        <NumberField
                          label="End Age"
                          value={stream.endAge}
                          onChange={(value) => updateCustomIncomeStream(stream.id, { endAge: value })}
                        />
                        <SelectField<CustomIncomeFrequency>
                          label="Payout Frequency"
                          value={stream.frequency}
                          options={["monthly", "yearly"]}
                          labels={{ monthly: "Monthly", yearly: "Annually" }}
                          onChange={(value) => updateCustomIncomeStream(stream.id, { frequency: value })}
                        />
                        <SelectField<CustomIncomeGrowthMode>
                          label="Payout Type"
                          value={stream.growthMode}
                          options={["fixed", "increasing"]}
                          labels={{ fixed: "Fixed amount", increasing: "Increases yearly" }}
                          onChange={(value) => updateCustomIncomeStream(stream.id, { growthMode: value })}
                        />
                        {stream.growthMode === "increasing" ? (
                          <NumberField
                            label="Annual Increase"
                            helper="Compounds yearly after the start age."
                            suffix="%"
                            step={0.1}
                            value={stream.annualIncreaseRate}
                            onChange={(value) => updateCustomIncomeStream(stream.id, { annualIncreaseRate: value })}
                          />
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </Section>
        </div>

        <ReadinessPanel projection={projection} inputs={inputs} />
      </div>

      <section className="results-section" id="results">
        <div className="results-header">
          <div>
            <p className="eyebrow">Your Result</p>
            <h2>{projection.summary.status === "ready" ? "Ready through the projection age" : "More funding is needed"}</h2>
            <p>
              Retirement need funded: {formatCurrency(projection.summary.totalFundedRetirementNeed)} of {formatCurrency(projection.summary.totalRetirementNeed)}.
            </p>
            <p className="result-subline">
              Expected monthly spending at age {inputs.retirementAge}: <strong>{formatCurrency(projectedMonthlyRetirementSpending)}</strong>
            </p>
          </div>
          <div className="results-header__badge">
            {projection.summary.status === "ready" ? <BadgeCheck size={28} /> : <CircleAlert size={28} />}
            <strong>{formatPercent(projection.summary.readinessPercent)}</strong>
          </div>
        </div>

        <div className="metric-grid">
          <MetricCard label="Readiness" value={formatPercent(projection.summary.readinessPercent)} note={projection.summary.headline} tone={projection.summary.status === "ready" ? "good" : "warn"} />
          <MetricCard label="Shortfall" value={formatCurrency(projection.summary.totalShortfall)} note="Total unfunded spending gap" tone={projection.summary.totalShortfall > 0 ? "warn" : "good"} />
          <MetricCard label="Invest More Monthly" value={formatCurrency(projection.summary.extraMonthlyInvestmentRequired)} note={`Uses ${formatPercent(inputs.preRetirementInvestmentReturnRate)} investment return`} tone="blue" />
          <MetricCard label="Peak Wealth" value={formatCurrency(projection.summary.peakBalance)} note={`At age ${projection.summary.peakBalanceAge}`} />
        </div>

        <section className="gap-card" aria-labelledby="gap-card-title">
          <div className="gap-card__copy">
            <p className="eyebrow">How To Close The Gap</p>
            <h3 id="gap-card-title">Compare three simple levers.</h3>
            <p>
              If the projection has a shortfall, these estimates show the monthly change needed from today.
              Use the option that feels most realistic for the client.
            </p>
          </div>
          <div className="gap-options">
            <GapOptionCard
              label="Save More Cash"
              value={formatCurrency(projection.summary.extraMonthlyCashSavingsRequired)}
              note={`Assumes ${formatPercent(inputs.cashInterestRate)} cash savings rate`}
              tone="blue"
            />
            <GapOptionCard
              label="Invest More"
              value={formatCurrency(projection.summary.extraMonthlyInvestmentRequired)}
              note={`Assumes ${formatPercent(inputs.preRetirementInvestmentReturnRate)} return before retirement`}
              tone="good"
            />
            <GapOptionCard
              label="Spend Less In Retirement"
              value={formatCurrency(projection.summary.monthlySpendingReductionRequired)}
              note="Today's monthly spending reduction, inflated by the app over time"
              tone="warn"
            />
          </div>
        </section>

        <section className="drawdown-card" aria-labelledby="drawdown-title">
          <div className="drawdown-card__copy">
            <p className="eyebrow">Retirement Drawdown Strategy</p>
            <h3 id="drawdown-title">How spending is funded each year.</h3>
            <p>
              The model uses retirement income first. If income is not enough, it draws from cash, investments,
              CPF SA/OA, and only then records an unfunded shortfall.
            </p>
          </div>
          <div className="drawdown-waterfall" aria-label="Retirement funding waterfall">
            {[
              { label: "Retirement income", value: drawdownTotals.retirementIncome, className: "waterfall-income" },
              { label: "Cash holdings", value: drawdownTotals.cash, className: "waterfall-cash" },
              { label: "Investment holdings", value: drawdownTotals.investments, className: "waterfall-investments" },
              { label: "CPF OA/SA", value: drawdownTotals.cpf, className: "waterfall-cpf" },
              { label: "Unfunded shortfall", value: drawdownTotals.shortfall, className: "waterfall-shortfall" }
            ].map((item, index) => (
              <article className={`waterfall-step ${item.className}`} key={item.label}>
                <span>{index + 1}. {item.label}</span>
                <strong>{formatCurrency(item.value)}</strong>
                <i aria-hidden="true">
                  <b style={{ width: `${Math.max(4, (item.value / drawdownWaterfallTotal) * 100)}%` }} />
                </i>
              </article>
            ))}
          </div>
        </section>

        <div className="chart-grid">
          <article className="chart-card">
            <div className="chart-card__header">
              <div>
                <h3>Retirement Wealth By Age</h3>
                <p>Breaks total retirement wealth into cash, investments, CPF OA, CPF SA before age 55, CPF RA/LIFE reserve after age 55, and CPF MA. MA is tracked, but not used for retirement drawdown.</p>
              </div>
            </div>
            <ChartLegend
              items={[
                { label: "Cash", className: "dot-cash" },
                { label: "Investments", className: "dot-investments" },
                { label: "CPF OA", className: "dot-cpf-oa" },
                { label: "CPF SA", className: "dot-cpf-sa" },
                { label: "CPF RA / LIFE", className: "dot-cpf-ra" },
                { label: "CPF MA", className: "dot-cpf-ma" }
              ]}
            />
            <div className="chart-frame">
              <div className="chart-frame__inner">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartRows} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="age" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area dataKey="cash" name="Cash Savings" type="monotone" stackId="wealth" stroke="var(--chart-cash)" fill="var(--chart-cash)" fillOpacity={0.62} />
                    <Area dataKey="investments" name="Investments" type="monotone" stackId="wealth" stroke="var(--chart-investments)" fill="var(--chart-investments)" fillOpacity={0.62} />
                    <Area dataKey="cpfOa" name="CPF OA" type="monotone" stackId="wealth" stroke="var(--chart-cpf-oa)" fill="var(--chart-cpf-oa)" fillOpacity={0.62} />
                    <Area dataKey="cpfSa" name="CPF SA" type="monotone" stackId="wealth" stroke="var(--chart-cpf-sa)" fill="var(--chart-cpf-sa)" fillOpacity={0.62} />
                    <Area dataKey="cpfRa" name="CPF RA / LIFE Reserve" type="monotone" stackId="wealth" stroke="var(--chart-cpf-ra)" fill="var(--chart-cpf-ra)" fillOpacity={0.62} />
                    <Area dataKey="cpfMa" name="CPF MA" type="monotone" stackId="wealth" stroke="var(--chart-cpf-ma)" fill="var(--chart-cpf-ma)" fillOpacity={0.62} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </article>

          <article className="chart-card">
            <div className="chart-card__header">
              <div>
                <h3>Retirement Cash Flow</h3>
                <p>Separates retirement income, spending, and the drawdown sources used when income is not enough.</p>
              </div>
            </div>
            <ChartLegend
              items={[
                { label: "CPF LIFE", className: "dot-primary" },
                { label: "Dividends", className: "dot-success" },
                { label: "Custom Income", className: "dot-custom-income" },
                { label: "Spending", className: "dot-error" },
                { label: "Cash Drawdown", className: "dot-cash" },
                { label: "Investment Drawdown", className: "dot-investments" },
                { label: "CPF Drawdown", className: "dot-cpf-oa" },
                { label: "Shortfall", className: "dot-warning" }
              ]}
            />
            <div className="chart-frame">
              <div className="chart-frame__inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="age" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line dataKey="cpfLifeIncome" name="CPF LIFE Income" type="monotone" stroke="var(--chart-primary)" strokeWidth={3} dot={false} />
                    <Line dataKey="passiveIncome" name="Dividends / Passive Income" type="monotone" stroke="var(--chart-success)" strokeWidth={3} dot={false} />
                    <Line dataKey="customIncome" name="Custom Income" type="monotone" stroke="var(--chart-custom-income)" strokeWidth={3} dot={false} />
                    <Line dataKey="spending" name="Spending Need" type="monotone" stroke="var(--chart-error)" strokeWidth={3} dot={false} />
                    <Line dataKey="cashWithdrawal" name="Cash Drawdown" type="monotone" stroke="var(--chart-cash)" strokeWidth={2.6} dot={false} />
                    <Line dataKey="investmentWithdrawal" name="Investment Drawdown" type="monotone" stroke="var(--chart-investments)" strokeWidth={2.6} dot={false} />
                    <Line dataKey="cpfDrawdown" name="CPF OA/SA Drawdown" type="monotone" stroke="var(--chart-cpf-oa)" strokeWidth={2.6} dot={false} />
                    <Line dataKey="shortfall" name="Unfunded Shortfall" type="monotone" stroke="var(--chart-warning)" strokeWidth={2.6} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </article>
        </div>

        <section className="math-card">
          <div className="math-card__intro">
            <Calculator size={24} />
            <div>
              <h3>How The Result Is Calculated</h3>
              <p>Spending begins at retirement age. CPF LIFE begins only from the CPF LIFE start age, so retiring before 65 naturally creates a bridge period funded by cash, investments, CPF SA, and CPF OA where available.</p>
              <p>When CPF LIFE starts, the RA amount committed to CPF LIFE is shown as a CPF LIFE reserve for transparency. It is not double-counted as ordinary retirement wealth, and CPF LIFE payouts continue for life even if the modeled reserve runs down.</p>
            </div>
          </div>
          <div className="math-grid">
            <span>Funds At Retirement</span>
            <strong>{formatCurrency(retirementRow?.openingBalance ?? 0)}</strong>
            <span>Total Retirement Spending Need</span>
            <strong>{formatCurrency(projection.summary.totalRetirementNeed)}</strong>
            <span>Total CPF LIFE Income</span>
            <strong>{formatCurrency(projection.summary.totalCpfLifeIncome)}</strong>
            <span>Total Passive Income</span>
            <strong>{formatCurrency(projection.summary.totalPassiveIncome)}</strong>
            <span>Total Custom Income</span>
            <strong>{formatCurrency(projection.summary.totalCustomIncome)}</strong>
            <span>Total Healthcare Add-On</span>
            <strong>{formatCurrency(projection.summary.totalHealthcareCosts)}</strong>
            <span>Total Drawdown Used</span>
            <strong>{formatCurrency(projection.summary.totalWithdrawn)}</strong>
            <span>Total CPF SA/OA Drawdown</span>
            <strong>{formatCurrency(projection.summary.totalCpfDrawdown)}</strong>
            <span>Estimated OA Transfer Room At 55</span>
            <strong>{formatCurrency(projection.summary.availableOaTransferToRaAt55)}</strong>
            <span>Estimated CPF Withdrawable At 55</span>
            <strong>{formatCurrency(projection.summary.estimatedCpfWithdrawableAt55)}</strong>
          </div>
        </section>

        <section className="table-card">
          <div className="chart-card__header">
            <div>
              <h3>Year-By-Year Detail</h3>
              <p>Hidden by default so the main answer stays easy to read.</p>
            </div>
            <button className="secondary-action" type="button" onClick={() => setShowTable((current) => !current)}>
              {showTable ? "Hide Table" : `View ${formatNumber(projection.rows.length)} Rows`}
            </button>
          </div>
          {showTable ? <YearTable rows={projection.rows} /> : null}
        </section>
      </section>

      <footer>
        <ShieldCheck size={18} />
        <span>Projection uses assumptions and estimates. Confirm CPF LIFE payouts with CPF's official estimator when giving formal advice.</span>
      </footer>
    </main>
  );
}
