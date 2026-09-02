import type { HouseholdYear } from "../utils/householdProjection";
import { formatCurrency } from "../utils/formatters";

export function HouseholdCpfCosts({ rows }: { rows: HouseholdYear[] }) {
  return <details className="year-data-card cpf-help">
    <summary>CPF top-ups and insurance by person and year</summary>
    <p>Annual amounts in SGD. Premiums show actual MediSave use and the remaining cash cost. Capped or unfunded top-ups stay outside CPF. Housing cash is the mortgage amount not covered by OA.</p>
    <div className="table-wrap household-year-table"><table>
      <thead><tr><th>Year</th><th>Person / age</th><th>Top-up paid</th><th>Top-up unfilled</th><th>Premium total</th><th>From MA</th><th>From cash</th><th>Housing cash</th></tr></thead>
      <tbody>{rows.flatMap(row => row.people.map(person => <tr key={`${row.calendarYear}-${person.id}`}>
        <td>{row.calendarYear}</td><td>{person.label} / {person.age}</td>
        {[person.cpfRetirementTopUp, person.cpfRetirementTopUpUnfilled, person.insurancePremiumTotal, person.cpfMaMedicalPremium, person.insuranceCashPremium, person.housingCashPayment].map((amount, index) => <td key={index}>{formatCurrency(amount)}</td>)}
      </tr>))}</tbody>
    </table></div>
    <div className="household-year-cards">{rows.flatMap(row => row.people.map(person => <article key={`${row.calendarYear}-${person.id}`}>
      <header><strong>{row.calendarYear}</strong><span>{person.label}, age {person.age}</span></header>
      <dl>{[
        ["Top-up paid", person.cpfRetirementTopUp], ["Top-up unfilled", person.cpfRetirementTopUpUnfilled],
        ["Premium total", person.insurancePremiumTotal], ["From MediSave", person.cpfMaMedicalPremium],
        ["From cash", person.insuranceCashPremium], ["Housing cash", person.housingCashPayment]
      ].map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>{formatCurrency(Number(amount))}</dd></div>)}</dl>
    </article>))}</div>
  </details>;
}
