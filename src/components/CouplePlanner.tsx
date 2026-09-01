import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BadgeCheck, Calculator, Check, CircleAlert, Pencil, RotateCcw, Sparkles, Users } from "lucide-react";
import { cloneHouseholdPlan, createDefaultHouseholdPlan, type HouseholdPlan } from "../household";
import { formatCurrency, formatPercent } from "../utils/formatters";
import { projectHousehold } from "../utils/householdProjection";
import { CoupleOnboardingWizard } from "./CoupleOnboardingWizard";

type CoupleMode = "onboarding" | "processing" | "results" | "edit";
type ChartView = "combined" | "person-1" | "person-2";

function Metric({ label, value, note, tone = "neutral" }: { label: string; value: string; note: string; tone?: "neutral" | "good" | "warn" | "blue" }) {
  return <article className={`metric-card metric-card--${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function HouseholdTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; name: string; value: number; color: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <div key={item.dataKey} style={{ color: item.color }}><span>{item.name}</span><b>{formatCurrency(Number(item.value))}</b></div>)}</div>;
}

function possessiveLabel(label: string) {
  return label.trim().toLowerCase() === "you" ? "Your" : `${label}’s`;
}

function PersonResultCard({ index, plan, projection }: { index: 0 | 1; plan: HouseholdPlan; projection: ReturnType<typeof projectHousehold> }) {
  const person = plan.people[index];
  const summary = projection.people[index];
  const startCpf = person.inputs.cpfOa + person.inputs.cpfSa + person.inputs.cpfMa + person.inputs.cpfRa;
  const bridge = Math.max(0, person.inputs.cpfLifeStartAge - person.inputs.retirementAge);
  const totalSrsNet = Math.max(0, summary.totalSrsWithdrawals - summary.totalSrsEstimatedTax);
  return (
    <article className={`individual-result-card person-tone-${index + 1}`}>
      <header><div><span>{index === 0 ? "Person 1" : "Person 2"}</span><h3>{person.label}</h3></div><strong>Age {person.inputs.currentAge}</strong></header>
      <div className="individual-result-card__headline"><span>Retirement timeline</span><strong>Age {person.inputs.retirementAge}</strong><small>{person.inputs.retirementAge - person.inputs.currentAge} accumulation years in this scenario</small></div>
      <div className="person-metric-grid">
        <div><span>CPF today</span><strong>{person.inputs.includeCpf ? formatCurrency(startCpf) : "Not included"}</strong></div>
        <div><span>CPF around age 55</span><strong>{person.inputs.includeCpf ? formatCurrency(summary.cpfAt55) : "—"}</strong></div>
        <div><span>CPF LIFE estimate</span><strong>{person.inputs.includeCpf ? `${formatCurrency(summary.cpfLifeMonthlyAtStart)}/mo` : "—"}</strong><small>{person.inputs.includeCpf ? `From age ${person.inputs.cpfLifeStartAge}` : "Not modelled"}</small></div>
        <div><span>Total projected CPF contributions</span><strong>{person.inputs.includeCpf ? formatCurrency(summary.totalCpfContributions) : "—"}</strong></div>
        <div><span>SRS today</span><strong>{person.inputs.includeSrs ? formatCurrency(person.inputs.srsCurrentBalance) : "Not included"}</strong></div>
        <div><span>Projected net SRS withdrawals</span><strong>{person.inputs.includeSrs ? formatCurrency(totalSrsNet) : "—"}</strong><small>{person.inputs.includeSrs ? `${formatCurrency(summary.totalSrsEstimatedTax)} estimated tax` : "Not modelled"}</small></div>
        <div><span>Other retirement income</span><strong>{person.inputs.customIncomeStreams.length ? formatCurrency(summary.totalCustomIncome) : "Not included"}</strong><small>{person.inputs.customIncomeStreams[0]?.label ?? "No additional stream modelled"}</small></div>
      </div>
      <div className="person-insights">
        {person.inputs.includeCpf ? <p><strong>{bridge > 0 ? `${bridge}-year CPF LIFE bridge.` : "CPF LIFE begins by retirement."}</strong> {bridge > 0 ? `Other household resources support the years between age ${person.inputs.retirementAge} and ${person.inputs.cpfLifeStartAge}.` : "The selected payout age does not begin after the selected retirement age."}</p> : <p><strong>CPF is excluded.</strong> No CPF balance, contribution, drawdown or CPF LIFE income is used for {person.label}.</p>}
        {person.inputs.includeSrs ? <p><strong>SRS is kept separate.</strong> The model records {formatCurrency(summary.totalSrsContributions)} of contributions and starts the ten-year withdrawal window at age {person.inputs.srsFirstWithdrawalAge}.</p> : <p><strong>SRS is excluded.</strong> The household result does not assume an SRS balance or future contribution for {person.label}.</p>}
        {person.inputs.customIncomeStreams.length ? <p><strong>Other income remains individually attributed.</strong> {person.inputs.customIncomeStreams[0].label} is counted only from age {person.inputs.customIncomeStreams[0].startAge} to {person.inputs.customIncomeStreams[0].endAge}.</p> : null}
      </div>
    </article>
  );
}

export function CouplePlanner({ onExit }: { onExit: () => void }) {
  const [plan, setPlan] = useState<HouseholdPlan>(() => createDefaultHouseholdPlan());
  const [mode, setMode] = useState<CoupleMode>("onboarding");
  const [showYears, setShowYears] = useState(false);
  const [chartView, setChartView] = useState<ChartView>("combined");
  const projection = useMemo(() => projectHousehold(plan), [plan]);
  const startRow = projection.rows.find((row) => row.calendarYear === projection.summary.retirementStartYear) ?? projection.rows[0];
  const transitionYears = Math.abs(
    (plan.people[0].inputs.retirementAge - plan.people[0].inputs.currentAge)
    - (plan.people[1].inputs.retirementAge - plan.people[1].inputs.currentAge)
  );
  const chartRows = projection.rows.map((row) => ({
    year: row.calendarYear,
    cash: Math.round(row.endingCashSavings),
    investments: Math.round(row.endingInvestments),
    person1Cpf: Math.round(row.people[0].cpfOa + row.people[0].cpfSa + row.people[0].cpfMa + row.people[0].cpfRa + row.people[0].cpfLifeReserve),
    person2Cpf: Math.round(row.people[1].cpfOa + row.people[1].cpfSa + row.people[1].cpfMa + row.people[1].cpfRa + row.people[1].cpfLifeReserve),
    person1Srs: Math.round(row.people[0].srsBalance),
    person2Srs: Math.round(row.people[1].srsBalance),
    spending: Math.round(row.householdSpending),
    person1CpfLife: Math.round(row.people[0].cpfLifeIncome),
    person2CpfLife: Math.round(row.people[1].cpfLifeIncome),
    person1SrsIncome: Math.round(row.people[0].srsNetWithdrawal),
    person2SrsIncome: Math.round(row.people[1].srsNetWithdrawal),
    person1OtherIncome: Math.round(row.people[0].customIncome),
    person2OtherIncome: Math.round(row.people[1].customIncome),
    oneTimeInflow: Math.round(row.oneTimeInflow),
    oneTimeOutflow: Math.round(row.oneTimeOutflow),
    passiveIncome: Math.round(row.passiveIncome),
    shortfall: Math.round(row.shortfall)
  }));

  useEffect(() => {
    if (mode !== "processing") return undefined;
    const timer = window.setTimeout(() => {
      setMode("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [mode]);

  function complete(nextPlan: HouseholdPlan) {
    setPlan(cloneHouseholdPlan(nextPlan));
    setShowYears(false);
    setChartView("combined");
    setMode("processing");
  }

  if (mode === "onboarding" || mode === "edit") {
    return <CoupleOnboardingWizard initialPlan={plan} editMode={mode === "edit"} onComplete={complete} onCancel={mode === "edit" ? () => setMode("results") : onExit} />;
  }

  if (mode === "processing") {
    return <section className="projection-processing" aria-live="polite"><div className="processing-orbit" aria-hidden="true"><Users size={24} /></div><p className="eyebrow">Building your household retirement picture</p><h2>Aligning two CPF and SRS journeys on one timeline…</h2><div className="processing-steps"><span><Check size={17} /> Projecting each person separately</span><span><Check size={17} /> Counting shared resources and spending once</span><span><Check size={17} /> Combining income only when it becomes available</span></div></section>;
  }

  const resultHeadline = projection.summary.status === "ready"
    ? `Your household spending remains funded through ${projection.summary.runwayYear}`
    : `A household funding gap begins around ${projection.summary.firstShortfallYear}`;
  const selectedPersonIndex = chartView === "person-1" ? 0 : chartView === "person-2" ? 1 : null;
  const selectedPerson = selectedPersonIndex === null ? null : plan.people[selectedPersonIndex];
  const selectedPersonPossessive = selectedPerson ? possessiveLabel(selectedPerson.label) : null;

  return (
    <section className="couple-results results-section" aria-label="Household retirement results">
      <div className="summary-strip household-summary-strip">
        <div><span>Household spending begins</span><strong>{projection.summary.retirementStartYear}</strong></div>
        <div><span>{plan.people[0].label}</span><strong>Retires at {plan.people[0].inputs.retirementAge}</strong></div>
        <div><span>{plan.people[1].label}</span><strong>Retires at {plan.people[1].inputs.retirementAge}</strong></div>
        <div><span>CPF / SRS</span><strong>Calculated individually</strong></div>
      </div>

      <div className="results-header">
        <div><p className="eyebrow">Your household retirement picture</p><h2>{resultHeadline}</h2><p>The model funds {formatCurrency(projection.summary.totalFundedRetirementNeed)} of an estimated {formatCurrency(projection.summary.totalRetirementNeed)} household retirement spending need.</p><p className="result-subline">One household target: <strong>{formatCurrency(plan.retirementSpendingAnnual / 12)} per month today</strong> · <strong>{formatCurrency(startRow.householdSpending / 12)} per month when spending begins</strong></p><div className="results-action-row"><button className="results-edit-action" type="button" onClick={() => { setMode("edit"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={17} /> Edit household assumptions</button><button className="secondary-action" type="button" onClick={onExit}><RotateCcw size={17} /> Start over</button></div></div>
        <div className="results-header__badge">{projection.summary.status === "ready" ? <BadgeCheck size={28} /> : <CircleAlert size={28} />}<strong>{formatPercent(projection.summary.readinessPercent)}</strong></div>
      </div>

      <div className="metric-grid">
        <Metric label="Estimated need funded" value={formatPercent(projection.summary.readinessPercent)} note="Across the household projection" tone={projection.summary.status === "ready" ? "good" : "warn"} />
        <Metric label="Projected funding lasts" value={`Through ${projection.summary.runwayYear}`} note={projection.summary.status === "ready" ? "No unfunded year in this scenario" : "First shortfall may follow"} tone={projection.summary.status === "ready" ? "good" : "warn"} />
        <Metric label="Resources when spending begins" value={formatCurrency(startRow.totalTrackedResources)} note={`${plan.people[0].label} age ${startRow.people[0].age} · ${plan.people[1].label} age ${startRow.people[1].age}`} tone="blue" />
        <Metric label="Peak tracked resources" value={formatCurrency(projection.summary.peakTrackedResources)} note={`In ${projection.summary.peakYear}; includes displayed CPF LIFE reserves`} />
      </div>

      <section className="insights-card"><div className="insights-card__header"><div><p className="eyebrow">Household insights</p><h3>What stands out across both timelines</h3></div><Sparkles size={24} /></div><div className="insights-grid">
        <article className="insight-item insight-item--blue"><strong>{transitionYears > 0 ? `${transitionYears}-year retirement transition` : "Both retirement timelines align"}</strong><p>{transitionYears > 0 ? "One person’s regular contributions stop earlier while the other person’s continue. The household target begins according to the option you selected." : "Both contribution schedules stop in the same projection year under the ages entered."}</p></article>
        <article className="insight-item insight-item--good"><strong>Two income journeys, one spending target</strong><p>CPF LIFE and net SRS withdrawals are calculated for each person, then combined only in the years when those amounts become available.</p></article>
        <article className="insight-item insight-item--warn"><strong>Focused retirement scope</strong><p>Employment income is used for CPF estimates, not as household spending cash. Property, insurance, estate planning and tax optimisation are intentionally outside this result.</p></article>
      </div></section>

      <section className="individual-results-section"><div className="section-heading"><p className="eyebrow">Individual journeys</p><h2>Clear, separate CPF and SRS outcomes</h2><p>Each card shows only that person’s assumptions and projected flows. The household outcome above combines them without merging account ownership.</p></div><div className="couple-person-grid"><PersonResultCard index={0} plan={plan} projection={projection} /><PersonResultCard index={1} plan={plan} projection={projection} /></div></section>

      <section className="scenario-details-card" aria-labelledby="scenario-details-title">
        <div><p className="eyebrow">Release 3 scenario details</p><h2 id="scenario-details-title">Events and income included in this result</h2><p>These are assumptions—not guaranteed resources. Switch uncertain items off and compare the result before relying on them.</p></div>
        <div className="scenario-detail-grid">
          <article><span>Shared one-time event</span><strong>{plan.includeOneTimeEvents ? plan.oneTimeEvents[0]?.label ?? "Included" : "Not included"}</strong><small>{plan.includeOneTimeEvents && plan.oneTimeEvents[0] ? `${formatCurrency(plan.oneTimeEvents[0].amount)} ${plan.oneTimeEvents[0].direction} when ${plan.people[0].label} is age ${plan.oneTimeEvents[0].age}${plan.oneTimeEvents[0].certainty === "possible" ? " · Possible" : ""}` : "No shared event changes the projection"}</small></article>
          {plan.people.map((item) => <article key={item.id}><span>{item.label} · other retirement income</span><strong>{item.inputs.customIncomeStreams[0]?.label ?? "Not included"}</strong><small>{item.inputs.customIncomeStreams[0] ? `${formatCurrency(item.inputs.customIncomeStreams[0].amount)}/month from age ${item.inputs.customIncomeStreams[0].startAge}` : "CPF LIFE and SRS remain separately modelled"}</small></article>)}
        </div>
      </section>

      <section className="chart-view-panel" aria-labelledby="chart-view-heading">
        <div>
          <p className="eyebrow">Explore the projection</p>
          <h2 id="chart-view-heading">Choose whose journey to view</h2>
          <p>{selectedPerson
            ? `Viewing individually owned CPF and SRS for ${selectedPerson.label}, alongside the household spending target.`
            : "Viewing shared assets and both individual CPF and SRS journeys together."}</p>
        </div>
        <div className="chart-view-selector" role="group" aria-label="Choose chart view">
          <button type="button" className={chartView === "combined" ? "is-active" : ""} aria-pressed={chartView === "combined"} onClick={() => setChartView("combined")}><Users size={17} /> Combined</button>
          <button type="button" className={`person-tone-1 ${chartView === "person-1" ? "is-active" : ""}`} aria-pressed={chartView === "person-1"} onClick={() => setChartView("person-1")}>{plan.people[0].label}</button>
          <button type="button" className={`person-tone-2 ${chartView === "person-2" ? "is-active" : ""}`} aria-pressed={chartView === "person-2"} onClick={() => setChartView("person-2")}>{plan.people[1].label}</button>
        </div>
      </section>

      <div className="chart-grid">
        <article className={`chart-card ${selectedPersonIndex === null ? "" : `person-tone-${selectedPersonIndex + 1}`}`}>
          <div className="chart-card__header"><div>
            <h3>{selectedPerson ? `${selectedPersonPossessive} CPF and SRS by year` : "Household resources by year"}</h3>
            <p>{selectedPerson ? "Only this person’s owned CPF and SRS balances are shown." : "Shared cash and investments are shown once. CPF and SRS remain separated by person."}</p>
          </div></div>
          {chartView === "combined" ? <div className="household-chart-legend"><span className="legend-shared-cash">Shared cash</span><span className="legend-shared-investments">Shared investments</span><span className="legend-person-1">{plan.people[0].label} CPF/SRS</span><span className="legend-person-2">{plan.people[1].label} CPF/SRS</span></div> : null}
          <div className="chart-frame"><div className="chart-frame__inner"><ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartRows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
              <Tooltip content={<HouseholdTooltip />} />
              {chartView === "combined" ? <>
                <Area dataKey="cash" name="Shared cash" stackId="wealth" stroke="var(--chart-cash)" fill="var(--chart-cash)" fillOpacity={0.6} />
                <Area dataKey="investments" name="Shared investments" stackId="wealth" stroke="var(--chart-investments)" fill="var(--chart-investments)" fillOpacity={0.6} />
              </> : null}
              {chartView !== "person-2" ? <>
                <Area dataKey="person1Cpf" name={`${plan.people[0].label} CPF`} stackId="wealth" stroke="var(--person-1)" fill="var(--person-1)" fillOpacity={0.58} />
                <Area dataKey="person1Srs" name={`${plan.people[0].label} SRS`} stackId="wealth" stroke="var(--person-1)" fill="var(--person-1)" fillOpacity={0.36} />
              </> : null}
              {chartView !== "person-1" ? <>
                <Area dataKey="person2Cpf" name={`${plan.people[1].label} CPF`} stackId="wealth" stroke="var(--person-2)" fill="var(--person-2)" fillOpacity={0.58} />
                <Area dataKey="person2Srs" name={`${plan.people[1].label} SRS`} stackId="wealth" stroke="var(--person-2)" fill="var(--person-2)" fillOpacity={0.36} />
              </> : null}
            </AreaChart>
          </ResponsiveContainer></div></div>
          {selectedPerson ? <p className="chart-context-note">Shared cash and investments remain in the Combined view because the questionnaire records them as household resources, not as individually owned assets.</p> : null}
        </article>

        <article className={`chart-card ${selectedPersonIndex === null ? "" : `person-tone-${selectedPersonIndex + 1}`}`}>
          <div className="chart-card__header"><div>
            <h3>{selectedPerson ? `${selectedPersonPossessive} retirement income against household spending` : "Household retirement income and spending"}</h3>
            <p>{selectedPerson ? "That person’s CPF LIFE and SRS withdrawals are shown against the full household target." : "CPF LIFE and SRS withdrawals are separately visible for each person."}</p>
          </div></div>
          <div className="chart-frame"><div className="chart-frame__inner"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value) => formatCurrency(Number(value), { compact: true })} tickLine={false} axisLine={false} />
              <Tooltip content={<HouseholdTooltip />} />
              <Line dataKey="spending" name="Household spending" stroke="var(--chart-error)" strokeWidth={3} dot={false} />
              {chartView !== "person-2" ? <>
                <Line dataKey="person1CpfLife" name={`${plan.people[0].label} CPF LIFE`} stroke="var(--person-1)" strokeWidth={2.8} dot={false} />
                <Line dataKey="person1SrsIncome" name={`${plan.people[0].label} SRS`} stroke="var(--person-1)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line dataKey="person1OtherIncome" name={`${plan.people[0].label} other income`} stroke="var(--person-1)" strokeWidth={2} strokeDasharray="2 5" dot={false} />
              </> : null}
              {chartView !== "person-1" ? <>
                <Line dataKey="person2CpfLife" name={`${plan.people[1].label} CPF LIFE`} stroke="var(--person-2)" strokeWidth={2.8} dot={false} />
                <Line dataKey="person2SrsIncome" name={`${plan.people[1].label} SRS`} stroke="var(--person-2)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line dataKey="person2OtherIncome" name={`${plan.people[1].label} other income`} stroke="var(--person-2)" strokeWidth={2} strokeDasharray="2 5" dot={false} />
              </> : null}
              {chartView === "combined" ? <>
                <Line dataKey="passiveIncome" name="Portfolio income" stroke="var(--chart-success)" strokeWidth={2.4} dot={false} />
                <Line dataKey="shortfall" name="Unfunded shortfall" stroke="var(--chart-warning)" strokeWidth={2.8} dot={false} />
              </> : null}
            </LineChart>
          </ResponsiveContainer></div></div>
          {selectedPerson ? <p className="chart-context-note">The spending line is the full household target for context. It is not an allocation of spending to {selectedPerson.label}.</p> : null}
        </article>
      </div>

      <section className="math-card"><div className="math-card__intro"><Calculator size={24} /><div><h3>How this household result is calculated</h3><p>Each calendar year advances both ages until the younger person reaches their selected planning horizon, initially age 100. CPF contribution rates, account allocations, RA formation, CPF LIFE starts and SRS withdrawals are calculated person by person. Household spending, cash and investments are counted once.</p><p>Retirement income is used before shared cash and investments. Eligible CPF OA/SA drawdown is considered only after a person is at least 55 and has reached their selected retirement age. MediSave is tracked but not used for retirement spending.</p></div></div><div className="math-grid"><span>Total household spending need</span><strong>{formatCurrency(projection.summary.totalRetirementNeed)}</strong><span>Total funded need</span><strong>{formatCurrency(projection.summary.totalFundedRetirementNeed)}</strong><span>Total projected shortfall</span><strong>{formatCurrency(projection.summary.totalShortfall)}</strong><span>Projection inflation</span><strong>{formatPercent(plan.retirementSpendingInflationRate)}</strong></div></section>

      <section className="year-data-card"><div className="year-data-card__header"><div><h3>Year-by-year household view</h3><p>Annual household totals with each person’s age, owned accounts, other income and shared events.</p></div><button className="secondary-action" type="button" onClick={() => setShowYears((current) => !current)}>{showYears ? "Hide years" : "Show years"}</button></div>{showYears ? <><div className="table-wrap household-year-table"><table><thead><tr><th>Year</th><th>{plan.people[0].label} age</th><th>{plan.people[1].label} age</th><th>Spending</th><th>Event in / out</th><th>{plan.people[0].label} income</th><th>{plan.people[1].label} income</th><th>{plan.people[0].label} CPF / SRS</th><th>{plan.people[1].label} CPF / SRS</th><th>Shared assets</th><th>Shortfall</th></tr></thead><tbody>{projection.rows.map((row) => <tr key={row.calendarYear} className={row.shortfall > 0 ? "has-shortfall" : ""}><td>{row.calendarYear}</td><td>{row.people[0].age}</td><td>{row.people[1].age}</td><td>{formatCurrency(row.householdSpending)}</td><td>{formatCurrency(row.oneTimeInflow)} / {formatCurrency(row.oneTimeOutflow)}</td><td>{formatCurrency(row.people[0].customIncome)}</td><td>{formatCurrency(row.people[1].customIncome)}</td><td>{formatCurrency(row.people[0].cpfOa + row.people[0].cpfSa + row.people[0].cpfMa + row.people[0].cpfRa + row.people[0].cpfLifeReserve)} / {formatCurrency(row.people[0].srsBalance)}</td><td>{formatCurrency(row.people[1].cpfOa + row.people[1].cpfSa + row.people[1].cpfMa + row.people[1].cpfRa + row.people[1].cpfLifeReserve)} / {formatCurrency(row.people[1].srsBalance)}</td><td>{formatCurrency(row.endingCashSavings + row.endingInvestments)}</td><td>{formatCurrency(row.shortfall)}</td></tr>)}</tbody></table></div><div className="household-year-cards">{projection.rows.map((row) => <article key={row.calendarYear} className={row.shortfall > 0 ? "has-shortfall" : ""}><header><strong>{row.calendarYear}</strong><span>{plan.people[0].label} {row.people[0].age} · {plan.people[1].label} {row.people[1].age}</span></header><dl><div><dt>Household spending</dt><dd>{formatCurrency(row.householdSpending)}</dd></div>{row.oneTimeInflow || row.oneTimeOutflow ? <div><dt>Event inflow / outflow</dt><dd>{formatCurrency(row.oneTimeInflow)} / {formatCurrency(row.oneTimeOutflow)}</dd></div> : null}<div><dt>{plan.people[0].label} CPF / SRS / other income</dt><dd>{formatCurrency(row.people[0].cpfOa + row.people[0].cpfSa + row.people[0].cpfMa + row.people[0].cpfRa + row.people[0].cpfLifeReserve)} / {formatCurrency(row.people[0].srsBalance)} / {formatCurrency(row.people[0].customIncome)}</dd></div><div><dt>{plan.people[1].label} CPF / SRS / other income</dt><dd>{formatCurrency(row.people[1].cpfOa + row.people[1].cpfSa + row.people[1].cpfMa + row.people[1].cpfRa + row.people[1].cpfLifeReserve)} / {formatCurrency(row.people[1].srsBalance)} / {formatCurrency(row.people[1].customIncome)}</dd></div><div><dt>Shortfall</dt><dd>{formatCurrency(row.shortfall)}</dd></div></dl></article>)}</div></> : null}</section>

      <footer className="app-footer"><strong>Educational projection—not financial advice or a product recommendation.</strong><span>CPF LIFE payouts and SRS tax are estimates. Confirm personal figures with official CPF and SRS information before making decisions.</span></footer>
    </section>
  );
}
