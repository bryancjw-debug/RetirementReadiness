import { useId, useState, type ReactNode } from "react";
import { Check, CircleHelp } from "lucide-react";
import type { RetirementInputs, InsuranceEstimate } from "../types";
import { insuranceForYear, normalizeInsurance } from "../utils/insurance";
import { formatCurrency } from "../utils/formatters";

export type CpfExtrasValues = Pick<RetirementInputs, "currentAge" | "retirementAge" | "endAge" | "includeCpf" | "retirementTopUp" | "insuranceEstimate" | "cpfMaMedicalPremiumAnnual">;
type Patch = Partial<Pick<RetirementInputs, "retirementTopUp" | "insuranceEstimate" | "cpfMaMedicalPremiumAnnual">>;

function Choice({ children, selected, onClick }: { children: ReactNode; selected: boolean; onClick: () => void }) {
  return <button type="button" className={`quiz-choice is-compact ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={onClick}>
    <span className="quiz-choice__check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span><span>{children}</span>
  </button>;
}

function NumberAnswer({ label, value, onChange, min = 0, max = 1_000_000, suffix = "SGD / year" }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="quiz-text-field" htmlFor={id}><span>{label}</span>
    <input id={id} type="number" inputMode="decimal" min={min} max={max} value={draft ?? value}
      onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n); }}
      onBlur={() => { if (draft !== null && draft !== "" && Number.isFinite(Number(draft))) onChange(Math.min(max, Math.max(min, Number(draft)))); setDraft(null); }} />
    <small>{suffix}</small>
  </label>;
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return <details className="cpf-help"><summary><CircleHelp size={17} aria-hidden="true" />{title}</summary><div>{children}</div></details>;
}

export function CpfExtrasQuiz({ value, onChange }: { value: CpfExtrasValues; onChange: (patch: Patch) => void }) {
  const topUp = value.retirementTopUp ?? { enabled: false, annualAmount: 8_000, startAge: value.currentAge, endAge: value.retirementAge - 1 };
  const insurance = normalizeInsurance(value.insuranceEstimate);
  const preview = insuranceForYear(value as RetirementInputs, value.currentAge);
  function updateInsurance(patch: Partial<InsuranceEstimate>) { onChange({ insuranceEstimate: { ...insurance, ...patch } }); }
  return <div className="cpf-extras quiz-stack">
    <section className="quiz-subsection" aria-label="Retirement CPF top-ups">
      <h3>Would you like to add cash specifically for retirement income?</h3>
      <p className="cpf-question-note">Optional, for employed and self-employed members. This is separate from mandatory CPF and voluntary contributions to all three accounts.</p>
      <div className="quiz-choice-grid quiz-choice-grid--two">
        <Choice selected={!topUp.enabled} onClick={() => onChange({ retirementTopUp: { ...topUp, enabled: false } })}><strong>Not for now</strong><small>Keep my cash available outside CPF.</small></Choice>
        <Choice selected={topUp.enabled} onClick={() => onChange({ retirementTopUp: { ...topUp, enabled: true, startAge: Math.max(value.currentAge, topUp.startAge), endAge: Math.max(value.currentAge, topUp.endAge) } })}><strong>Top up my retirement savings</strong><small>Cash to SA before 55; RA from 55.</small></Choice>
      </div>
      <Note title="How is this different from other CPF contributions?">
        <p>Retirement Sum Topping-Up (RSTU) cash top-ups go only to SA/RA. Three-account voluntary contributions are allocated across OA, SA/RA and MA and share the $37,740 annual limit with mandatory CPF. RSTU uses separate retirement-sum limits.</p>
        <p>RSTU money is irreversible and reserved for retirement payouts, not housing or lump-sum withdrawals. CPF transfers are different from cash top-ups and do not receive cash-top-up tax relief.</p>
        <p>For self-employed members, the three-account option models additional contributions after mandatory MediSave has been paid. If you instead use its MediSave allocation to offset an unpaid mandatory amount, use CPF's calculator to avoid counting that obligation twice. Saved cash contributions should already be net of mandatory CPF and these three-account payments.</p>
        <a href="https://www.cpf.gov.sg/member/growing-your-savings/saving-more-with-cpf/top-up-to-enjoy-higher-retirement-payouts" target="_blank" rel="noreferrer">CPF retirement top-up rules</a>
      </Note>
      {topUp.enabled ? <div className="quiz-stack quiz-subsection">
        <div className="cpf-answer-grid">
          <NumberAnswer label="Annual retirement top-up" value={topUp.annualAmount} onChange={(n) => onChange({ retirementTopUp: { ...topUp, annualAmount: n } })} />
          <NumberAnswer label="First top-up age" value={Math.max(value.currentAge, topUp.startAge)} min={value.currentAge} max={value.endAge} suffix="Age, inclusive" onChange={(n) => onChange({ retirementTopUp: { ...topUp, startAge: n, endAge: Math.max(n, topUp.endAge) } })} />
          <NumberAnswer label="Last top-up age" value={Math.max(value.currentAge, topUp.endAge)} min={Math.max(value.currentAge, topUp.startAge)} max={value.endAge} suffix="Age, inclusive" onChange={(n) => onChange({ retirementTopUp: { ...topUp, endAge: n } })} />
        </div>
        <p className="cpf-question-note">Paid from your projected cash holdings and cash savings contributions, in addition to your investment contributions. The app does not sell investments or borrow to fund an optional top-up. Unfunded or capped top-ups appear in the year table.</p>
        <Note title="$8,000 is a tax-relief ceiling, not a top-up limit">
          <p>Own-account cash top-up relief is up to $8,000 a year, shared with eligible MediSave cash top-ups. Relief applies only up to FRS, is subject to eligibility and the overall personal relief cap, and is not a dollar-for-dollar tax refund. MRSS-matched top-ups do not qualify. This planner does not credit tax refunds or matching grants.</p>
          <p>Before 55, SA headroom is based on the prevailing FRS. From 55, RA top-ups can reach the prevailing ERS. Future limits are estimates. Past CPFIS withdrawals and the principal/interest split of an existing RA are not collected; confirm exact headroom in your CPF dashboard.</p>
          <p>If you enter an official CPF LIFE payout override, it remains fixed: refresh that quote after changing top-ups. Automatic payout increases use the app's estimate, not an official quotation.</p>
          <a href="https://www.cpf.gov.sg/service/article/what-is-the-maximum-amount-of-top-ups-i-can-receive" target="_blank" rel="noreferrer">Top-up limits</a>{" · "}<a href="https://www.cpf.gov.sg/service/article/how-much-tax-relief-can-i-enjoy-when-i-make-cash-top-ups" target="_blank" rel="noreferrer">Tax-relief conditions</a>
        </Note>
      </div> : null}
    </section>

    <section className="quiz-subsection" aria-label="Insurance premium estimates">
      <h3>Include a simple estimate of health-insurance premiums?</h3>
      <p className="cpf-question-note">Premiums reduce MediSave first within approved limits. The cash remainder is an additional expense, so leave it out of your lifestyle budget and enter savings before these extra deductions.</p>
      <div className="quiz-choice-grid quiz-choice-grid--two">
        <Choice selected={!insurance.enabled} onClick={() => updateInsurance({ enabled: false })}><strong>{value.cpfMaMedicalPremiumAnnual > 0 ? "Keep my entered MA amount" : "Not for now"}</strong><small>{value.cpfMaMedicalPremiumAnnual > 0 ? `${formatCurrency(value.cpfMaMedicalPremiumAnnual)} yearly; fixed legacy estimate.` : "No extra insurance expense added."}</small></Choice>
        <Choice selected={insurance.enabled} onClick={() => updateInsurance({ enabled: true })}><strong>Estimate my premiums</strong><small>Age-based hospital cover and optional long-term care.</small></Choice>
      </div>
      {!insurance.enabled && value.cpfMaMedicalPremiumAnnual > 0 ? <NumberAnswer label="Existing annual MediSave premium estimate" value={value.cpfMaMedicalPremiumAnnual} onChange={(n) => onChange({ cpfMaMedicalPremiumAnnual: n })} /> : null}
      {insurance.enabled ? <div className="quiz-stack quiz-subsection">
        <fieldset className="cpf-question-group"><legend>Which hospital cover should we allow for?</legend>
          <div className="quiz-choice-grid quiz-choice-grid--three">
            <Choice selected={insurance.hospitalCover === "medishield"} onClick={() => updateInsurance({ hospitalCover: "medishield" })}><strong>MediShield Life only</strong></Choice>
            <Choice selected={insurance.hospitalCover === "integrated"} onClick={() => updateInsurance({ hospitalCover: "integrated" })}><strong>Integrated Shield Plan</strong></Choice>
            <Choice selected={insurance.hospitalCover === "none"} onClick={() => updateInsurance({ hospitalCover: "none" })}><strong>Exclude hospital premiums</strong></Choice>
          </div>
        </fieldset>
        {insurance.hospitalCover === "integrated" ? <NumberAnswer label="Current private IP premium, excluding MediShield Life and riders" value={insurance.privatePremiumAnnual} onChange={(n) => updateInsurance({ privatePremiumAnnual: n })} /> : null}
        <fieldset className="cpf-question-group"><legend>Are you paying for CareShield Life?</legend><div className="quiz-choice-grid quiz-choice-grid--two">
          <Choice selected={!insurance.careShield} onClick={() => updateInsurance({ careShield: false })}><strong>No / leave out</strong></Choice>
          <Choice selected={insurance.careShield} onClick={() => updateInsurance({ careShield: true })}><strong>Yes, include premiums</strong></Choice>
        </div></fieldset>
        {insurance.careShield ? <NumberAnswer label="CareShield Life annual premium now" value={insurance.careShieldPremiumAnnual} onChange={(n) => updateInsurance({ careShieldPremiumAnnual: n })} /> : null}
        <fieldset className="cpf-question-group"><legend>Do you have a CareShield / ElderShield supplement?</legend><div className="quiz-choice-grid quiz-choice-grid--two">
          <Choice selected={!insurance.supplement} onClick={() => updateInsurance({ supplement: false })}><strong>No / leave out</strong></Choice>
          <Choice selected={insurance.supplement} onClick={() => updateInsurance({ supplement: true })}><strong>Yes, include a supplement</strong></Choice>
        </div></fieldset>
        {insurance.supplement ? <><NumberAnswer label="Supplement annual premium" value={insurance.supplementPremiumAnnual} onChange={(n) => updateInsurance({ supplementPremiumAnnual: n })} />
          <p className="cpf-question-note">Starts at $600 as a planning placeholder. MediSave use is capped at $600 per insured per year across all supplements, not per policy. Any excess is cash. A level premium is assumed; confirm your policy terms.</p></> : null}
        <dl className="cpf-premium-preview" aria-live="polite"><div><dt>Estimated annual premium now</dt><dd>{formatCurrency(preview.total)}</dd></div><div><dt>Eligible for MediSave</dt><dd>{formatCurrency(preview.medisaveEligible)}</dd></div><div><dt>Cash above withdrawal limits</dt><dd>{formatCurrency(preview.cashRequired)}</dd></div></dl>
        <p className="cpf-question-note">If MediSave runs out, the projection funds the remaining premium from cash. No family support, subsidies, disability claims or premium waivers are assumed. The estimate replaces any old flat MA-premium input, not adds to it.</p>
        <Note title="Estimate assumptions and optional adjustments">
          <p>MediShield Life uses MOH's age-next-birthday premium table effective 1 April 2025, before subsidies, including GST. Future repricing starts at 3% yearly as a planning assumption, not an announced increase.</p>
          <p>For a private IP, your entered premium follows the MediShield age curve as a rough proxy plus the same repricing rate. Riders are excluded. This is not an insurer quote. The additional MediSave limit is $300 up to age-next-birthday 40, $600 from 41 to 70, and $900 from 71.</p>
          <p>CareShield Life starts at an illustrative $400 yearly if unknown and assumes 4% annual growth until 67, not a personalised official schedule. Premium support and cohort-specific catch-up amounts are excluded. Payment stops after age 67, or after ten payments for entry at 59 or later. Supplements stay level until the last payment age below.</p>
          <div className="cpf-answer-grid">
            <NumberAnswer label="Hospital premium repricing assumption" suffix="% yearly, beyond age-band changes" max={20} value={insurance.premiumGrowthRate} onChange={(n) => updateInsurance({ premiumGrowthRate: n })} />
            {insurance.careShield ? <><NumberAnswer label="CareShield Life join age" suffix="Age" min={30} max={100} value={insurance.careShieldJoinAge} onChange={(n) => updateInsurance({ careShieldJoinAge: n })} /><NumberAnswer label="CareShield Life premium growth assumption" suffix="% yearly" max={20} value={insurance.careShieldGrowthRate} onChange={(n) => updateInsurance({ careShieldGrowthRate: n })} /></> : null}
            {insurance.supplement ? <NumberAnswer label="Last supplement payment age" suffix="Age, inclusive" max={120} value={insurance.supplementEndAge} onChange={(n) => updateInsurance({ supplementEndAge: n })} /> : null}
          </div>
          <p>Sources checked 3 September 2026: <a href="https://www.moh.gov.sg/managing-expenses/schemes-and-subsidies/medishield-life/medishield-life-premium-and-subsidy-tables/" target="_blank" rel="noreferrer">MOH premiums</a>{" · "}<a href="https://www.cpf.gov.sg/member/healthcare-financing/careshield-life/careshield-premiums-and-subsidies" target="_blank" rel="noreferrer">CareShield Life</a>{" · "}<a href="https://www.cpf.gov.sg/member/healthcare-financing/getting-supplementary-coverage/careshield-life-eldershield-supplements" target="_blank" rel="noreferrer">Supplement limits</a></p>
        </Note>
      </div> : null}
    </section>
  </div>;
}
