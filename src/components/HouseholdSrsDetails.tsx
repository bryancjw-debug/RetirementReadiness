import { useState } from "react";
import type { HouseholdYear } from "../utils/householdProjection";
import { formatCurrency as money } from "../utils/formatters";

export function HouseholdSrsDetails({ rows }: { rows: HouseholdYear[] }) {
  const [year, setYear] = useState<number>();
  if (!rows.some(row => row.people.some(p => p.srsWithdrawal || p.otherTaxableIncome))) return null;
  const selected = rows.find(row => row.calendarYear === year) ?? rows.find(row => row.people.some(p => p.srsWithdrawal || p.otherTaxableIncome))!;
  return <section className="quiz-stack quiz-subsection" aria-label="Household SRS and tax details">
    <h3>SRS withdrawals and retirement tax</h3>
    <label className="quiz-text-field">Year<select value={selected.calendarYear} onChange={event => setYear(Number(event.target.value))}>{rows.map(row => <option key={row.calendarYear} value={row.calendarYear}>{row.calendarYear}</option>)}</select></label>
    <div className="couple-person-grid">{selected.people.map(person => <article className="person-result-card" key={person.id}><h4>{person.label}, age {person.age}</h4><dl className="budget-infographic">{[
      ["SRS gross withdrawal", person.srsWithdrawal], ["Additional tax from SRS", person.srsEstimatedTax], ["SRS net available", person.srsNetWithdrawal], ["Other taxable income", person.otherTaxableIncome], ["Total income tax reserved", person.totalIncomeTax], ["SRS balance remaining", person.srsBalance]
    ].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl></article>)}</div>
    <p className="cpf-question-note">Annual SGD. The funding graph uses net SRS and other income after tax. Unspent net income is retained in shared cash. Each person's tax is calculated separately; total tax includes the additional SRS tax, not an extra deduction.</p>
  </section>;
}
