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
import { BadgeCheck, Calculator, CircleAlert, Moon, RotateCcw, ShieldCheck, Sun } from "lucide-react";
import { cpfContributionForYear, defaultInputs, projectRetirement } from "./utils/projection";
import { formatCurrency, formatNumber, formatPercent } from "./utils/formatters";
import type {
  CpfLifePlan,
  CpfPrRateType,
  CpfPrYear,
  CpfResidencyStatus,
  CpfWorkStatus,
  RetirementIncomeMethod,
  RetirementInputs,
  RetirementSumChoice,
  RetirementYear
} from "./types";

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
            <th>Spending</th>
            <th>Drawdown</th>
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
              <td>{formatCurrency(row.spendingNeed)}</td>
              <td>{formatCurrency(row.withdrawal)}</td>
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

  const chartRows = projection.rows.map((row) => ({
    age: row.age,
    totalWealth: Math.round(row.endingBalance),
    cash: Math.round(row.endingCashSavings),
    investments: Math.round(row.endingInvestments),
    cpfOa: Math.round(row.cpfOa),
    cpfRa: Math.round(row.cpfRa + row.cpfLifeReserve),
    cpfMa: Math.round(row.cpfMa),
    cpfLifeIncome: Math.round(row.cpfLifeIncome),
    passiveIncome: Math.round(row.passiveIncomeGenerated),
    income: Math.round(row.passiveIncomeGenerated + row.cpfLifeIncome),
    spending: Math.round(row.spendingNeed),
    drawdown: Math.round(row.withdrawal),
    shortfall: Math.round(row.shortfall)
  }));

  function updateInput<K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
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

          <Section number="2" title="What You Can Save Monthly" helper="Use monthly amounts. The app annualises them and stops them from your retirement age.">
            <div className="field-grid">
              <NumberField label="Monthly Cash Savings" prefix="$" value={inputs.cashSavingsContribution} onChange={(value) => updateInput("cashSavingsContribution", value)} />
              <NumberField label="Monthly Investment Amount" prefix="$" value={inputs.investmentContribution} onChange={(value) => updateInput("investmentContribution", value)} />
              <NumberField label="Yearly Increase" helper="Optional annual increase to your monthly saving amounts." suffix="%" step={0.1} value={inputs.annualContributionIncreaseRate} onChange={(value) => updateInput("annualContributionIncreaseRate", value)} />
            </div>
          </Section>

          <Section number="3" title="CPF From Work" helper="Optional. If you are still working, this estimates CPF additions before retirement.">
            <ToggleRow
              title="Include CPF Contributions From Income"
              description="Turn this on if you are employed or self-employed before retirement."
              checked={inputs.includeCpf && inputs.cpfWorkStatus !== "Not contributing"}
              onChange={(checked) => {
                updateInput("includeCpf", true);
                updateInput("cpfWorkStatus", checked ? "Employed" : "Not contributing");
              }}
            />
            {inputs.includeCpf && inputs.cpfWorkStatus !== "Not contributing" ? (
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
          </Section>

          <Section number="4" title="What You Have Today" helper="Enter the balances available for retirement. CPF MA is tracked, but not used for retirement drawdown.">
            <div className="field-grid">
              <NumberField label="Cash Savings" prefix="$" value={inputs.currentCashSavings} onChange={(value) => updateInput("currentCashSavings", value)} />
              <NumberField label="Investment Portfolio" prefix="$" value={inputs.currentInvestments} onChange={(value) => updateInput("currentInvestments", value)} />
            </div>
            <ToggleRow
              title="Include CPF Balances"
              description="Recommended for Singapore users. CPF OA and SA may help fund gaps before true shortfall appears."
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
              </>
            ) : null}
          </Section>

          <Section number="5" title="CPF LIFE Planning" helper="CPF LIFE begins at the selected start age. If you retire before 65, the app shows the gap before CPF LIFE starts.">
            {inputs.includeCpf ? (
              <>
                <div className="mini-metrics">
                  <MetricCard label="Projected CPF At 55" value={formatCurrency(projection.summary.projectedCpfRetirementFundingAt55)} note={projection.summary.cpfRetirementSumTierAt55} tone={projection.summary.cpfRetirementSumShortfallAt55 > 0 ? "warn" : "good"} />
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
                <div className="field-grid">
                  <NumberField label="CPF LIFE Start Age" value={inputs.cpfLifeStartAge} onChange={(value) => updateInput("cpfLifeStartAge", value)} />
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
              <p className="helper-note">Turn on CPF balances in step 4 to project CPF LIFE.</p>
            )}
          </Section>

          <Section number="6" title="Retirement Spending" helper="Use today's monthly spending. The app inflates it every year at the selected inflation rate.">
            <div className="field-grid">
              <NumberField label="Monthly Retirement Spending" prefix="$" value={annualToMonthly(inputs.retirementSpendingAnnual)} onChange={(value) => updateInput("retirementSpendingAnnual", monthlyToAnnual(value))} />
              <NumberField label="Inflation" suffix="%" step={0.1} value={inputs.retirementSpendingInflationRate} onChange={(value) => updateInput("retirementSpendingInflationRate", value)} />
              <NumberField label="Cash Savings Rate" suffix="%" step={0.1} value={inputs.cashInterestRate} onChange={(value) => updateInput("cashInterestRate", value)} />
              <NumberField label="Investment Return Before Retirement" suffix="%" step={0.1} value={inputs.preRetirementInvestmentReturnRate} onChange={(value) => updateInput("preRetirementInvestmentReturnRate", value)} />
            </div>
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

        <div className="chart-grid">
          <article className="chart-card">
            <div className="chart-card__header">
              <div>
                <h3>Retirement Wealth By Age</h3>
                <p>Breaks total retirement wealth into cash, investments, CPF OA, CPF RA/LIFE reserve, and CPF MA. MA is tracked, but not used for retirement drawdown.</p>
              </div>
            </div>
            <ChartLegend
              items={[
                { label: "Cash", className: "dot-cash" },
                { label: "Investments", className: "dot-investments" },
                { label: "CPF OA", className: "dot-cpf-oa" },
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
                <p>Separates CPF LIFE, dividends, spending, and the drawdown needed when income is not enough.</p>
              </div>
            </div>
            <ChartLegend
              items={[
                { label: "CPF LIFE", className: "dot-primary" },
                { label: "Dividends", className: "dot-success" },
                { label: "Spending", className: "dot-error" },
                { label: "Drawdown", className: "dot-warning" }
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
                    <Line dataKey="spending" name="Spending Need" type="monotone" stroke="var(--chart-error)" strokeWidth={3} dot={false} />
                    <Line dataKey="drawdown" name="Drawdown Used" type="monotone" stroke="var(--chart-warning)" strokeWidth={3} dot={false} />
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
            <span>Total Drawdown Used</span>
            <strong>{formatCurrency(projection.summary.totalWithdrawn)}</strong>
            <span>Total CPF SA/OA Drawdown</span>
            <strong>{formatCurrency(projection.summary.totalCpfDrawdown)}</strong>
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
