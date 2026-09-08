import { useId } from "react";
import type { RetirementInputs } from "../types";
import { activeIncomeAnnual, applicableBhs, cpfContributionForYear } from "../utils/projection";
import { formatCurrency } from "../utils/formatters";
import { QuizNumberQuestion } from "./QuizNumberQuestion";

export function MedisaveBalanceQuestion({ currentAge, value, onChange }: {
  currentAge: number; value: number; onChange: (value: number) => void;
}) {
  const cap = applicableBhs(currentAge);
  return <div data-category="cpf">
    <QuizNumberQuestion category="cpf" label="CPF MA" value={value} min={0} max={cap} step={100}
      onChange={onChange} format={formatCurrency}
      helper={`MediSave is for healthcare, not retirement spending. Your applicable BHS limit is ${formatCurrency(cap)}.`} />
    {value > cap ? <p className="cpf-input-warning" role="status">Your saved balance exceeds this limit. Please check your CPF statement. It has not been silently changed; the projection routes the excess to other CPF accounts.</p> : null}
    <details className="cpf-help"><summary>How does this limit change?</summary><p>The 2026 BHS is $79,000 for members below 65 and those turning 65. Older members keep their cohort limit. Future BHS increases use a 4.6% yearly planning assumption until 65, then freeze. This is not an announced future schedule.</p>
      <a href="https://www.moh.gov.sg/newsroom/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026/" target="_blank" rel="noreferrer">Official 2026 BHS</a>
    </details>
  </div>;
}

export function CpfPlanningPreview({ inputs, housing = false }: { inputs: RetirementInputs; housing?: boolean }) {
  const id = useId();
  const cpf = cpfContributionForYear(inputs, inputs.currentAge);
  const income = activeIncomeAnnual(inputs, inputs.currentAge) / 12;
  const takeHome = Math.max(0, income - cpf.employee / 12);
  const saving = inputs.cashSavingsContribution + inputs.investmentContribution;
  const exceedsIncome = inputs.currentAge < inputs.retirementAge && inputs.cpfWorkStatus !== "Not contributing" && saving > takeHome;
  const oaGap = Math.max(0, inputs.cpfOaHousingMonthly - cpf.oa / 12);
  const allocations = [["OA", cpf.oa], [inputs.currentAge < 55 ? "SA" : "RA", cpf.sa + cpf.ra], ["MA", cpf.ma]] as const;
  return <section className="cpf-planning-preview" aria-label={housing ? "CPF allocation for housing" : "Income and savings check"}>
    <p>Employment income estimates CPF only. Enter monthly savings and investments after your regular expenses and CPF deductions.</p>
    <details className="cpf-help"><summary>Why is salary not added to my cash balance?</summary><p>This is a retirement planner, not a complete household budget. Only your entered savings are added to cash and investments. The check below excludes income tax and living costs, so it is an upper bound, not an affordable-savings recommendation. Other income or a partner's support may explain a difference.</p></details>
    {exceedsIncome ? <div className="cpf-input-warning" role="status"><strong>Check your funding: {formatCurrency(saving)}/month exceeds estimated take-home of {formatCurrency(takeHome)}/month.</strong><p>The difference is {formatCurrency(saving - takeHome)}/month before tax and living expenses. Reduce your savings entries or ensure another source funds them. This warning does not change your projections.</p></div> : null}
    {housing ? <>
      <h3>Estimated monthly CPF allocation at age {inputs.currentAge}</h3>
      <dl>{allocations.map(([name, amount]) => <div key={name}><dt>CPF {name}</dt><dd>{formatCurrency(amount / 12)}/month</dd><small>{cpf.total > 0 ? `${(amount / cpf.total * 100).toFixed(2)}% of total CPF contributions` : "No contributions projected"}</small></div>)}</dl>
      <p>Total CPF: {formatCurrency(cpf.total / 12)}/month, including employee and employer contributions where applicable. These percentages are allocation shares, not percentages of salary.</p>
      {oaGap > 0 ? <p className="cpf-input-warning">Your mortgage uses {formatCurrency(oaGap)}/month more than estimated OA inflow. Existing OA of {formatCurrency(inputs.cpfOa)} can bridge this gap; once OA is insufficient the projection adds a cash payment. This preview excludes interest and future rate changes.</p> : null}
      <details id={id} className="cpf-help"><summary>Allocation limits and future changes</summary><p>Uses the same age, residency, wage caps and contribution rules as the projection. Self-employed mandatory contributions go to MA; only voluntary three-account contributions allocate to OA and SA/RA. MA overflow and RA limits may redirect funds later. Contributions stop at your selected retirement age.</p><a href="https://www.cpf.gov.sg/service/article/how-are-my-cpf-contributions-allocated-to-my-cpf-accounts" target="_blank" rel="noreferrer">CPF allocation rules</a></details>
    </> : null}
  </section>;
}
