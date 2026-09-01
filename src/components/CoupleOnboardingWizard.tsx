import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Landmark, Sparkles, Users } from "lucide-react";
import type { HouseholdPersonPlan, HouseholdPlan, HouseholdResidency } from "../household";
import { cloneHouseholdPlan } from "../household";
import type { CpfLifePlan, CpfPrRateType, CpfPrYear, CpfWorkStatus, CustomIncomeStream, OneTimeFinancialEvent, RetirementSumChoice, SrsFirstContributionPeriod, SrsWithdrawalStrategy } from "../types";
import { formatCurrency } from "../utils/formatters";
import { srsContributionCap, srsPrescribedRetirementAge } from "../utils/projection";

interface CoupleOnboardingWizardProps {
  initialPlan: HouseholdPlan;
  editMode?: boolean;
  onComplete: (plan: HouseholdPlan) => void;
  onCancel: () => void;
}

function ChoiceCard({ title, description, selected, onClick, compact = false }: {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button className={`quiz-choice ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""}`} type="button" aria-pressed={selected} onClick={onClick}>
      <span className="quiz-choice__check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span>
      <span><strong>{title}</strong>{description ? <small>{description}</small> : null}</span>
    </button>
  );
}

function RangeQuestion({ label, helper, value, min, max, step, onChange, quickValues, format = String }: {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  quickValues?: number[];
  format?: (value: number) => string;
}) {
  const id = `couple-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const progress = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <div className="quiz-slider-block">
      <div className="quiz-slider-block__header">
        <div><label htmlFor={id}>{label}</label><p>{helper}</p></div>
        <output>{format(value)}</output>
      </div>
      <input id={id} className="quiz-range" type="range" min={min} max={max} step={step} value={value} style={{ "--range-progress": `${progress}%` } as CSSProperties} onChange={(event) => onChange(Number(event.target.value))} />
      <div className="quiz-range-labels" aria-hidden="true"><span>{format(min)}</span><span>{format(max)}{value === max ? "+" : ""}</span></div>
      {quickValues ? <div className="quick-values" aria-label={`Quick choices for ${label}`}>
        {[...new Set(quickValues)].filter((item) => item >= min && item <= max).map((item) => <button className={value === item ? "is-selected" : ""} type="button" key={item} onClick={() => onChange(item)}>{format(item)}</button>)}
      </div> : null}
    </div>
  );
}

function Step({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <div className="quiz-step"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="quiz-step__intro">{intro}</p>{children}</div>;
}

const stepLabels = ["Both of you", "Timing", "Lifestyle", "Resources", "CPF", "SRS", "Events & income", "Refine", "Review"];

function possessiveLabel(label: string) {
  return label.trim().toLowerCase() === "you" ? "Your" : `${label}’s`;
}

function householdEventTemplate(label: string, anchorAge: number, retirementAge: number): OneTimeFinancialEvent {
  const inflow = label === "Property sale" || label === "Possible inheritance";
  return { id: "household-guided-event", label, age: Math.max(anchorAge + 1, Math.min(retirementAge, anchorAge + 10)), amount: inflow ? 250_000 : 80_000, direction: inflow ? "inflow" : "outflow", certainty: label === "Possible inheritance" ? "possible" : "expected" };
}

function personIncomeTemplate(label: string, retirementAge: number, endAge: number): CustomIncomeStream {
  return { id: "guided-person-income", label, startAge: retirementAge, endAge, amount: label === "Part-time income" ? 2_000 : 1_000, frequency: "monthly", growthMode: "fixed", annualIncreaseRate: 0 };
}

export function CoupleOnboardingWizard({ initialPlan, editMode = false, onComplete, onCancel }: CoupleOnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [activePerson, setActivePerson] = useState<0 | 1>(0);
  const [plan, setPlan] = useState<HouseholdPlan>(() => cloneHouseholdPlan(initialPlan));
  const [refineAdvanced, setRefineAdvanced] = useState(false);
  const [refineSrs, setRefineSrs] = useState<[boolean, boolean]>([false, false]);
  const [addCpfBalances, setAddCpfBalances] = useState<[boolean, boolean]>(() => initialPlan.people.map((item) => item.inputs.currentAge >= 55 || item.inputs.cpfOa + item.inputs.cpfSa + item.inputs.cpfMa + item.inputs.cpfRa > 0) as [boolean, boolean]);
  const [refineCpf, setRefineCpf] = useState<[boolean, boolean]>([false, false]);
  const person = plan.people[activePerson];
  const firstRetirementOffset = Math.min(...plan.people.map((item) => item.inputs.retirementAge - item.inputs.currentAge));
  const bothRetiredOffset = Math.max(...plan.people.map((item) => item.inputs.retirementAge - item.inputs.currentAge));
  const spendingStartOffset = plan.retirementStart === "first" ? firstRetirementOffset : bothRetiredOffset;
  const futureMonthlySpending = useMemo(() => (
    plan.retirementSpendingAnnual / 12 * Math.pow(1 + plan.retirementSpendingInflationRate / 100, spendingStartOffset)
  ), [plan.retirementSpendingAnnual, plan.retirementSpendingInflationRate, spendingStartOffset]);

  function updatePlan<K extends keyof HouseholdPlan>(key: K, value: HouseholdPlan[K]) {
    setPlan((current) => ({ ...current, [key]: value }));
  }

  function updatePerson(index: 0 | 1, patch: Partial<HouseholdPersonPlan>) {
    setPlan((current) => {
      const people = current.people.map((item, personIndex) => personIndex === index ? { ...item, ...patch } : item) as HouseholdPlan["people"];
      return { ...current, people };
    });
  }

  function updatePersonInput<K extends keyof HouseholdPersonPlan["inputs"]>(index: 0 | 1, key: K, value: HouseholdPersonPlan["inputs"][K]) {
    setPlan((current) => {
      const people = current.people.map((item, personIndex) => personIndex === index
        ? { ...item, inputs: { ...item.inputs, [key]: value } }
        : item) as HouseholdPlan["people"];
      return { ...current, people };
    });
  }

  function updateAge(index: 0 | 1, value: number) {
    const current = plan.people[index].inputs;
    updatePerson(index, { inputs: {
      ...current,
      currentAge: value,
      retirementAge: Math.max(value + 1, current.retirementAge),
      endAge: Math.max(100, value + 35),
      cpfLifeStartAge: Math.max(current.cpfLifeStartAge, Math.min(70, value)),
      cpfSa: value >= 55 ? 0 : current.cpfSa,
      cpfRa: value < 55 ? 0 : current.cpfRa
    } });
  }

  function updateResidency(index: 0 | 1, residency: HouseholdResidency) {
    const current = plan.people[index];
    updatePerson(index, {
      residency,
      inputs: {
        ...current.inputs,
        includeCpf: residency === "Foreigner" ? false : current.inputs.includeCpf,
        cpfResidency: residency === "Permanent Resident" ? "Permanent Resident" : "Singapore Citizen",
        srsResidency: residency === "Foreigner" ? "Foreigner" : "Singapore Citizen Or Permanent Resident"
      }
    });
  }

  function updateSrsPeriod(index: 0 | 1, value: SrsFirstContributionPeriod) {
    updatePersonInput(index, "srsFirstContributionPeriod", value);
    updatePersonInput(index, "srsFirstWithdrawalAge", srsPrescribedRetirementAge({ srsFirstContributionPeriod: value }));
  }

  function chooseHouseholdEvent(label: string) {
    updatePlan("includeOneTimeEvents", true);
    updatePlan("oneTimeEvents", [householdEventTemplate(label, plan.people[0].inputs.currentAge, plan.people[0].inputs.retirementAge)]);
  }

  function updateHouseholdEvent(patch: Partial<OneTimeFinancialEvent>) {
    const current = plan.oneTimeEvents[0] ?? householdEventTemplate("Major home cost", plan.people[0].inputs.currentAge, plan.people[0].inputs.retirementAge);
    updatePlan("oneTimeEvents", [{ ...current, ...patch }]);
  }

  function choosePersonIncome(index: 0 | 1, label: string) {
    updatePersonInput(index, "customIncomeStreams", [personIncomeTemplate(label, plan.people[index].inputs.retirementAge, plan.people[index].inputs.endAge)]);
  }

  function updatePersonIncome(index: 0 | 1, patch: Partial<CustomIncomeStream>) {
    const inputs = plan.people[index].inputs;
    const current = inputs.customIncomeStreams[0] ?? personIncomeTemplate("Other steady income", inputs.retirementAge, inputs.endAge);
    updatePersonInput(index, "customIncomeStreams", [{ ...current, ...patch }]);
  }

  const canContinue = plan.people.every((item) => item.inputs.retirementAge > item.inputs.currentAge)
    && plan.retirementSpendingAnnual > 0;

  function next() {
    if (!canContinue) return;
    if (step === stepLabels.length - 1) {
      onComplete(plan);
      return;
    }
    setStep((current) => current + 1);
    setActivePerson(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    if (step === 0) {
      onCancel();
      return;
    }
    setStep((current) => current - 1);
    setActivePerson(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="onboarding-card couple-onboarding" aria-label="Guided couple retirement setup">
      <div className="quiz-progress">
        <div className="quiz-progress__top"><span>Step {step + 1} of {stepLabels.length}</span><strong>{stepLabels[step]}</strong></div>
        <div className="quiz-progress__track" aria-hidden="true"><i style={{ width: `${((step + 1) / stepLabels.length) * 100}%` }} /></div>
      </div>

      {step === 0 ? <Step eyebrow="Planning together" title="Let’s place both of you on the same timeline." intro="Each person keeps a separate CPF and SRS journey. Names are optional and stay in this browser.">
        <div className="couple-person-grid">
          {plan.people.map((item, index) => <article className={`person-setup-card person-tone-${index + 1}`} key={item.id}>
            <div className="person-card-heading"><span>{index === 0 ? "Person 1" : "Person 2"}</span><Users size={20} /></div>
            <label className="quiz-text-field"><span>Preferred name <small>Optional</small></span><input value={item.label === (index === 0 ? "You" : "Partner") ? "" : item.label} placeholder={index === 0 ? "You" : "Partner"} maxLength={30} onChange={(event) => updatePerson(index as 0 | 1, { label: event.target.value || (index === 0 ? "You" : "Partner") })} /></label>
            <RangeQuestion label={`${possessiveLabel(item.label)} current age`} helper="Used to align contribution and payout milestones." value={item.inputs.currentAge} min={18} max={79} step={1} onChange={(value) => updateAge(index as 0 | 1, value)} format={(value) => `Age ${value}`} />
          </article>)}
        </div>
      </Step> : null}

      {step === 1 ? <Step eyebrow="Your shared timeline" title="When might work become optional for each of you?" intro="Different retirement ages create a transition period where one person may have stopped contributing while the other continues.">
        <div className="couple-person-grid">
          {plan.people.map((item, index) => <article className={`person-setup-card person-tone-${index + 1}`} key={item.id}>
            <div className="person-card-heading"><strong>{item.label}</strong><span>{item.inputs.retirementAge - item.inputs.currentAge} years away</span></div>
            <RangeQuestion label={`${possessiveLabel(item.label)} retirement age`} helper="The age this person's regular contributions stop." value={item.inputs.retirementAge} min={item.inputs.currentAge + 1} max={80} step={1} onChange={(value) => { updatePersonInput(index as 0 | 1, "retirementAge", value); updatePersonInput(index as 0 | 1, "srsContributionEndAge", value); }} format={(value) => `Age ${value}`} quickValues={[55, 60, 65, 70]} />
          </article>)}
        </div>
        <div className="quiz-subsection"><span className="quiz-subsection__label">When should household retirement spending begin?</span><div className="quiz-choice-grid quiz-choice-grid--two">
          <ChoiceCard title="When the first person retires" description="Tests the full transition period. This is the more cautious starting view." selected={plan.retirementStart === "first"} onClick={() => updatePlan("retirementStart", "first")} />
          <ChoiceCard title="When both have retired" description="Focuses on the period after both regular contribution schedules have ended." selected={plan.retirementStart === "both"} onClick={() => updatePlan("retirementStart", "both")} />
        </div></div>
      </Step> : null}

      {step === 2 ? <Step eyebrow="One household lifestyle" title="What might both of you spend each month in retirement?" intro="Enter one household amount in today’s dollars. Shared costs are counted once rather than duplicated across two people.">
        <div className="quiz-choice-grid quiz-choice-grid--three">
          {[
            [4_000, "Essentials-focused", "Core household needs with modest leisure."],
            [6_000, "Comfortable", "Room for leisure, family activities and occasional travel."],
            [8_500, "More flexibility", "More room for travel, hobbies and family support."]
          ].map(([amount, label, note]) => <ChoiceCard key={amount} title={`${label} · ${formatCurrency(Number(amount))}/month`} description={String(note)} selected={plan.retirementSpendingAnnual / 12 === amount} onClick={() => updatePlan("retirementSpendingAnnual", Number(amount) * 12)} />)}
        </div>
        <div className="quiz-subsection"><RangeQuestion label="Household monthly spending today" helper="A shared household amount, not an amount per person." value={plan.retirementSpendingAnnual / 12} min={2_500} max={15_000} step={250} onChange={(value) => updatePlan("retirementSpendingAnnual", value * 12)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[4_000, 6_000, 8_500, 12_000]} /></div>
        <div className="future-value-reveal"><div><span>Today</span><strong>{formatCurrency(plan.retirementSpendingAnnual / 12)}</strong></div><ArrowRight size={20} /><div><span>When spending starts</span><strong>{formatCurrency(futureMonthlySpending)}</strong></div><p>Uses {plan.retirementSpendingInflationRate}% annual inflation over {spendingStartOffset} years.</p></div>
      </Step> : null}

      {step === 3 ? <Step eyebrow="Household resources" title="What resources and contributions are intended for retirement?" intro="Cash and investments are treated as one shared retirement pool. Each person’s ongoing contributions stop at their own retirement age.">
        <div className="quiz-stack">
          <RangeQuestion label="Shared cash savings" helper="Exclude emergency cash and amounts committed to near-term goals." value={plan.currentCashSavings} min={0} max={750_000} step={5_000} onChange={(value) => updatePlan("currentCashSavings", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 50_000, 100_000, 250_000, 500_000]} />
          <RangeQuestion label="Shared retirement investments" helper="Do not include your home unless a future monetisation event is explicitly modelled." value={plan.currentInvestments} min={0} max={2_000_000} step={10_000} onChange={(value) => updatePlan("currentInvestments", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 100_000, 250_000, 500_000, 1_000_000]} />
        </div>
        <div className="couple-person-grid quiz-subsection">
          {plan.people.map((item, index) => <article className={`person-setup-card person-tone-${index + 1}`} key={item.id}>
            <div className="person-card-heading"><strong>{item.label}</strong><span>Until age {item.inputs.retirementAge}</span></div>
            <RangeQuestion label={`${possessiveLabel(item.label)} monthly cash contribution`} helper="Average amount added to shared cash." value={item.inputs.cashSavingsContribution} min={0} max={5_000} step={100} onChange={(value) => updatePersonInput(index as 0 | 1, "cashSavingsContribution", value)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[0, 500, 1_000, 2_000]} />
            <RangeQuestion label={`${possessiveLabel(item.label)} monthly investment contribution`} helper="Average amount added to shared investments." value={item.inputs.investmentContribution} min={0} max={10_000} step={100} onChange={(value) => updatePersonInput(index as 0 | 1, "investmentContribution", value)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[0, 500, 1_000, 2_000, 5_000]} />
          </article>)}
        </div>
      </Step> : null}

      {step === 4 ? <Step eyebrow="Individual CPF journeys" title="Let’s add CPF one person at a time." intro="CPF contribution, allocation, age-55 and CPF LIFE milestones remain separate. Household results combine the income only when each payout begins.">
        <div className="person-tabs" role="tablist">{plan.people.map((item, index) => <button type="button" role="tab" aria-selected={activePerson === index} className={`${activePerson === index ? "is-active" : ""} person-tone-${index + 1}`} key={item.id} onClick={() => setActivePerson(index as 0 | 1)}>{item.label}<small>{item.inputs.includeCpf ? "CPF included" : "CPF not included"}</small></button>)}</div>
        <article className={`person-detail-card person-tone-${activePerson + 1}`}>
          <div className="person-detail-card__header"><div><span>{person.label}</span><h3>CPF assumptions</h3></div><Landmark size={24} /></div>
          <div className="quiz-choice-grid quiz-choice-grid--three">
            {(["Singapore Citizen", "Permanent Resident", "Foreigner"] as HouseholdResidency[]).map((option) => <ChoiceCard compact key={option} title={option} selected={person.residency === option} onClick={() => updateResidency(activePerson, option)} />)}
          </div>
          {person.residency === "Foreigner" ? <div className="education-callout"><CircleHelp size={19} /><p>CPF is not included for this person. SRS can still be modelled separately on the next step.</p></div> : <>
            <div className="quiz-subsection"><span className="quiz-subsection__label">Include {person.label.trim().toLowerCase() === "you" ? "your" : possessiveLabel(person.label)} CPF?</span><div className="segmented-choice"><button className={person.inputs.includeCpf ? "is-selected" : ""} type="button" onClick={() => updatePersonInput(activePerson, "includeCpf", true)}>Yes</button><button className={!person.inputs.includeCpf ? "is-selected" : ""} type="button" onClick={() => updatePersonInput(activePerson, "includeCpf", false)}>Not now</button></div></div>
            {person.inputs.includeCpf ? <>
              <div className="quiz-subsection"><span className="quiz-subsection__label">Current CPF work status</span><div className="quiz-choice-grid quiz-choice-grid--three">{(["Employed", "Self-employed", "Not contributing"] as CpfWorkStatus[]).map((option) => <ChoiceCard compact key={option} title={option} selected={person.inputs.cpfWorkStatus === option} onClick={() => updatePersonInput(activePerson, "cpfWorkStatus", option)} />)}</div></div>
              {person.inputs.cpfWorkStatus !== "Not contributing" ? <RangeQuestion label="Gross monthly income" helper="Used only to estimate this person’s CPF contributions, subject to CPF wage limits." value={person.inputs.grossMonthlyIncome} min={0} max={20_000} step={250} onChange={(value) => updatePersonInput(activePerson, "grossMonthlyIncome", value)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[3_000, 5_000, 8_000, 12_000]} /> : null}
              {person.residency === "Permanent Resident" ? <div className="cpf-pr-grid quiz-subsection">
                <label><span>Current PR contribution year</span><select value={person.inputs.cpfPrYear} onChange={(event) => updatePersonInput(activePerson, "cpfPrYear", event.target.value as CpfPrYear)}>{(["First Year", "Second Year", "Third Year Or Later"] as CpfPrYear[]).map((option) => <option key={option}>{option}</option>)}</select></label>
                <label><span>Contribution arrangement</span><select value={person.inputs.cpfPrRateType} onChange={(event) => updatePersonInput(activePerson, "cpfPrRateType", event.target.value as CpfPrRateType)}>{(["Graduated Employer And Employee", "Full Employer And Graduated Employee", "Full Employer And Employee"] as CpfPrRateType[]).map((option) => <option key={option}>{option}</option>)}</select></label>
              </div> : null}
              <div className="optional-question-block quiz-subsection"><span className="quiz-subsection__label">Add {person.label.trim().toLowerCase() === "you" ? "your" : possessiveLabel(person.label)} current CPF balances?</span><div className="segmented-choice"><button type="button" className={addCpfBalances[activePerson] ? "is-selected" : ""} onClick={() => setAddCpfBalances((current) => current.map((value, index) => index === activePerson ? true : value) as [boolean, boolean])}>Add balances</button><button type="button" className={!addCpfBalances[activePerson] ? "is-selected" : ""} onClick={() => { setAddCpfBalances((current) => current.map((value, index) => index === activePerson ? false : value) as [boolean, boolean]); setPlan((current) => ({ ...current, people: current.people.map((item, index) => index === activePerson ? { ...item, inputs: { ...item.inputs, cpfOa: 0, cpfSa: 0, cpfMa: 0, cpfRa: 0 } } : item) as HouseholdPlan["people"] })); }}>Not with me now</button></div>{!addCpfBalances[activePerson] ? <small>Future contributions can still be projected. Current balances remain at zero until added.</small> : null}</div>
              {addCpfBalances[activePerson] ? <div className="cpf-balance-grid quiz-subsection">
                <RangeQuestion label="CPF OA" helper="Current Ordinary Account balance." value={person.inputs.cpfOa} min={0} max={500_000} step={5_000} onChange={(value) => updatePersonInput(activePerson, "cpfOa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 100_000, 250_000]} />
                {person.inputs.currentAge < 55
                  ? <RangeQuestion label="CPF SA" helper="Current Special Account balance. RA will form at age 55." value={person.inputs.cpfSa} min={0} max={500_000} step={5_000} onChange={(value) => updatePersonInput(activePerson, "cpfSa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 100_000, 250_000]} />
                  : <RangeQuestion label="CPF RA" helper="At age 55 or above, use the current Retirement Account balance." value={person.inputs.cpfRa} min={0} max={700_000} step={5_000} onChange={(value) => updatePersonInput(activePerson, "cpfRa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 50_000, 110_000, 220_000, 440_000]} />}
                <RangeQuestion label="CPF MA" helper="Current MediSave Account balance; not treated as general retirement spending money." value={person.inputs.cpfMa} min={0} max={150_000} step={5_000} onChange={(value) => updatePersonInput(activePerson, "cpfMa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 79_000]} />
              </div> : null}
              <div className="education-callout"><CircleHelp size={19} /><p>{person.inputs.currentAge >= 55 ? "SA is closed for this person. OA, RA and MA are tracked from today, while age-banded contributions continue if they are still working." : "RA forms and SA closes when this person reaches age 55. Their CPF LIFE payout begins only at the selected payout age."}</p></div>
              <RangeQuestion label="CPF LIFE start age" helper="Choose age 65 to 70. For someone already past 65, choose their actual or intended start age." value={Math.max(Math.min(70, person.inputs.currentAge), person.inputs.cpfLifeStartAge)} min={Math.min(70, Math.max(65, person.inputs.currentAge))} max={70} step={1} onChange={(value) => updatePersonInput(activePerson, "cpfLifeStartAge", value)} format={(value) => `Age ${value}`} quickValues={[65, 67, 70]} />
              <div className="optional-question-block quiz-subsection"><span className="quiz-subsection__label">Fine-tune {person.label.trim().toLowerCase() === "you" ? "your" : possessiveLabel(person.label)} CPF LIFE assumptions?</span><div className="segmented-choice"><button type="button" className={!refineCpf[activePerson] ? "is-selected" : ""} onClick={() => setRefineCpf((current) => current.map((value, index) => index === activePerson ? false : value) as [boolean, boolean])}>Keep Standard defaults</button><button type="button" className={refineCpf[activePerson] ? "is-selected" : ""} onClick={() => setRefineCpf((current) => current.map((value, index) => index === activePerson ? true : value) as [boolean, boolean])}>Fine tune</button></div></div>
              {refineCpf[activePerson] ? <>
                <div className="quiz-subsection"><span className="quiz-subsection__label">CPF LIFE plan assumption</span><div className="quiz-choice-grid quiz-choice-grid--three">{(["Standard", "Basic", "Escalating"] as CpfLifePlan[]).map((option) => <ChoiceCard compact key={option} title={option} selected={person.inputs.cpfLifePlan === option} onClick={() => updatePersonInput(activePerson, "cpfLifePlan", option)} />)}</div></div>
                {person.inputs.currentAge < 55 ? <div className="quiz-subsection"><span className="quiz-subsection__label">Retirement Sum reference</span><div className="quiz-choice-grid quiz-choice-grid--three">{(["Basic", "Full", "Enhanced"] as RetirementSumChoice[]).map((option) => <ChoiceCard compact key={option} title={option} selected={person.inputs.cpfRetirementSum === option} onClick={() => updatePersonInput(activePerson, "cpfRetirementSum", option)} />)}</div></div> : null}
              </> : null}
              {person.inputs.currentAge >= 65 && person.inputs.cpfLifeStartAge <= person.inputs.currentAge ? <div className="optional-question-block quiz-subsection">
                <span className="quiz-subsection__label">Use an actual monthly CPF LIFE payout?</span>
                <div className="segmented-choice"><button type="button" className={person.inputs.cpfLifeMonthlyOverride <= 0 ? "is-selected" : ""} onClick={() => updatePersonInput(activePerson, "cpfLifeMonthlyOverride", 0)}>Use an estimate</button><button type="button" className={person.inputs.cpfLifeMonthlyOverride > 0 ? "is-selected" : ""} onClick={() => updatePersonInput(activePerson, "cpfLifeMonthlyOverride", Math.max(500, person.inputs.cpfLifeMonthlyOverride || 1_500))}>Use actual payout</button></div>
                {person.inputs.cpfLifeMonthlyOverride > 0 ? <RangeQuestion label="Monthly CPF LIFE payout" helper="Use the amount in this person’s CPF records or official estimator." value={person.inputs.cpfLifeMonthlyOverride} min={100} max={6_000} step={50} onChange={(value) => updatePersonInput(activePerson, "cpfLifeMonthlyOverride", value)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[500, 1_000, 1_500, 2_500, 4_000]} /> : null}
              </div> : null}
            </> : null}
          </>}
        </article>
      </Step> : null}

      {step === 5 ? <Step eyebrow="Individual SRS journeys" title="Would either person like SRS included?" intro="SRS is optional and calculated separately for each person. The projection shows contributions, growth, gross withdrawals, estimated tax and net withdrawals.">
        <div className="person-tabs" role="tablist">{plan.people.map((item, index) => <button type="button" role="tab" aria-selected={activePerson === index} className={`${activePerson === index ? "is-active" : ""} person-tone-${index + 1}`} key={item.id} onClick={() => setActivePerson(index as 0 | 1)}>{item.label}<small>{item.inputs.includeSrs ? "SRS included" : "SRS not included"}</small></button>)}</div>
        <article className={`person-detail-card person-tone-${activePerson + 1}`}>
          <div className="person-detail-card__header"><div><span>{person.label}</span><h3>SRS assumptions</h3></div><Sparkles size={24} /></div>
          <div className="segmented-choice"><button className={person.inputs.includeSrs ? "is-selected" : ""} type="button" onClick={() => updatePersonInput(activePerson, "includeSrs", true)}>Include SRS</button><button className={!person.inputs.includeSrs ? "is-selected" : ""} type="button" onClick={() => updatePersonInput(activePerson, "includeSrs", false)}>Not now</button></div>
          {person.inputs.includeSrs ? <div className="quiz-stack quiz-subsection">
            <RangeQuestion label="Current SRS balance" helper="This person’s SRS account balance today." value={person.inputs.srsCurrentBalance} min={0} max={500_000} step={5_000} onChange={(value) => updatePersonInput(activePerson, "srsCurrentBalance", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 100_000, 250_000]} />
            <RangeQuestion label="Annual SRS contribution" helper={`Capped at ${formatCurrency(srsContributionCap(person.inputs))} for this residency in the model.`} value={Math.min(person.inputs.srsAnnualContribution, srsContributionCap(person.inputs))} min={0} max={srsContributionCap(person.inputs)} step={100} onChange={(value) => updatePersonInput(activePerson, "srsAnnualContribution", value)} format={(value) => `${formatCurrency(value)}/yr`} quickValues={[0, 5_000, 10_000, srsContributionCap(person.inputs)]} />
            <div><span className="quiz-subsection__label">When was the first SRS contribution made?</span><div className="quiz-choice-grid quiz-choice-grid--two">{([
              "Before 1 July 2022", "1 July 2022 To 30 June 2026", "From 1 July 2026", "Not Sure"
            ] as SrsFirstContributionPeriod[]).map((option) => <ChoiceCard compact key={option} title={option} selected={person.inputs.srsFirstContributionPeriod === option} onClick={() => updateSrsPeriod(activePerson, option)} />)}</div></div>
            <div className="education-callout"><CircleHelp size={19} /><p>The model begins withdrawals from age {person.inputs.srsFirstWithdrawalAge} and spreads qualifying withdrawals across ten years. Estimated tax assumes no other taxable income.</p></div>
            <div className="quiz-subsection"><span className="quiz-subsection__label">Refine {person.label.trim().toLowerCase() === "you" ? "your" : possessiveLabel(person.label)} SRS assumptions?</span><div className="segmented-choice"><button type="button" className={!refineSrs[activePerson] ? "is-selected" : ""} onClick={() => setRefineSrs((current) => current.map((value, index) => index === activePerson ? false : value) as [boolean, boolean])}>Keep starting assumptions</button><button type="button" className={refineSrs[activePerson] ? "is-selected" : ""} onClick={() => setRefineSrs((current) => current.map((value, index) => index === activePerson ? true : value) as [boolean, boolean])}>Fine tune</button></div></div>
            {refineSrs[activePerson] ? <div className="advanced-quiz-panel quiz-stack">
              <RangeQuestion label="SRS return assumption" helper="Annual growth assumed for this person’s SRS balance. It is not guaranteed." value={person.inputs.srsReturnRate} min={0} max={8} step={0.5} onChange={(value) => updatePersonInput(activePerson, "srsReturnRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[1, 2.5, 4]} />
              <RangeQuestion label="SRS contribution end age" helper="Future contributions stop at this age or retirement, whichever comes first." value={person.inputs.srsContributionEndAge} min={person.inputs.currentAge} max={person.inputs.retirementAge} step={1} onChange={(value) => updatePersonInput(activePerson, "srsContributionEndAge", value)} format={(value) => `Age ${value}`} quickValues={[55, 60, person.inputs.retirementAge]} />
              <div><span className="quiz-subsection__label">Withdrawal approach</span><div className="quiz-choice-grid quiz-choice-grid--two">{(["Tax Aware", "Even Over Ten Years"] as SrsWithdrawalStrategy[]).map((option) => <ChoiceCard compact key={option} title={option} description={option === "Tax Aware" ? "Recalculates an even remaining balance each year." : "Uses one-tenth of the opening withdrawal balance."} selected={person.inputs.srsWithdrawalStrategy === option} onClick={() => updatePersonInput(activePerson, "srsWithdrawalStrategy", option)} />)}</div></div>
            </div> : null}
          </div> : <div className="education-callout"><CircleHelp size={19} /><p>No SRS balance, contribution, growth or withdrawal is included for {person.label}.</p></div>}
        </article>
      </Step> : null}

      {step === 6 ? <Step eyebrow="Events and other income" title="Could anything else materially affect the household journey?" intro="Add only items you want the projection to count. Shared events are counted once; recurring income remains attached to the person who receives it.">
        <div className="optional-question-block">
          <span className="quiz-subsection__label">Include one shared future inflow or outflow?</span>
          <div className="segmented-choice"><button type="button" className={plan.includeOneTimeEvents ? "is-selected" : ""} onClick={() => { updatePlan("includeOneTimeEvents", true); if (!plan.oneTimeEvents.length) chooseHouseholdEvent("Major home cost"); }}>Yes</button><button type="button" className={!plan.includeOneTimeEvents ? "is-selected" : ""} onClick={() => updatePlan("includeOneTimeEvents", false)}>Not now</button></div>
          {plan.includeOneTimeEvents ? <div className="quiz-stack quiz-subsection">
            <div className="quiz-choice-grid quiz-choice-grid--two">{["Major home cost", "Family support", "Property sale", "Possible inheritance"].map((label) => <ChoiceCard compact key={label} title={label} selected={plan.oneTimeEvents[0]?.label === label} onClick={() => chooseHouseholdEvent(label)} />)}</div>
            <RangeQuestion label={`Event age for ${plan.people[0].label}`} helper={`The shared event occurs once in the year ${plan.people[0].label} reaches this age.`} value={plan.oneTimeEvents[0]?.age ?? plan.people[0].inputs.retirementAge} min={plan.people[0].inputs.currentAge + 1} max={plan.people[0].inputs.endAge} step={1} onChange={(value) => updateHouseholdEvent({ age: value })} format={(value) => `Age ${value}`} quickValues={[plan.people[0].inputs.retirementAge, 65, 70]} />
            <RangeQuestion label="Shared event amount" helper="This amount is added to or taken from shared cash once." value={plan.oneTimeEvents[0]?.amount ?? 80_000} min={0} max={2_000_000} step={10_000} onChange={(value) => updateHouseholdEvent({ amount: value })} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[50_000, 100_000, 250_000, 500_000]} />
            <div><span className="quiz-subsection__label">How certain is this event?</span><div className="segmented-choice"><button type="button" className={plan.oneTimeEvents[0]?.certainty !== "possible" ? "is-selected" : ""} onClick={() => updateHouseholdEvent({ certainty: "expected" })}>Expected</button><button type="button" className={plan.oneTimeEvents[0]?.certainty === "possible" ? "is-selected" : ""} onClick={() => updateHouseholdEvent({ certainty: "possible" })}>Possible</button></div></div>
          </div> : null}
        </div>
        <div className="quiz-subsection"><span className="quiz-subsection__label">Recurring retirement income by person</span><p className="range-disclosure">Examples include rental income, a policy or annuity payout, and part-time income. Do not add CPF LIFE or SRS here—they are already modelled separately.</p></div>
        <div className="person-tabs" role="tablist">{plan.people.map((item, index) => <button type="button" role="tab" aria-selected={activePerson === index} className={`${activePerson === index ? "is-active" : ""} person-tone-${index + 1}`} key={item.id} onClick={() => setActivePerson(index as 0 | 1)}>{item.label}<small>{item.inputs.customIncomeStreams.length ? "Income included" : "No extra income"}</small></button>)}</div>
        <article className={`person-detail-card person-tone-${activePerson + 1}`}>
          <div className="person-detail-card__header"><div><span>{person.label}</span><h3>Other retirement income</h3></div><Sparkles size={24} /></div>
          <div className="segmented-choice"><button type="button" className={person.inputs.customIncomeStreams.length ? "is-selected" : ""} onClick={() => { if (!person.inputs.customIncomeStreams.length) choosePersonIncome(activePerson, "Policy or annuity payout"); }}>Include income</button><button type="button" className={!person.inputs.customIncomeStreams.length ? "is-selected" : ""} onClick={() => updatePersonInput(activePerson, "customIncomeStreams", [])}>Not now</button></div>
          {person.inputs.customIncomeStreams.length ? <div className="quiz-stack quiz-subsection">
            <div className="quiz-choice-grid quiz-choice-grid--two">{["Policy or annuity payout", "Rental income", "Part-time income", "Other steady income"].map((label) => <ChoiceCard compact key={label} title={label} selected={person.inputs.customIncomeStreams[0]?.label === label} onClick={() => choosePersonIncome(activePerson, label)} />)}</div>
            <RangeQuestion label="Monthly income" helper="The gross amount this person expects to receive." value={person.inputs.customIncomeStreams[0]?.amount ?? 1_000} min={0} max={20_000} step={250} onChange={(value) => updatePersonIncome(activePerson, { amount: value })} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[500, 1_000, 2_000, 5_000]} />
            <RangeQuestion label="Income starts" helper="Counted only once household retirement spending has begun." value={person.inputs.customIncomeStreams[0]?.startAge ?? person.inputs.retirementAge} min={person.inputs.currentAge + 1} max={person.inputs.endAge} step={1} onChange={(value) => updatePersonIncome(activePerson, { startAge: value, endAge: Math.max(value, person.inputs.customIncomeStreams[0]?.endAge ?? person.inputs.endAge) })} format={(value) => `Age ${value}`} quickValues={[person.inputs.retirementAge, 65, 70]} />
            <RangeQuestion label="Income ends" helper="Use the planning end age if it is expected to continue for life." value={person.inputs.customIncomeStreams[0]?.endAge ?? person.inputs.endAge} min={person.inputs.customIncomeStreams[0]?.startAge ?? person.inputs.retirementAge} max={person.inputs.endAge} step={1} onChange={(value) => updatePersonIncome(activePerson, { endAge: value })} format={(value) => `Age ${value}`} quickValues={[75, 85, person.inputs.endAge]} />
          </div> : <div className="education-callout"><CircleHelp size={19} /><p>No additional recurring income is included for {person.label}.</p></div>}
        </article>
        <div className="education-callout"><CircleHelp size={19} /><p>Possible inflows can overstate readiness. Compare the result with the event switched off before relying on it.</p></div>
      </Step> : null}

      {step === 7 ? <Step eyebrow="Optional refinement" title="Would you like to adjust the household planning assumptions?" intro="The starting assumptions are visible and editable. Most users can continue without changing them.">
        <div className="quiz-choice-grid quiz-choice-grid--two"><ChoiceCard title="Keep the starting assumptions" description={`${plan.retirementSpendingInflationRate}% spending inflation · ${plan.preRetirementInvestmentReturnRate}% investment return before retirement.`} selected={!refineAdvanced} onClick={() => setRefineAdvanced(false)} /><ChoiceCard title="Let us refine them" description="Adjust the rates and planning horizon used by the household calculation." selected={refineAdvanced} onClick={() => setRefineAdvanced(true)} /></div>
        {refineAdvanced ? <div className="advanced-quiz-panel quiz-stack quiz-subsection">
          <div className="couple-person-grid">{plan.people.map((item, index) => <article className={`person-setup-card person-tone-${index + 1}`} key={item.id}><div className="person-card-heading"><strong>{item.label}</strong><span>Planning horizon</span></div><RangeQuestion label={`${possessiveLabel(item.label)} projection end age`} helper="The year-by-year scenario continues to this age." value={item.inputs.endAge} min={Math.max(item.inputs.retirementAge + 1, 80)} max={105} step={1} onChange={(value) => updatePersonInput(index as 0 | 1, "endAge", value)} format={(value) => `Age ${value}`} quickValues={[90, 95, 100]} /></article>)}</div>
          <RangeQuestion label="Household spending inflation" helper="How quickly the same household lifestyle may cost more." value={plan.retirementSpendingInflationRate} min={0} max={5} step={0.1} onChange={(value) => updatePlan("retirementSpendingInflationRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[2, 2.5, 3]} />
          <RangeQuestion label="Shared cash return" helper="Annual return assumed for shared cash savings." value={plan.cashInterestRate} min={0} max={5} step={0.1} onChange={(value) => updatePlan("cashInterestRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[0.5, 1, 2]} />
          <RangeQuestion label="Investment return before retirement" helper="A planning assumption for the shared portfolio, not a guaranteed return." value={plan.preRetirementInvestmentReturnRate} min={0} max={10} step={0.5} onChange={(value) => updatePlan("preRetirementInvestmentReturnRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[3, 5, 7]} />
          <RangeQuestion label="Investment return during retirement" helper="Kept separate because withdrawals may change how the portfolio is used." value={plan.retirementReturnRate} min={0} max={8} step={0.5} onChange={(value) => updatePlan("retirementReturnRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[1, 3, 5]} />
          <RangeQuestion label="Annual contribution increase" helper="How much both people’s regular shared contributions rise each year." value={plan.annualContributionIncreaseRate} min={0} max={8} step={0.5} onChange={(value) => updatePlan("annualContributionIncreaseRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[0, 2, 3]} />
        </div> : <div className="education-callout"><CircleHelp size={19} /><p>Continuing keeps the displayed starting assumptions. You can return and refine them after seeing the result.</p></div>}
      </Step> : null}

      {step === 8 ? <Step eyebrow="Review together" title="Here is the household retirement picture we’ll test." intro="Shared spending, events and non-CPF resources are counted once. CPF, SRS and other income remain attached to each person until the household result layer.">
        <div className="review-grid">
          <article><span>Household lifestyle</span><strong>{formatCurrency(plan.retirementSpendingAnnual / 12)}/month today</strong><small>{formatCurrency(futureMonthlySpending)}/month when modelled spending begins</small></article>
          <article><span>Shared starting resources</span><strong>{formatCurrency(plan.currentCashSavings + plan.currentInvestments)}</strong><small>{formatCurrency(plan.currentCashSavings)} cash · {formatCurrency(plan.currentInvestments)} invested</small></article>
          <article><span>Shared event</span><strong>{plan.includeOneTimeEvents ? plan.oneTimeEvents[0]?.label ?? "Included" : "Not included"}</strong><small>{plan.oneTimeEvents[0]?.certainty === "possible" ? "Possible—compare without it later" : "Counted once at household level"}</small></article>
          <article><span>Planning assumptions</span><strong>{plan.retirementSpendingInflationRate}% inflation · {plan.preRetirementInvestmentReturnRate}% investment return</strong><small>{refineAdvanced ? "Refined during the quiz" : "Starting assumptions retained"}</small></article>
        </div>
        <div className="couple-person-grid quiz-subsection">{plan.people.map((item, index) => <article className={`person-review-card person-tone-${index + 1}`} key={item.id}>
          <div className="person-card-heading"><strong>{item.label}</strong><span>Age {item.inputs.currentAge}</span></div>
          <dl><div><dt>Retirement age</dt><dd>{item.inputs.retirementAge}</dd></div><div><dt>Monthly contributions</dt><dd>{formatCurrency(item.inputs.cashSavingsContribution + item.inputs.investmentContribution)}</dd></div><div><dt>CPF</dt><dd>{item.inputs.includeCpf ? "Included" : "Not included"}</dd></div><div><dt>SRS</dt><dd>{item.inputs.includeSrs ? `${formatCurrency(item.inputs.srsCurrentBalance)} now` : "Not included"}</dd></div><div><dt>Other income</dt><dd>{item.inputs.customIncomeStreams.length ? `${formatCurrency(item.inputs.customIncomeStreams[0].amount)}/mo` : "Not included"}</dd></div></dl>
        </article>)}</div>
        <div className="assumption-note"><Sparkles size={20} /><p>This focused retirement model runs until the younger person reaches age {Math.max(...plan.people.map((item) => item.inputs.endAge))}. It excludes property, insurance, tax optimisation, estate planning and employment income available for household spending. Those belong in a broader financial projection such as Common Cents.</p></div>
      </Step> : null}

      <div className="quiz-navigation"><button className="secondary-action" type="button" onClick={back}><ArrowLeft size={18} /> {step === 0 && editMode ? "Cancel" : "Back"}</button><button className="primary-action" type="button" disabled={!canContinue} onClick={next}>{step === stepLabels.length - 1 ? (editMode ? "Update household result" : "Build our projection") : "Continue"} <ArrowRight size={18} /></button></div>
    </section>
  );
}
