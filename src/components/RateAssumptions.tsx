import { useEffect, useState } from "react";
import { Calculator, ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { RetirementInputs } from "../types";
import { calculateInvestmentMix, type InvestmentMixItem } from "../utils/investmentMix";
import { formatCurrency } from "../utils/formatters";

export type RateValues = Pick<RetirementInputs, "cashInterestRate" | "preRetirementInvestmentReturnRate" | "retirementReturnRate" | "passiveIncomeYieldRate" | "retirementSpendingInflationRate" | "currentInvestments" | "investmentMix" | "retirementInvestmentMix">;
function RateInput({ value, min, max, disabled, onCommit }: { value: number; min: number; max: number; disabled: boolean; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(Number(value.toFixed(4))));
  const [error, setError] = useState("");
  useEffect(() => { setDraft(String(Number(value.toFixed(4)))); setError(""); }, [value]);
  function commit() {
    const number = Number(draft);
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) { setError(`Enter a rate from ${min}% to ${max}%. The previous rate still applies.`); return; }
    setError(""); if (number !== Number(value.toFixed(4))) onCommit(number);
  }
  return <><input type="number" min={min} max={max} step="any" value={draft} disabled={disabled} aria-invalid={!!error} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } }} />{error && <small role="alert">{error}</small>}</>;
}
const rateFields = [
  ["cashInterestRate", "Cash savings", "Before and during retirement", 1],
  ["preRetirementInvestmentReturnRate", "Investments before retirement", "Total return, including reinvested income", 5],
  ["retirementReturnRate", "Retirement capital growth", "Growth remaining after distributions", 1],
  ["passiveIncomeYieldRate", "Retirement income yield", "Dividends or distributions paid out", 4],
  ["retirementSpendingInflationRate", "Inflation", "Annual increase in spending", 2.5]
] as const;

export function RateAssumptions({ value, onChange, incomeActive = true, monthlyContribution = 0, readiness }: {
  value: RateValues; onChange: (patch: Partial<RateValues>) => void; incomeActive?: boolean; monthlyContribution?: number; readiness?: number;
}) {
  const [previousReadiness, setPreviousReadiness] = useState<number | null>(null);
  function apply(patch: Partial<RateValues>) { if (readiness !== undefined) setPreviousReadiness(readiness); onChange(patch); }
  return <section className="rate-assumptions" aria-label="Rates used in your projection">
    <header><div><span className="eyebrow">Your planning rates</span><h3>Rates used in your projection</h3></div><SlidersHorizontal size={22} aria-hidden="true" /></header>
    <div className="rate-summary">{rateFields.map(([key, label, note, baseline]) => <div key={key}>
      <span>{label}</span><strong>{key === "passiveIncomeYieldRate" && !incomeActive ? "Not used" : `${value[key].toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`}</strong>
      <small>{key === "passiveIncomeYieldRate" && !incomeActive ? "Capital growth and drawdown selected" : `${note} · ${value[key] === baseline ? "Default" : "Custom"}`}</small>
    </div>)}</div>
    <p>Annual assumptions. The investment return applies to your existing portfolio and {formatCurrency(monthlyContribution)} monthly investment contributions.</p>
    <details className="rates-editor"><summary><SlidersHorizontal size={17} /> Adjust rates or estimate from my investment mix <ChevronDown size={17} /></summary>
      <div className="rates-fields">{rateFields.map(([key, label, note, baseline]) => <label key={key}>{label} (% p.a.)
        <RateInput min={key === "retirementReturnRate" || key === "preRetirementInvestmentReturnRate" ? -99 : 0} max={key === "retirementSpendingInflationRate" ? 20 : 100} value={value[key]} disabled={key === "passiveIncomeYieldRate" && !incomeActive}
          onCommit={number => apply({ [key]: number, ...(key === "preRetirementInvestmentReturnRate" ? { investmentMix: undefined } : {}), ...(key === "retirementReturnRate" || key === "passiveIncomeYieldRate" ? { retirementInvestmentMix: undefined } : {}) })} />
        <small>{note}. Starting assumption: {baseline}%.</small>
      </label>)}</div>
      <button className="secondary-action" type="button" onClick={() => apply({ cashInterestRate: 1, preRetirementInvestmentReturnRate: 5, retirementReturnRate: 1, passiveIncomeYieldRate: 4, retirementSpendingInflationRate: 2.5, investmentMix: undefined, retirementInvestmentMix: undefined })}><RotateCcw size={16} /> Restore starting rates</button>
      <p>For dividend income, total return is capital growth plus income yield. Do not enter the same dividend return twice. Returns are assumptions, not guarantees. Monthly contributions are annualised and receive a full year's growth in this annual model.</p>
      <InvestmentMix value={value} onChange={apply} incomeActive={incomeActive} />
    </details>
    {previousReadiness !== null && readiness !== undefined && <p role="status">Readiness after your last rate change: <strong>{previousReadiness.toFixed(1)}% → {readiness.toFixed(1)}%</strong>. Charts and funding estimates have updated.</p>}
  </section>;
}

