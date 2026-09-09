import { useRef, useState } from "react";
import { Check, Info, Plus, Trash2, X } from "lucide-react";
import type { RetirementInputs } from "../types";
import { lifestyleBudgets, budgetCategories, dependantSpendingForYear } from "../utils/lifestyle";
import { formatCurrency } from "../utils/formatters";

export function LifestylePlanner({ profile, onChange, onPreset, currentAge, retirementAge, monthlyBase, showPresets = true }: {
  profile: RetirementInputs["spendingProfile"]; onChange: (value: NonNullable<RetirementInputs["spendingProfile"]>) => void;
  onPreset: (amount: number) => void; currentAge: number; retirementAge: number; monthlyBase: number; showPresets?: boolean;
}) {
  const value = profile ?? { adults: 1, dependants: [] };
  const [family, setFamily] = useState(value.dependants.length > 0);
  const savedDependants = useRef(value.dependants);
  const dialog = useRef<HTMLDialogElement>(null);
  const [example, setExample] = useState(() => Math.max(0, lifestyleBudgets.findIndex(preset => monthlyBase === preset.single || monthlyBase === preset.couple)));
  const amount = value.adults === 1 ? lifestyleBudgets[example].single : lifestyleBudgets[example].couple;
  return <section className="quiz-stack quiz-subsection" aria-label="Retirement household spending">
    <fieldset className="cpf-question-group"><legend>Who will this retirement budget support?</legend>
      <div className="quiz-choice-grid quiz-choice-grid--three">{["Just me", "Two adults", "Adults with dependants"].map((label, index) => <button type="button" className={`quiz-choice is-compact ${index === (family ? 2 : value.adults - 1) ? "is-selected" : ""}`} aria-pressed={index === (family ? 2 : value.adults - 1)} key={label}
        onClick={() => { if (family) savedDependants.current = value.dependants; setFamily(index === 2); onChange({ adults: index === 0 ? 1 : value.adults === 1 && index === 2 ? 1 : 2, dependants: index === 2 ? savedDependants.current : [] }); }}><span className="quiz-choice__check" aria-hidden="true">{index === (family ? 2 : value.adults - 1) ? <Check size={16} /> : null}</span><strong>{label}</strong></button>)}</div>
    </fieldset>
    <p className="cpf-question-note">This is a retirement planner, not a current household cash-flow calculator. Include large family costs only if they continue into retirement, especially if retiring early. Changing household size does not replace your entered spending amount; choose a sample below to apply it.</p>
    {family ? <>
      <label className="quiz-text-field">Adults supported<select value={value.adults} onChange={e => onChange({ ...value, adults: Number(e.target.value) as 1 | 2 })}><option value={1}>One adult</option><option value={2}>Two adults</option></select></label>
      {value.dependants.map((person, index) => <div className="dependant-fields" key={person.id}>
        <strong>{person.label}</strong><button type="button" className="icon-button" aria-label={`Remove ${person.label}`} title="Remove dependant" onClick={() => onChange({ ...value, dependants: value.dependants.filter(p => p.id !== person.id) })}><Trash2 size={18} /></button>
        {([['Age now', 'currentAge'], ['Support ends at their age', 'supportUntilAge'], ['Monthly support, today’s SGD', 'monthlyAmountToday']] as const).map(([label,key]) => <label className="quiz-text-field" key={key}>{label}<input aria-label={`${person.label}: ${label}`} type="number" min={0} max={key === 'monthlyAmountToday' ? 20000 : 120} value={person[key]} onChange={e => onChange({ ...value, dependants: value.dependants.map((p,i) => i === index ? { ...p, [key]: Math.max(0, Math.min(key === 'monthlyAmountToday' ? 20000 : 120, Number(e.target.value))) } : p) })} /></label>)}
      </div>)}
      <button type="button" className="secondary-action" onClick={() => onChange({ ...value, dependants: [...value.dependants, { id: crypto.randomUUID(), label: `Dependant ${value.dependants.length + 1}`, currentAge: 10, supportUntilAge: 25, monthlyAmountToday: 750 }] })}><Plus size={18} /> Add dependant</button>
      <p className="cpf-question-note">$750/month is an editable planning placeholder, not a SingStat child-cost estimate. Support stops at the entered age. Exclude these amounts from the adult lifestyle budget to avoid double-counting.</p>
    </> : null}
    {showPresets ? <div className="quiz-choice-grid quiz-choice-grid--three">{lifestyleBudgets.map((preset,index) => {
      const total = value.adults === 1 ? preset.single : preset.couple;
      return <button type="button" className={`quiz-choice lifestyle-preset ${monthlyBase === total ? "is-selected" : ""}`} aria-pressed={monthlyBase === total} key={preset.label} onClick={() => { setExample(index); onPreset(total); }}><span className="quiz-choice__check" aria-hidden="true">{monthlyBase === total ? <Check size={16} /> : null}</span><span><strong>{preset.label}</strong><small>{formatCurrency(total)}/month · {value.adults === 1 ? "one adult" : "two adults"}</small><small>Dependant support is added separately</small></span></button>;
    })}</div> : null}
    <button type="button" className="source-button" onClick={() => dialog.current?.showModal()}><Info size={18} /> How were these examples estimated?</button>
    {value.dependants.length ? <p className="education-callout">Additional dependant support at retirement, in today's prices: {formatCurrency(dependantSpendingForYear(value, Math.max(0, retirementAge - currentAge), 0) / 12)}/month.</p> : null}
    <dialog ref={dialog} className="planning-dialog" aria-labelledby="lifestyle-dialog-title" onClick={e => { if (e.target === e.currentTarget) { const r=e.currentTarget.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom) dialog.current?.close(); } }}>
      <header><h2 id="lifestyle-dialog-title">Behind the lifestyle examples</h2><button autoFocus type="button" className="icon-button" aria-label="Close spending explanation" onClick={() => dialog.current?.close()}><X /></button></header>
      <p>SingStat's Household Expenditure Survey 2023 reported $5,931/month across resident households and $2,349/month for households comprising solely non-employed people aged 65 and over. These describe different populations, not one-person or two-person recommended budgets.</p>
      <p>Our {lifestyleBudgets[example].label.toLowerCase()} example for {value.adults} adult(s): <strong>{formatCurrency(amount)}/month in today's SGD</strong>. The amounts and category allocations below are planner-designed illustrations informed by the survey, not SingStat figures or an inflation update of its averages.</p>
      <dl className="budget-infographic">{budgetCategories.map((label,i) => <div key={label}><dt>{label}</dt><dd>{formatCurrency(amount * lifestyleBudgets[example].shares[i])}</dd><meter min={0} max={1} value={lifestyleBudgets[example].shares[i]} aria-label={label} /></div>)}</dl>
      <p>Two adults share home costs, so the example is not simply doubled. Excludes mortgage/rent, major education fees and dependants. The healthcare allowance includes ordinary cash costs; avoid adding those again in the insurance questions. Replace any sample with your own amount.</p>
      <a href="https://www.singstat.gov.sg/publications/households/household-expenditure-survey" target="_blank" rel="noreferrer">SingStat HES 2023 · source checked 8 September 2026</a>
    </dialog>
  </section>;
}
