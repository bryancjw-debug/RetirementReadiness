import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleAlert, Landmark, ListChecks, PiggyBank, RotateCcw, ShieldCheck, SlidersHorizontal, TrendingUp } from "lucide-react";
import { defaultInputs, projectRetirement } from "./utils/projection";
import { formatCurrency, formatNumber, formatPercent } from "./utils/formatters";
import type { CpfLifePlan, RetirementIncomeMethod, RetirementInputs, RetirementSumChoice, RetirementYear } from "./types";

const methods: Array<{
  id: RetirementIncomeMethod;
  title: string;
  description: string;
}> = [
  {
    id: "passive",
    title: "Passive Income",
    description: "Income yield funds retirement first. Principal is drawn only if income is not enough."
  },
  {
    id: "fixed",
    title: "Fixed Drawdown",
    description: "Withdraw a target annual amount each year, then compare it against retirement spending."
  },
  {
    id: "dynamic",
    title: "Percentage Drawdown",
    description: "Withdraw a percentage of the portfolio each year, adapting to market outcomes."
  }
];

const guidedSteps = [
  {
    title: "About You",
    helper: "Start with the ages. These set the timeline for the whole retirement check."
  },
  {
    title: "What You Have Today",
    helper: "Enter your cash, investments, and CPF balances. Estimates are okay for a first pass."
  },
  {
    title: "What You Can Still Save",
    helper: "Tell us what you can set aside before retirement."
  },
  {
    title: "CPF LIFE",
    helper: "CPF LIFE can be estimated, or you can enter the official CPF estimator payout."
  },
  {
    title: "Retirement Spending",
    helper: "Use today's dollars. The app will inflate this over time."
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

function MetricCard({
  label,
  value,
  note,
  tone = "neutral",
  icon
}: {
  label: string;
  value: string;
  note: string;
  tone?: "neutral" | "good" | "warn" | "blue";
  icon?: ReactNode;
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        {icon ? <span className="metric-card__icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
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

function SectionCard({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string | number }) {
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

function ReadinessBand({ projection }: { projection: ReturnType<typeof projectRetirement> }) {
  const { summary } = projection;
  const isReady = summary.status === "ready";

  return (
    <section className={`readiness-band ${isReady ? "ready" : "not-ready"}`}>
      <div className="readiness-band__icon">{isReady ? <BadgeCheck size={32} /> : <CircleAlert size={32} />}</div>
      <div>
        <p className="eyebrow">RetirementReadiness indicator</p>
        <h2>{isReady ? "Ready" : "Not Ready"}</h2>
        <p>{summary.headline}</p>
      </div>
      <div className="readiness-band__stats">
        <span>Runway</span>
        <strong>Age {summary.runwayAge}</strong>
      </div>
    </section>
  );
}

function MethodSelector({
  selected,
  onChange
}: {
  selected: RetirementIncomeMethod;
  onChange: (method: RetirementIncomeMethod) => void;
}) {
  return (
    <div className="method-grid">
      {methods.map((method) => (
        <button
          className={`method-card ${selected === method.id ? "is-active" : ""}`}
          key={method.id}
          type="button"
          onClick={() => onChange(method.id)}
        >
          <span>{method.title}</span>
          <small>{method.description}</small>
        </button>
      ))}
    </div>
  );
}

function YearTable({ rows }: { rows: RetirementYear[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Age</th>
            <th>Phase</th>
            <th>Opening Cash</th>
            <th>Opening Investments</th>
            <th>Cash Saved</th>
            <th>Invested</th>
            <th>Lump Sum</th>
            <th>Savings Interest</th>
            <th>Investment Growth</th>
            <th>Passive Income</th>
            <th>CPF LIFE Income</th>
            <th>Spending Need</th>
            <th>Total Drawdown</th>
            <th>Cash Drawdown</th>
            <th>Investment Drawdown</th>
            <th>CPF SA Drawdown</th>
            <th>CPF OA Drawdown</th>
            <th>Shortfall</th>
            <th>Ending Cash</th>
            <th>Ending Investments</th>
            <th>CPF OA</th>
            <th>CPF SA</th>
            <th>CPF MA</th>
            <th>CPF RA</th>
            <th>CPF LIFE Reserve</th>
            <th>CPF Total</th>
            <th>Ending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.age} className={row.shortfall > 0 ? "has-shortfall" : ""}>
              <td>{row.age}</td>
              <td>{row.phase === "build-up" ? "Build-up" : "Retirement"}</td>
              <td>{formatCurrency(row.openingCashSavings)}</td>
              <td>{formatCurrency(row.openingInvestments)}</td>
              <td>{formatCurrency(row.cashContribution)}</td>
              <td>{formatCurrency(row.investmentContribution)}</td>
              <td>{formatCurrency(row.lumpSum)}</td>
              <td>{formatCurrency(row.savingsInterest)}</td>
              <td>{formatCurrency(row.investmentGrowth)}</td>
              <td>{formatCurrency(row.passiveIncomeGenerated)}</td>
              <td>{formatCurrency(row.cpfLifeIncome)}</td>
              <td>{formatCurrency(row.spendingNeed)}</td>
              <td>{formatCurrency(row.withdrawal)}</td>
              <td>{formatCurrency(row.cashWithdrawal)}</td>
              <td>{formatCurrency(row.investmentWithdrawal)}</td>
              <td>{formatCurrency(row.cpfSaDrawdown)}</td>
              <td>{formatCurrency(row.cpfOaDrawdown)}</td>
              <td>{formatCurrency(row.shortfall)}</td>
              <td>{formatCurrency(row.endingCashSavings)}</td>
              <td>{formatCurrency(row.endingInvestments)}</td>
              <td>{formatCurrency(row.cpfOa)}</td>
              <td>{formatCurrency(row.cpfSa)}</td>
              <td>{formatCurrency(row.cpfMa)}</td>
              <td>{formatCurrency(row.cpfRa)}</td>
              <td>{formatCurrency(row.cpfLifeReserve)}</td>
              <td>{formatCurrency(row.cpfTotal)}</td>
              <td>{formatCurrency(row.endingBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuidedProgress({ step }: { step: number }) {
  const pct = ((step + 1) / guidedSteps.length) * 100;
  return (
    <div className="guided-progress" aria-label={`Step ${step + 1} of ${guidedSteps.length}`}>
      <div className="guided-progress__top">
        <span>Step {step + 1} of {guidedSteps.length}</span>
        <strong>{Math.round(pct)}% complete</strong>
      </div>
      <div className="guided-progress__bar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GuidedShell({
  step,
  children
}: {
  step: number;
  children: ReactNode;
}) {
  const active = guidedSteps[step];
  return (
    <section className="guided-card">
      <GuidedProgress step={step} />
      <p className="eyebrow">Simple Retirement Checkup</p>
      <h2>{active.title}</h2>
      <p className="guided-card__helper">{active.helper}</p>
      <div className="guided-card__body">{children}</div>
    </section>
  );
}

function GuidedPreview({ projection, inputs }: { projection: ReturnType<typeof projectRetirement>; inputs: RetirementInputs }) {
  const isReady = projection.summary.status === "ready";
  return (
    <aside className={`guided-preview ${isReady ? "ready" : "not-ready"}`}>
      <span className="guided-preview__pill">{isReady ? "On track" : "Needs attention"}</span>
      <h3>{isReady ? "Ready through your projection age" : "Projected gap ahead"}</h3>
      <p>{projection.summary.headline}</p>
      <div className="guided-preview__stats">
        <div>
          <span>Runway</span>
          <strong>Age {projection.summary.runwayAge}</strong>
        </div>
        <div>
          <span>CPF LIFE / month</span>
          <strong>{formatCurrency(projection.summary.cpfLifeMonthlyAtStart)}</strong>
        </div>
        <div>
          <span>Projection ends</span>
          <strong>Age {inputs.endAge}</strong>
        </div>
      </div>
    </aside>
  );
}

export default function App() {
  const [inputs, setInputs] = useState<RetirementInputs>(defaultInputs);
  const [showProjectionTable, setShowProjectionTable] = useState(false);
  const [mode, setMode] = useState<"guided" | "advanced" | "results">("guided");
  const [guidedStep, setGuidedStep] = useState(0);

  const projection = useMemo(() => projectRetirement(inputs), [inputs]);
  const chartRows = projection.rows.map((row) => ({
    age: row.age,
    portfolio: Math.round(row.endingBalance),
    cashSavings: Math.round(row.endingCashSavings),
    investments: Math.round(row.endingInvestments),
    cpfBalances: Math.round(row.cpfTotal),
    passiveIncome: Math.round(row.passiveIncomeGenerated),
    cpfLifeIncome: Math.round(row.cpfLifeIncome),
    totalIncome: Math.round(row.passiveIncomeGenerated + row.cpfLifeIncome),
    spendingNeed: Math.round(row.spendingNeed),
    withdrawal: Math.round(row.withdrawal),
    cpfDrawdown: Math.round(row.cpfDrawdown),
    shortfall: Math.round(row.shortfall)
  }));
  const retirementRow = projection.rows.find((row) => row.age === inputs.retirementAge);
  const readinessTone = projection.summary.status === "ready" ? "good" : "warn";

  function updateInput<K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  const advancedInputs = (
    <aside className="input-panel">
          <SectionCard eyebrow="Step 1" title="Build-Up Phase">
            <div className="field-grid">
              <NumberField label="Current Age" value={inputs.currentAge} onChange={(value) => updateInput("currentAge", value)} />
              <NumberField label="Retirement Age" value={inputs.retirementAge} onChange={(value) => updateInput("retirementAge", value)} />
              <NumberField label="Projection Until Age" value={inputs.endAge} onChange={(value) => updateInput("endAge", value)} />
              <NumberField
                label="Current Cash Savings"
                helper="Cash or savings balance kept outside investments."
                prefix="$"
                value={inputs.currentCashSavings}
                onChange={(value) => updateInput("currentCashSavings", value)}
              />
              <NumberField
                label="Current Investment Portfolio"
                helper="Invested assets meant for retirement."
                prefix="$"
                value={inputs.currentInvestments}
                onChange={(value) => updateInput("currentInvestments", value)}
              />
              <NumberField
                label="Monthly Cash Savings"
                helper="Monthly amount added to cash savings."
                prefix="$"
                value={inputs.cashSavingsContribution}
                onChange={(value) => updateInput("cashSavingsContribution", value)}
              />
              <NumberField
                label="Monthly Investment Amount"
                helper="Monthly amount invested into the retirement portfolio."
                prefix="$"
                value={inputs.investmentContribution}
                onChange={(value) => updateInput("investmentContribution", value)}
              />
              <NumberField
                label="Annual Increase For Monthly Savings"
                helper="Applies to both monthly cash savings and monthly investment amount."
                suffix="%"
                step={0.1}
                value={inputs.annualContributionIncreaseRate}
                onChange={(value) => updateInput("annualContributionIncreaseRate", value)}
              />
              <NumberField
                label="Cash Savings Interest"
                helper="Applied only to the cash savings bucket."
                suffix="%"
                step={0.1}
                value={inputs.cashInterestRate}
                onChange={(value) => updateInput("cashInterestRate", value)}
              />
              <NumberField
                label="Investment Return Before Retirement"
                helper="Applied only to the investment portfolio."
                suffix="%"
                step={0.1}
                value={inputs.preRetirementInvestmentReturnRate}
                onChange={(value) => updateInput("preRetirementInvestmentReturnRate", value)}
              />
            </div>
          </SectionCard>

          <SectionCard eyebrow="Step 2" title="Future One-Time Capital Injection">
            <ToggleRow
              title="Include Future Lump Sum"
              description="Use this only for known one-off capital injections such as property sale proceeds, inheritance, business sale, bonus, or endowment maturity."
              checked={inputs.includeLumpSum}
              onChange={(checked) => updateInput("includeLumpSum", checked)}
            />
            {inputs.includeLumpSum ? (
              <div className="field-grid field-grid--spaced">
                <NumberField
                  label="Future Lump Sum"
                  prefix="$"
                  value={inputs.lumpSumAmount}
                  onChange={(value) => updateInput("lumpSumAmount", value)}
                />
                <NumberField
                  label="Received At Age"
                  value={inputs.lumpSumAge}
                  onChange={(value) => updateInput("lumpSumAge", value)}
                />
              </div>
            ) : null}
          </SectionCard>

          <SectionCard eyebrow="Step 3" title="Singapore CPF LIFE">
            <ToggleRow
              title="Include CPF And CPF LIFE"
              description="Project OA, SA, MA and RA balances, then estimate CPF LIFE payouts from the selected retirement sum."
              checked={inputs.includeCpf}
              onChange={(checked) => updateInput("includeCpf", checked)}
            />
            {inputs.includeCpf ? (
              <>
                <div className="cpf-preview">
                  <div>
                    <span>Selected Retirement Sum At 55</span>
                    <strong>{formatCurrency(projection.summary.cpfRetirementSumAt55)}</strong>
                  </div>
                  <div>
                    <span>Estimated Monthly CPF LIFE</span>
                    <strong>{formatCurrency(projection.summary.cpfLifeMonthlyAtStart)}</strong>
                  </div>
                </div>
                <div className="field-grid field-grid--spaced">
                  <NumberField label="CPF OA Balance" prefix="$" value={inputs.cpfOa} onChange={(value) => updateInput("cpfOa", value)} />
                  <NumberField label="CPF SA Balance" prefix="$" value={inputs.cpfSa} onChange={(value) => updateInput("cpfSa", value)} />
                  <NumberField label="CPF MA Balance" prefix="$" value={inputs.cpfMa} onChange={(value) => updateInput("cpfMa", value)} />
                  <NumberField
                    label="CPF RA Balance"
                    helper="Use this if RA already exists."
                    prefix="$"
                    value={inputs.cpfRa}
                    onChange={(value) => updateInput("cpfRa", value)}
                  />
                  <NumberField
                    label="CPF LIFE Start Age"
                    value={inputs.cpfLifeStartAge}
                    onChange={(value) => updateInput("cpfLifeStartAge", value)}
                  />
                  <label className="field">
                    <span>Retirement Sum</span>
                    <select
                      value={inputs.cpfRetirementSum}
                      onChange={(event) => updateInput("cpfRetirementSum", event.target.value as RetirementSumChoice)}
                    >
                      <option value="Basic">Basic Retirement Sum</option>
                      <option value="Full">Full Retirement Sum</option>
                      <option value="Enhanced">Enhanced Retirement Sum</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>CPF LIFE Plan</span>
                    <select
                      value={inputs.cpfLifePlan}
                      onChange={(event) => updateInput("cpfLifePlan", event.target.value as CpfLifePlan)}
                    >
                      <option value="Standard">Standard</option>
                      <option value="Basic">Basic</option>
                      <option value="Escalating">Escalating</option>
                    </select>
                  </label>
                  <NumberField
                    label="Known Monthly Payout Override"
                    helper="Optional. If CPF estimator gives a figure, enter it here."
                    prefix="$"
                    value={inputs.cpfLifeMonthlyOverride}
                    onChange={(value) => updateInput("cpfLifeMonthlyOverride", value)}
                  />
                </div>
                <p className="math-note">
                  CPF LIFE payouts are estimated using interpolation from common CPF LIFE payout reference points.
                  Actual payouts depend on CPF Board's calculator, premium terms, cohort, and individual CPF data.
                </p>
              </>
            ) : null}
          </SectionCard>

          <SectionCard eyebrow="Step 4" title="Retirement Income">
            <MethodSelector
              selected={inputs.retirementIncomeMethod}
              onChange={(method) => updateInput("retirementIncomeMethod", method)}
            />
            <div className="field-grid">
              <NumberField
                label="Monthly Retirement Spending"
                helper="Monthly amount in today's dollars. The projection annualises and inflates it."
                prefix="$"
                value={annualToMonthly(inputs.retirementSpendingAnnual)}
                onChange={(value) => updateInput("retirementSpendingAnnual", monthlyToAnnual(value))}
              />
              <NumberField
                label="Spending Inflation"
                suffix="%"
                step={0.1}
                value={inputs.retirementSpendingInflationRate}
                onChange={(value) => updateInput("retirementSpendingInflationRate", value)}
              />
              <NumberField
                label="Capital Growth In Retirement"
                suffix="%"
                step={0.1}
                value={inputs.retirementReturnRate}
                onChange={(value) => updateInput("retirementReturnRate", value)}
              />
              <NumberField
                label="Passive Income Yield"
                suffix="%"
                step={0.1}
                value={inputs.passiveIncomeYieldRate}
                onChange={(value) => updateInput("passiveIncomeYieldRate", value)}
              />
              {inputs.retirementIncomeMethod === "fixed" ? (
                <NumberField
                  label="Fixed Monthly Drawdown"
                  helper="Monthly amount in today's dollars. The projection annualises and inflates it."
                  prefix="$"
                  value={annualToMonthly(inputs.fixedWithdrawalAnnual)}
                  onChange={(value) => updateInput("fixedWithdrawalAnnual", monthlyToAnnual(value))}
                />
              ) : null}
              {inputs.retirementIncomeMethod === "dynamic" ? (
                <NumberField
                  label="Dynamic Drawdown Rate"
                  suffix="%"
                  step={0.1}
                  value={inputs.dynamicWithdrawalRate}
                  onChange={(value) => updateInput("dynamicWithdrawalRate", value)}
                />
              ) : null}
            </div>
          </SectionCard>
        </aside>
  );

  const resultsContent = (
    <>
      <ReadinessBand projection={projection} />

      <section className="metric-grid">
        <MetricCard
          icon={<ShieldCheck size={18} />}
          label="Readiness"
          value={projection.summary.status === "ready" ? "Ready" : "Not Ready"}
          note={projection.summary.headline}
          tone={readinessTone}
        />
        <MetricCard
          icon={<Landmark size={18} />}
          label="Final Balance"
          value={formatCurrency(projection.summary.finalBalance, { compact: true })}
          note={`At age ${inputs.endAge}`}
          tone="good"
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Peak Portfolio"
          value={formatCurrency(projection.summary.peakBalance, { compact: true })}
          note={`Age ${projection.summary.peakBalanceAge}`}
          tone="blue"
        />
        <MetricCard
          icon={<PiggyBank size={18} />}
          label="Income Coverage"
          value={formatPercent(projection.summary.incomeCoverageAtRetirement)}
          note="At retirement age"
          tone={projection.summary.incomeCoverageAtRetirement >= 100 ? "good" : "warn"}
        />
      </section>

      <section className="results-panel">
        <div className="chart-card chart-card--large">
          <div className="chart-card__header">
            <div>
              <p className="eyebrow">Projection</p>
              <h2>Retirement Funds By Age</h2>
            </div>
            <span>Peak {formatCurrency(projection.summary.peakBalance, { compact: true })}</span>
          </div>
          <div className="chart-frame">
            <div className="chart-frame__inner">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartRows} margin={{ top: 10, right: 18, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="portfolioFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#f2bb4c" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#f2bb4c" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="age" tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine x={inputs.retirementAge} stroke="#f2bb4c" strokeDasharray="4 4" />
                  <Area dataKey="cashSavings" name="Cash Savings" type="monotone" stackId="funds" stroke="#57b0ad" strokeWidth={2} fill="#57b0ad" fillOpacity={0.28} />
                  <Area dataKey="investments" name="Investments" type="monotone" stackId="funds" stroke="#f2bb4c" strokeWidth={2} fill="url(#portfolioFill)" />
                  {inputs.includeCpf ? (
                    <Area dataKey="cpfBalances" name="CPF Balances" type="monotone" stackId="funds" stroke="#8db7ff" strokeWidth={2} fill="#8db7ff" fillOpacity={0.2} />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="two-column">
          <div className="chart-card">
            <div className="chart-card__header">
              <div>
                <p className="eyebrow">Retirement</p>
                <h2>Income Versus Spending</h2>
              </div>
            </div>
            <div className="chart-frame chart-frame--small">
              <div className="chart-frame__inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="age" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line dataKey="totalIncome" name="Total Income" type="monotone" stroke="#67d391" strokeWidth={3} dot={false} />
                    <Line dataKey="spendingNeed" name="Spending Need" type="monotone" stroke="#ff7b7b" strokeWidth={3} dot={false} />
                    <Line dataKey="withdrawal" name="Total Drawdown Used" type="monotone" stroke="#8db7ff" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-card__header">
              <div>
                <p className="eyebrow">Gaps</p>
                <h2>Annual Shortfall</h2>
              </div>
            </div>
            <div className="chart-frame chart-frame--small">
              <div className="chart-frame__inner">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="age" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="shortfall" name="Shortfall" radius={[8, 8, 0, 0]}>
                      {chartRows.map((row) => (
                        <Cell key={row.age} fill={row.shortfall > 0 ? "#ff7b7b" : "#2a3731"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <section className="math-card">
          <div>
            <p className="eyebrow">Show the math</p>
            <h2>Retirement Projection Summary</h2>
          </div>
          <div className="math-grid">
            <span>Total Contributions</span>
            <strong>{formatCurrency(projection.summary.totalContributed)}</strong>
            <span>Total Savings Interest</span>
            <strong>{formatCurrency(projection.summary.totalSavingsInterest)}</strong>
            <span>Total Growth</span>
            <strong>{formatCurrency(projection.summary.totalGrowth)}</strong>
            <span>Total Passive Income</span>
            <strong>{formatCurrency(projection.summary.totalPassiveIncome)}</strong>
            <span>Total CPF LIFE Income</span>
            <strong>{formatCurrency(projection.summary.totalCpfLifeIncome)}</strong>
            <span>Total Drawdown</span>
            <strong>{formatCurrency(projection.summary.totalWithdrawn)}</strong>
            <span>Total CPF SA/OA Drawdown</span>
            <strong>{formatCurrency(projection.summary.totalCpfDrawdown)}</strong>
            <span>Total Unfunded Shortfall</span>
            <strong className={projection.summary.totalShortfall > 0 ? "negative" : "positive"}>{formatCurrency(projection.summary.totalShortfall)}</strong>
            <span>Funds At Retirement</span>
            <strong>{formatCurrency(retirementRow?.openingBalance ?? 0)}</strong>
          </div>
          <p className="math-note">
            Cash savings earn the cash interest rate. Investments earn the investment return before retirement, then
            the retirement capital growth rate after retirement. CPF LIFE, when enabled, reduces the retirement spending
            gap as an income stream. Drawdown funds retirement gaps from cash savings first, then investments, then CPF SA
            and CPF OA if CPF is enabled. CPF MA, CPF RA, and CPF LIFE reserve are not treated as freely spendable drawdown balances.
          </p>
        </section>

        <section className={`table-card table-card--collapsible ${showProjectionTable ? "is-open" : ""}`}>
          <div className="chart-card__header">
            <div>
              <p className="eyebrow">Year-by-year data</p>
              <h2>Projection Table</h2>
            </div>
            <button className="table-toggle" type="button" onClick={() => setShowProjectionTable((current) => !current)}>
              {showProjectionTable ? "Hide table" : `View ${formatNumber(projection.rows.length)} rows`}
            </button>
          </div>
          {showProjectionTable ? (
            <YearTable rows={projection.rows} />
          ) : (
            <p className="math-note">
              The full year-by-year table is available when needed, but hidden by default so the main retirement story stays clear.
            </p>
          )}
        </section>
      </section>
    </>
  );

  const guidedContent = (
    <div className="guided-layout">
      <GuidedShell step={guidedStep}>
        {guidedStep === 0 ? (
          <div className="guided-fields">
            <NumberField label="How Old Are You Now?" value={inputs.currentAge} onChange={(value) => updateInput("currentAge", value)} />
            <NumberField label="When Do You Want To Retire?" value={inputs.retirementAge} onChange={(value) => updateInput("retirementAge", value)} />
            <NumberField label="Plan Until What Age?" helper="Use 90 or 100 if unsure." value={inputs.endAge} onChange={(value) => updateInput("endAge", value)} />
          </div>
        ) : null}
        {guidedStep === 1 ? (
          <div className="guided-fields">
            <NumberField label="Cash Savings Today" helper="Bank savings or cash you can use." prefix="$" value={inputs.currentCashSavings} onChange={(value) => updateInput("currentCashSavings", value)} />
            <NumberField label="Investments Today" helper="Stocks, funds, ETFs, bonds, or portfolios." prefix="$" value={inputs.currentInvestments} onChange={(value) => updateInput("currentInvestments", value)} />
            <ToggleRow title="Include CPF Balances" description="Recommended for Singapore retirement planning." checked={inputs.includeCpf} onChange={(checked) => updateInput("includeCpf", checked)} />
            {inputs.includeCpf ? (
              <div className="guided-subgrid">
                <NumberField label="CPF OA" prefix="$" value={inputs.cpfOa} onChange={(value) => updateInput("cpfOa", value)} />
                <NumberField label="CPF SA" prefix="$" value={inputs.cpfSa} onChange={(value) => updateInput("cpfSa", value)} />
                <NumberField label="CPF MA" prefix="$" value={inputs.cpfMa} onChange={(value) => updateInput("cpfMa", value)} />
                <NumberField label="CPF RA" helper="Leave 0 if not formed yet." prefix="$" value={inputs.cpfRa} onChange={(value) => updateInput("cpfRa", value)} />
              </div>
            ) : null}
          </div>
        ) : null}
        {guidedStep === 2 ? (
          <div className="guided-fields">
            <NumberField label="Monthly Cash Savings" prefix="$" value={inputs.cashSavingsContribution} onChange={(value) => updateInput("cashSavingsContribution", value)} />
            <NumberField label="Monthly Investment Amount" prefix="$" value={inputs.investmentContribution} onChange={(value) => updateInput("investmentContribution", value)} />
            <NumberField label="Yearly Increase In Savings" suffix="%" step={0.1} value={inputs.annualContributionIncreaseRate} onChange={(value) => updateInput("annualContributionIncreaseRate", value)} />
            <NumberField label="Cash Interest" helper="For cash savings only." suffix="%" step={0.1} value={inputs.cashInterestRate} onChange={(value) => updateInput("cashInterestRate", value)} />
            <NumberField label="Investment Return Before Retirement" helper="For invested assets only." suffix="%" step={0.1} value={inputs.preRetirementInvestmentReturnRate} onChange={(value) => updateInput("preRetirementInvestmentReturnRate", value)} />
          </div>
        ) : null}
        {guidedStep === 3 ? (
          <div className="guided-fields">
            <ToggleRow title="Include CPF LIFE" description="CPF LIFE can provide monthly income from your payout start age." checked={inputs.includeCpf} onChange={(checked) => updateInput("includeCpf", checked)} />
            {inputs.includeCpf ? (
              <>
                <div className="cpf-preview">
                  <div>
                    <span>Estimated Retirement Sum At 55</span>
                    <strong>{formatCurrency(projection.summary.cpfRetirementSumAt55)}</strong>
                  </div>
                  <div>
                    <span>Estimated Monthly CPF LIFE</span>
                    <strong>{formatCurrency(projection.summary.cpfLifeMonthlyAtStart)}</strong>
                  </div>
                </div>
                <div className="guided-subgrid">
                  <NumberField label="CPF LIFE Start Age" value={inputs.cpfLifeStartAge} onChange={(value) => updateInput("cpfLifeStartAge", value)} />
                  <label className="field">
                    <span>Retirement Sum</span>
                    <select value={inputs.cpfRetirementSum} onChange={(event) => updateInput("cpfRetirementSum", event.target.value as RetirementSumChoice)}>
                      <option value="Basic">Basic Retirement Sum</option>
                      <option value="Full">Full Retirement Sum</option>
                      <option value="Enhanced">Enhanced Retirement Sum</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>CPF LIFE Plan</span>
                    <select value={inputs.cpfLifePlan} onChange={(event) => updateInput("cpfLifePlan", event.target.value as CpfLifePlan)}>
                      <option value="Standard">Standard</option>
                      <option value="Basic">Basic</option>
                      <option value="Escalating">Escalating</option>
                    </select>
                  </label>
                  <NumberField label="CPF Official Monthly Payout" helper="Optional. Enter CPF's estimator result if you have it." prefix="$" value={inputs.cpfLifeMonthlyOverride} onChange={(value) => updateInput("cpfLifeMonthlyOverride", value)} />
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        {guidedStep === 4 ? (
          <div className="guided-fields">
            <NumberField label="Expected Monthly Spending In Retirement" helper="Use today's dollars. The projection annualises and inflates this amount." prefix="$" value={annualToMonthly(inputs.retirementSpendingAnnual)} onChange={(value) => updateInput("retirementSpendingAnnual", monthlyToAnnual(value))} />
            <NumberField label="Spending Inflation" suffix="%" step={0.1} value={inputs.retirementSpendingInflationRate} onChange={(value) => updateInput("retirementSpendingInflationRate", value)} />
            <NumberField label="Investment Growth During Retirement" suffix="%" step={0.1} value={inputs.retirementReturnRate} onChange={(value) => updateInput("retirementReturnRate", value)} />
            <NumberField label="Passive Income Yield" helper="Dividends, coupons, rent, or portfolio income if applicable." suffix="%" step={0.1} value={inputs.passiveIncomeYieldRate} onChange={(value) => updateInput("passiveIncomeYieldRate", value)} />
            <MethodSelector selected={inputs.retirementIncomeMethod} onChange={(method) => updateInput("retirementIncomeMethod", method)} />
          </div>
        ) : null}
      </GuidedShell>
      <GuidedPreview projection={projection} inputs={inputs} />
    </div>
  );

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Standalone retirement projection</p>
          <h1>RetirementReadiness</h1>
          <p>
            A simple retirement checkup for Singapore users. Answer one step at a time, then review the readiness indicator,
            charts, and full calculation table only when you need the details.
          </p>
        </div>
        <div className="hero-actions">
          <button className="reset-button" type="button" onClick={() => setInputs(defaultInputs)}>
            <RotateCcw size={16} />
            Reset sample
          </button>
        </div>
      </section>

      <nav className="mode-tabs" aria-label="RetirementReadiness views">
        <button className={mode === "guided" ? "is-active" : ""} type="button" onClick={() => setMode("guided")}>
          <ListChecks size={18} />
          Guided Checkup
        </button>
        <button className={mode === "advanced" ? "is-active" : ""} type="button" onClick={() => setMode("advanced")}>
          <SlidersHorizontal size={18} />
          Advanced Inputs
        </button>
        <button className={mode === "results" ? "is-active" : ""} type="button" onClick={() => setMode("results")}>
          <ShieldCheck size={18} />
          Results
        </button>
      </nav>

      {mode === "guided" ? (
        <>
          {guidedContent}
          <div className="guided-actions">
            <button className="reset-button" type="button" disabled={guidedStep === 0} onClick={() => setGuidedStep((step) => Math.max(0, step - 1))}>
              <ArrowLeft size={16} />
              Back
            </button>
            {guidedStep < guidedSteps.length - 1 ? (
              <button className="primary-action" type="button" onClick={() => setGuidedStep((step) => Math.min(guidedSteps.length - 1, step + 1))}>
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="primary-action" type="button" onClick={() => setMode("results")}>
                Show My Readiness
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        </>
      ) : null}

      {mode === "advanced" ? (
        <div className="workspace workspace--advanced">
          {advancedInputs}
          <div className="advanced-side">
            <GuidedPreview projection={projection} inputs={inputs} />
            <button className="primary-action primary-action--full" type="button" onClick={() => setMode("results")}>
              Show Results
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {mode === "results" ? resultsContent : null}
    </main>
  );
}