function InvestmentMix({ value, onChange, incomeActive }: { value: RateValues; onChange: (patch: Partial<RateValues>) => void; incomeActive: boolean }) {
  const [phase, setPhase] = useState<"before" | "retirement">("before");
  const [items, setItems] = useState<InvestmentMixItem[]>(value.investmentMix ?? [
    { label: "Equities / equity funds", amount: 0, returnRate: 5, incomeYield: 0 },
    { label: "Bonds / bond funds", amount: 0, returnRate: 5, incomeYield: 0 },
    { label: "Other investments", amount: 0, returnRate: 5, incomeYield: 0 }
  ]);
  const [replaceBalance, setReplaceBalance] = useState(false);
  const [message, setMessage] = useState("");
  const mix = calculateInvestmentMix(items);
  const invalidGrowth = !!mix && phase === "retirement" && incomeActive && mix.capitalGrowth <= -100;
  const mismatch = phase === "before" && mix && Math.abs(mix.total - value.currentInvestments) > 0.01;
  function updateItem(index: number, key: keyof InvestmentMixItem, number: number) {
    setItems(current => current.map((item, i) => i === index ? { ...item, [key]: number } : item)); setMessage("");
  }
  return <details className="mix-calculator"><summary><Calculator size={18} /> Help me estimate from my investment mix</summary>
    <label>Portfolio phase<select value={phase} onChange={event => {
      const next = event.target.value as typeof phase; setPhase(next); setMessage(""); setReplaceBalance(false);
      const saved = next === "before" ? value.investmentMix : value.retirementInvestmentMix;
      setItems(saved ?? items.map(item => ({ ...item, amount: 0, returnRate: next === "before" ? value.preRetirementInvestmentReturnRate : value.retirementReturnRate + (incomeActive ? value.passiveIncomeYieldRate : 0), incomeYield: next === "before" ? 0 : incomeActive ? value.passiveIncomeYieldRate : 0 })));
    }}><option value="before">Before retirement</option><option value="retirement">During retirement</option></select></label>
    <p>{phase === "before" ? "Enter current invested amounts, excluding cash savings and CPF. Future contributions use the same blended return." : "Enter your planned allocation amounts as relative weights. These do not add money to your projected portfolio."} Rates start from your current assumptions; adjust each to your own expectations.</p>
    <div className="mix-rows">{items.map((item, index) => <div className="mix-row" key={item.label}><h4>{item.label}</h4>
      <label>{phase === "before" ? "Invested amount ($)" : "Allocation amount ($)"}<input type="number" min="0" step="100" value={Number.isNaN(item.amount) ? "" : item.amount} onChange={event => updateItem(index, "amount", event.target.valueAsNumber)} /></label>
      <label>Total return (% p.a.)<input type="number" min="-99" max="100" step="0.1" value={Number.isNaN(item.returnRate) ? "" : item.returnRate} onChange={event => updateItem(index, "returnRate", event.target.valueAsNumber)} /></label>
      {phase === "retirement" && incomeActive && <label>Income yield (% p.a.)<input type="number" min="0" max="100" step="0.1" value={Number.isNaN(item.incomeYield) ? "" : item.incomeYield} onChange={event => updateItem(index, "incomeYield", event.target.valueAsNumber)} /></label>}
    </div>)}</div>
    {mix ? <p className="mix-result">{formatCurrency(mix.total)} total · <strong>{mix.totalReturn.toFixed(2)}% blended total return</strong>{phase === "retirement" && incomeActive ? ` = ${mix.capitalGrowth.toFixed(2)}% capital growth + ${mix.incomeYield.toFixed(2)}% income yield` : ""}</p> : <p>Enter positive allocation amounts and valid rates to calculate a blend.</p>}
    {mismatch && <label className="mix-confirm"><input type="checkbox" checked={replaceBalance} onChange={event => setReplaceBalance(event.target.checked)} /> Replace my existing {formatCurrency(value.currentInvestments)} investment balance with {formatCurrency(mix.total)}.</label>}
    {invalidGrowth && <p role="alert">This combination implies losing the entire portfolio in capital value. Review total return and income yield.</p>}
    <button className="primary-action" type="button" disabled={!mix || invalidGrowth || !!mismatch && !replaceBalance} onClick={() => {
      if (!mix || invalidGrowth) return;
      onChange(phase === "before" ? { currentInvestments: mix.total, preRetirementInvestmentReturnRate: mix.totalReturn, investmentMix: items.map(item => ({ ...item })) } : { retirementReturnRate: incomeActive ? mix.capitalGrowth : mix.totalReturn, ...(incomeActive ? { passiveIncomeYieldRate: mix.incomeYield } : {}), retirementInvestmentMix: items.map(item => ({ ...item })) });
      setMessage("Portfolio assumptions applied. Your projection uses this blend until you change it.");
    }}>Use this blended return</button><p role="status">{message}</p>
    <small>Blended return = sum of each amount × its return ÷ total amount. This assumes a stable allocation; individual assets are not simulated separately.</small>
  </details>;
}
