import { useMemo } from "react";
import { Check } from "lucide-react";
import type { RetirementInputs } from "../types";
import { srsContributionCap, srsPrescribedRetirementAge, sanitizeInputs } from "../utils/projection";
import { compareSrsStrategies } from "../utils/srsPlanning";
import { QuizNumberQuestion } from "./QuizNumberQuestion";
import { formatCurrency } from "../utils/formatters";

type SrsStrategyResult = ReturnType<typeof compareSrsStrategies>["smooth"];

function strategyTitle(strategy: SrsStrategyResult["strategy"]) {
  return strategy === "Tax Aware" ? "Smooth taxable income" : "Fixed opening-balance amount";
}

function strategyExplanation(strategy: SrsStrategyResult["strategy"]) {
  return strategy === "Tax Aware"
    ? "Adjusts each year’s withdrawal to keep your estimated taxable income more even. This can reduce tax when you have rental or other taxable retirement income, but the amount received may change each year."
    : "Withdraws one-tenth of the SRS balance available when the ten-year window opens in each of the first nine years. The tenth year clears everything left, so investment growth can make the final withdrawal different."
}

function SrsSchedulePreview({ result }: { result: SrsStrategyResult }) {
  const maximum = Math.max(1, ...result.rows.map((row) => row.withdrawal));
  return <details className="srs-schedule-preview">
    <summary>Preview all 10 annual withdrawals</summary>
    <p>{strategyExplanation(result.strategy)}</p>
    <ol>
      {result.rows.map((row) => <li key={row.age}>
        <div className="srs-schedule-preview__heading"><strong>Age {row.age}</strong><span>{formatCurrency(row.withdrawal)} withdrawn</span></div>
        <i aria-hidden="true"><b style={{ width: `${Math.max(2, row.withdrawal / maximum * 100)}%` }} /></i>
        <div className="srs-schedule-preview__details"><span>Tax {formatCurrency(row.tax)}</span><span>Net {formatCurrency(row.net)}</span><span>SRS left {formatCurrency(row.balance)}</span></div>
      </li>)}
    </ol>
  </details>;
}

export function SrsPlanner({ inputs, onChange }: { inputs: RetirementInputs; onChange: (patch: Partial<RetirementInputs>) => void }) {
  const safe = sanitizeInputs(inputs);
  const comparison = useMemo(()=> inputs.includeSrs ? compareSrsStrategies(safe) : null,[inputs]);
  const taxIncome = inputs.otherTaxableIncome ?? {annualAmount:0,startAge:inputs.retirementAge,endAge:inputs.endAge,growthRate:0};
  const selectedTaxResidency = inputs.retirementTaxResidency ?? (inputs.srsResidency === 'Foreigner' ? 'Non-resident' : 'Resident');
  const cap=srsContributionCap(inputs);
  const prescribedWithdrawalAge = srsPrescribedRetirementAge(inputs);
  const firstWithdrawalAge = Math.max(inputs.currentAge, prescribedWithdrawalAge, inputs.srsFirstWithdrawalAge);
  const withdrawalAgeMaximum = Math.max(80, inputs.currentAge);
  const number = (label: string, key: keyof RetirementInputs, min: number, max: number, helper: string, format=(n:number)=>formatCurrency(n)) => {
    const step = key.toLowerCase().includes('age') ? 1 : key === 'srsCurrentBalance' || key === 'srsAnnualContribution' ? 100 : .1;
    return <QuizNumberQuestion label={label} value={Number(inputs[key] ?? min)} min={min} max={max} step={step} onChange={n=>onChange({[key]:n})} helper={helper} format={format} />;
  };
  return <section className="quiz-stack quiz-subsection srs-planner" aria-label="SRS contributions and retirement tax">
    <h3>Would you like to include SRS?</h3>
    <div className="segmented-choice"><button type="button" aria-pressed={!inputs.includeSrs} className={!inputs.includeSrs ? "is-selected" : ""} onClick={()=>onChange({includeSrs:false})}>Not now</button><button type="button" aria-pressed={inputs.includeSrs} className={inputs.includeSrs ? "is-selected" : ""} onClick={()=>onChange({includeSrs:true,retirementTaxResidency:selectedTaxResidency,srsFirstWithdrawalAge:Math.max(inputs.currentAge,prescribedWithdrawalAge)})}>Include SRS</button></div>
    <p className="cpf-question-note">Cash savings, ordinary investments and SRS are three separate commitments. Enter each amount only once. Existing SRS holdings must not also be included in your ordinary investment balance.</p>
    {inputs.includeSrs ? <>
      <label className="quiz-text-field">SRS contribution status<select value={inputs.srsResidency} onChange={e=>onChange({srsResidency:e.target.value as RetirementInputs['srsResidency']})}><option>Singapore Citizen Or Permanent Resident</option><option>Foreigner</option></select></label>
      {number('Current SRS balance','srsCurrentBalance',0,500000,'Include investments and uninvested cash inside SRS only. The planner caps this guided input at $500,000.')}
      {number('Annual SRS contribution','srsAnnualContribution',0,cap,`Separate from cash and investment savings. Annual cap: ${formatCurrency(cap)}. No tax refund is automatically added.`)}
      <p className="education-callout">Total planned monthly commitment: <strong>{formatCurrency(inputs.cashSavingsContribution+inputs.investmentContribution+Math.min(cap,inputs.srsAnnualContribution)/12)}</strong>, including {formatCurrency(Math.min(cap,inputs.srsAnnualContribution)/12)} towards SRS. SRS contributions stop at retirement or before the first withdrawal, whichever is earlier.</p>
      <div className="cpf-answer-grid">
        {number('First SRS contribution age in this projection','srsContributionStartAge',inputs.currentAge,inputs.endAge,'Future contributions begin at this age.',n=>`Age ${n}`)}
        {number('Last SRS contribution age','srsContributionEndAge',inputs.currentAge,inputs.endAge,'Defaults to your target retirement age. Choose another age only if you expect eligible SRS contributions to continue for a different period.',n=>`Age ${n}`)}
      </div>
      {inputs.srsAnnualContribution > 0 && Math.max(inputs.currentAge, inputs.srsContributionStartAge ?? inputs.currentAge) > Math.min(inputs.srsContributionEndAge, inputs.retirementAge - 1, inputs.srsFirstWithdrawalAge - 1) ? <p className="cpf-input-warning">These dates leave no contribution years before retirement and withdrawal. Adjust the contribution dates to include future SRS additions.</p> : null}
      <label className="quiz-text-field">What will your SRS hold?<select value={inputs.srsAssetCategory ?? 'Mixed eligible portfolio'} onChange={e=>onChange({srsAssetCategory:e.target.value})}>{['Mixed eligible portfolio','Cash / fixed deposits','Eligible bonds / Singapore Government Securities','Eligible shares / ETFs / REITs','Eligible unit trusts'].map(label=><option key={label}>{label}</option>)}</select></label>
      {number('SRS investment return','srsReturnRate',0,25,'Annual total return after fees, with income reinvested inside SRS. Your assumption, not a guaranteed yield or live product quote.',n=>`${n}% / year`)}
      <p className="cpf-question-note">Eligibility depends on the product and SRS operator. Category selection records your assumption; it does not change the return automatically. Direct property and life-annuity payout mechanics are not modelled. Confirm eligible instruments with your operator.</p>
      <label className="quiz-text-field">When did you first contribute to SRS?<select value={inputs.srsFirstContributionPeriod} onChange={e=>{
        const period=e.target.value as RetirementInputs['srsFirstContributionPeriod']; const minimum=srsPrescribedRetirementAge({srsFirstContributionPeriod:period}); onChange({srsFirstContributionPeriod:period,srsFirstWithdrawalAge:Math.max(inputs.currentAge,minimum)});
      }}>{['Before 1 July 2022','1 July 2022 To 30 June 2026','From 1 July 2026','Not Sure'].map(label=><option key={label}>{label}</option>)}</select></label>
      <p className="cpf-question-note">First contribution before July 2022: age 62; July 2022–June 2026: 63; from July 2026: 64 under current rules. Opening an empty account does not lock the age. “Not Sure” uses 64 until confirmed. Future first contributions are subject to the rules then in force.</p>
      <QuizNumberQuestion label="First SRS withdrawal age" value={firstWithdrawalAge} min={62} max={withdrawalAgeMaximum} step={1} format={n=>`Age ${n}`} helper={`The earliest qualifying age for this SRS history is ${prescribedWithdrawalAge}. The ten-year window starts with the first qualifying withdrawal. Withdrawing while employed can change tax, because salary is not modelled.`} onChange={age=>onChange({srsFirstWithdrawalAge:Math.max(inputs.currentAge,prescribedWithdrawalAge,age)})} />
    </> : null}
    <details className="assumption-details" open={taxIncome.annualAmount > 0 ? true : undefined}>
    <summary>Other taxable retirement income{taxIncome.annualAmount > 0 ? `: ${formatCurrency(taxIncome.annualAmount)}/year today` : " (optional)"}</summary>
    <p className="cpf-question-note">Optional. Enter net taxable rental or other non-employment income, after allowable expenses and before income tax. This amount is added to retirement income: do not also enter it under other recurring income. CPF LIFE and ordinary exempt investment income should not be entered here.</p>
    <label className="quiz-text-field">Expected tax residency during retirement<select value={selectedTaxResidency} onChange={e=>onChange({retirementTaxResidency:e.target.value as RetirementInputs['retirementTaxResidency']})}><option value="Resident">Singapore tax resident</option><option value="Non-resident">Non-resident (simplified non-employment tax)</option></select></label>
    <QuizNumberQuestion label="Other annual taxable income, today's SGD" value={taxIncome.annualAmount} min={0} max={1000000} step={100} format={formatCurrency} helper="Zero means none. Excludes personal reliefs, rebates and foreign-tax credits." onChange={n=>onChange({retirementTaxResidency:selectedTaxResidency,otherTaxableIncome:{...taxIncome,annualAmount:n}})} />
    {taxIncome.annualAmount>0 ? <div className="cpf-answer-grid">{(['startAge','endAge','growthRate'] as const).map(key=><QuizNumberQuestion key={key} label={key==='startAge' ? 'Taxable income starts at age' : key==='endAge' ? 'Taxable income ends at age' : 'Taxable income annual growth (%)'} value={taxIncome[key]} min={key==='growthRate' ? -10:inputs.retirementAge} max={key==='growthRate' ? 15:Math.max(inputs.endAge,safe.srsFirstWithdrawalAge+9)} step={key==='growthRate' ? .1:1} helper={key==='growthRate' ? 'Applied from today to each projected year. Zero keeps the nominal amount fixed.' : 'Inclusive, only counted from retirement.'} onChange={n=>onChange({otherTaxableIncome:{...taxIncome,[key]:n}})} />)}</div> : null}
    </details>
    {comparison ? <>
      {safe.srsFirstWithdrawalAge < inputs.retirementAge ? <p className="cpf-input-warning">This saved plan starts SRS withdrawals while you are still working. Salary tax is not included in this estimate. For the retirement-only comparison, set first withdrawal to age {inputs.retirementAge} or later.</p> : null}
      <h3>Compare SRS withdrawal schedules</h3>
      <p>Projected SRS at retirement: <strong>{formatCurrency(comparison.smooth.atRetirement)}</strong>. At first withdrawal, after that year's modelled growth: <strong>{formatCurrency(comparison.smooth.atWithdrawal)}</strong>.</p>
      <div className="quiz-choice-grid quiz-choice-grid--two srs-strategy-grid">{[comparison.smooth,comparison.even].map(result=>{
        const selected=inputs.srsWithdrawalStrategy===result.strategy;
        const average=result.rows.length ? result.gross/result.rows.length : 0;
        return <button type="button" key={result.strategy} className={`quiz-choice srs-strategy ${selected?'is-selected':''}`} aria-pressed={selected} onClick={()=>onChange({srsWithdrawalStrategy:result.strategy})}>
          <span className="quiz-choice__check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span>
          <span><strong>{strategyTitle(result.strategy)}</strong><small className="srs-strategy__explanation">{strategyExplanation(result.strategy)}</small><small>First year: {formatCurrency(result.rows[0]?.withdrawal ?? 0)} · average: {formatCurrency(average)}/year</small><small>Total gross: {formatCurrency(result.gross)} · estimated tax: {formatCurrency(result.totalTax)} · net: {formatCurrency(result.net)}</small></span>
        </button>;
      })}</div>
      <SrsSchedulePreview result={inputs.srsWithdrawalStrategy === "Tax Aware" ? comparison.smooth : comparison.even} />
      <p className="cpf-question-note">Lower estimated SRS tax among these two schedules: <strong>{comparison.recommended==='Tax Aware'?'Smooth taxable income':'Fixed initial tenth'}</strong>. This is not a global optimum or a product recommendation. Lower tax does not necessarily mean greater wealth. Compare net proceeds, timing, outside-account returns and spending needs.</p>
      <p className="cpf-question-note">The selected schedule is used in the retirement projection. The model moves unused net SRS proceeds to cash and clears the remaining balance in the tenth modelled year. Legally, the residual is deemed withdrawn after the exact ten-year window; assets need not always be sold. Life annuities are excluded. Exact dates and tax assessment timing need adviser review.</p>
      {safe.srsFirstWithdrawalAge+9>inputs.endAge ? <p className="cpf-input-warning">The main chart ends before your SRS window finishes. Extend the projection to age {safe.srsFirstWithdrawalAge+9} to see all withdrawals. The comparison above includes the full window.</p>:null}
    </> : null}
    <details className="cpf-help"><summary>SRS rules and tax assumptions</summary><p>Qualifying withdrawals are 50% taxable. Tax combines this portion with your other entered taxable income at current rates; tax is reserved in the same projected year. Citizenship controls the contribution cap, not tax residency. Withholding is not treated as an extra tax. No reliefs, rebates or contribution tax savings are credited. Early withdrawals, special concessions and SRS life annuities are outside this estimate.</p><a href="https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/tax-on-srs-withdrawals" target="_blank" rel="noreferrer">IRAS withdrawal rules</a>{' · '}<a href="https://www.mof.gov.sg/news-resources/supplementary-retirement-scheme/" target="_blank" rel="noreferrer">MOF SRS overview</a><p>Rules checked 8 September 2026. Future rules and returns may change.</p></details>
  </section>;
}
