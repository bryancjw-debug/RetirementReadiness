import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Gauge, Sparkles } from "lucide-react";
import type {
  CpfLifePlan,
  CpfPrRateType,
  CpfPrYear,
  CpfWorkStatus,
  CustomIncomeStream,
  OneTimeFinancialEvent,
  RetirementInputs,
  RetirementSumChoice
} from "../types";
import { formatCurrency } from "../utils/formatters";
import {
  createInitialOnboardingAnswers,
  guidedLifestyleOptions,
  onboardingAnswersToRetirementInputs,
  type ContributionApproach,
  type OnboardingAnswers
} from "../onboarding";

interface OnboardingWizardProps {
  initialInputs: RetirementInputs;
  onComplete: (inputs: RetirementInputs, answers: OnboardingAnswers) => void;
  onExploreSample: () => void;
  onPlanTogether: () => void;
}

function ChoiceCard({
  title,
  description,
  selected,
  onClick,
  compact = false
}: {
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`quiz-choice ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""}`}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="quiz-choice__check" aria-hidden="true">{selected ? <Check size={16} /> : null}</span>
      <span>
        <strong>{title}</strong>
        {description ? <small>{description}</small> : null}
      </span>
    </button>
  );
}

function SliderQuestion({
  label,
  helper,
  value,
  min,
  max,
  step,
  onChange,
  format = (next) => String(next),
  quickValues
}: {
  label: string;
  helper: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  quickValues?: number[];
}) {
  const percentage = ((value - min) / Math.max(1, max - min)) * 100;
  return (
    <div className="quiz-slider-block">
      <div className="quiz-slider-block__header">
        <div>
          <label htmlFor={`slider-${label.replace(/\s+/g, "-").toLowerCase()}`}>{label}</label>
          <p>{helper}</p>
        </div>
        <output>{format(value)}</output>
      </div>
      <input
        id={`slider-${label.replace(/\s+/g, "-").toLowerCase()}`}
        className="quiz-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--range-progress": `${percentage}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="quiz-range-labels" aria-hidden="true">
        <span>{format(min)}</span>
        <span>{format(max)}{value === max ? "+" : ""}</span>
      </div>
      {quickValues ? (
        <div className="quick-values" aria-label={`Quick choices for ${label}`}>
          {[...new Set(quickValues)].filter((quickValue) => quickValue >= min && quickValue <= max).map((quickValue) => (
            <button
              className={value === quickValue ? "is-selected" : ""}
              type="button"
              key={quickValue}
              onClick={() => onChange(quickValue)}
            >
              {format(quickValue)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function QuestionStep({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="quiz-step" role="group" aria-labelledby="quiz-step-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="quiz-step-title">{title}</h2>
      <p className="quiz-step__intro">{intro}</p>
      {children}
    </div>
  );
}

const stepLabels = ["About you", "Timing", "Lifestyle", "Resources", "Building", "CPF & CPF LIFE", "Events & income", "Refine", "Review"];

function eventTemplate(label: string, currentAge: number, retirementAge: number): OneTimeFinancialEvent {
  const inflow = label === "Property sale" || label === "Possible inheritance";
  return {
    id: "guided-event",
    label,
    age: Math.max(currentAge + 1, Math.min(retirementAge, currentAge + 10)),
    amount: inflow ? 200_000 : 50_000,
    direction: inflow ? "inflow" : "outflow",
    certainty: label === "Possible inheritance" ? "possible" : "expected"
  };
}

function incomeTemplate(label: string, retirementAge: number, endAge: number): CustomIncomeStream {
  return {
    id: "guided-income",
    label,
    startAge: retirementAge,
    endAge,
    amount: label === "Part-time income" ? 2_000 : 1_000,
    frequency: "monthly",
    growthMode: "fixed",
    annualIncreaseRate: 0
  };
}

export function OnboardingWizard({ initialInputs, onComplete, onExploreSample, onPlanTogether }: OnboardingWizardProps) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => createInitialOnboardingAnswers(initialInputs));
  const [addCpfBalances, setAddCpfBalances] = useState(() => initialInputs.currentAge >= 55 || initialInputs.cpfOa + initialInputs.cpfSa + initialInputs.cpfMa + initialInputs.cpfRa > 0);
  const [refineCpf, setRefineCpf] = useState(false);

  const yearsUntilRetirement = Math.max(0, answers.retirementAge - answers.currentAge);
  const projectedMonthlySpending = useMemo(
    () => answers.monthlySpendingToday * Math.pow(1 + answers.retirementSpendingInflationRate / 100, yearsUntilRetirement),
    [answers.monthlySpendingToday, answers.retirementSpendingInflationRate, yearsUntilRetirement]
  );

  function update<K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function updateCurrentAge(value: number) {
    setAnswers((current) => ({
      ...current,
      currentAge: value,
      retirementAge: Math.max(value + 1, current.retirementAge),
      cpfLifeStartAge: Math.max(current.cpfLifeStartAge, Math.min(70, value)),
      cpfSa: value >= 55 ? 0 : current.cpfSa,
      cpfRa: value < 55 ? 0 : current.cpfRa
    }));
  }

  function chooseGuidedLifestyle(id: OnboardingAnswers["guidedLifestyle"], monthlyAmount: number) {
    setAnswers((current) => ({ ...current, guidedLifestyle: id, monthlySpendingToday: monthlyAmount }));
  }

  function chooseContributionApproach(value: ContributionApproach) {
    setAnswers((current) => ({
      ...current,
      contributionApproach: value,
      monthlyCashContribution: value === "invest" || value === "none" ? 0 : current.monthlyCashContribution,
      monthlyInvestmentContribution: value === "cash" || value === "none" ? 0 : current.monthlyInvestmentContribution
    }));
  }

  function chooseEvent(label: string) {
    update("includeOneTimeEvents", true);
    update("oneTimeEvents", [eventTemplate(label, answers.currentAge, answers.retirementAge)]);
  }

  function updateEvent(patch: Partial<OneTimeFinancialEvent>) {
    const current = answers.oneTimeEvents[0] ?? eventTemplate("Major home cost", answers.currentAge, answers.retirementAge);
    update("oneTimeEvents", [{ ...current, ...patch }]);
  }

  function chooseIncome(label: string) {
    update("includeOtherIncome", true);
    update("customIncomeStreams", [incomeTemplate(label, answers.retirementAge, answers.endAge)]);
  }

  function updateIncome(patch: Partial<CustomIncomeStream>) {
    const current = answers.customIncomeStreams[0] ?? incomeTemplate("Other steady income", answers.retirementAge, answers.endAge);
    update("customIncomeStreams", [{ ...current, ...patch }]);
  }

  const canContinue = step === 0
    ? answers.currentAge >= 18
    : step === 1
      ? answers.retirementAge > answers.currentAge
      : step === 2
        ? answers.spendingPath !== null && answers.monthlySpendingToday > 0
        : step === 4
          ? answers.contributionApproach !== null
          : true;

  function next() {
    if (!canContinue) return;
    if (step === stepLabels.length - 1) {
      onComplete(onboardingAnswersToRetirementInputs(answers, initialInputs), answers);
      return;
    }
    setStep((current) => Math.min(stepLabels.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    if (step === 0) {
      setStarted(false);
      return;
    }
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!started) {
    return (
      <section className="onboarding-welcome" aria-labelledby="welcome-title">
        <div className="onboarding-welcome__copy">
          <p className="eyebrow">A guided Singapore retirement projection</p>
          <h2 id="welcome-title">Your retirement starts with a picture of the life you want.</h2>
          <p>
            Answer a few guided questions to create an initial projection. You can explore the results first,
            then refine every assumption when you are ready.
          </p>
          <div className="welcome-points">
            <span><Check size={17} /> About five minutes</span>
            <span><Check size={17} /> Estimates are enough</span>
            <span><Check size={17} /> No product recommendations</span>
          </div>
          <div className="welcome-actions">
            <button className="primary-action" type="button" onClick={() => setStarted(true)}>
              Plan for myself <ArrowRight size={18} />
            </button>
            <button className="secondary-action plan-together-action" type="button" onClick={onPlanTogether}>
              Plan together <ArrowRight size={18} />
            </button>
            <button className="text-action" type="button" onClick={onExploreSample}>
              Explore a sample instead
            </button>
          </div>
        </div>
        <aside className="welcome-preview" aria-label="What this check covers">
          <Gauge size={28} />
          <strong>A starting point, not a verdict</strong>
          <p>The result will show what your assumptions imply, which inputs matter, and what you may want to explore next.</p>
          <small>Your answers stay in this browser unless you choose to export them.</small>
        </aside>
      </section>
    );
  }

  return (
    <section className="onboarding-card" aria-label="Guided retirement setup">
      <div className="quiz-progress">
        <div className="quiz-progress__top">
          <span>Step {step + 1} of {stepLabels.length}</span>
          <strong>{stepLabels[step]}</strong>
        </div>
        <div className="quiz-progress__track" aria-hidden="true">
          <i style={{ width: `${((step + 1) / stepLabels.length) * 100}%` }} />
        </div>
      </div>

      {step === 0 ? (
        <QuestionStep eyebrow="About you" title="Let’s begin with where you are today." intro="Your age determines how many years your resources may have to grow. A name is optional and is used only to personalise this experience.">
          <div className="quiz-form-grid">
            <label className="quiz-text-field">
              <span>First or preferred name <small>Optional</small></span>
              <input
                type="text"
                autoComplete="given-name"
                maxLength={40}
                value={answers.preferredName}
                placeholder="How should we address you?"
                onChange={(event) => update("preferredName", event.target.value)}
              />
            </label>
            <SliderQuestion
              label="Your current age"
              helper="Move the slider to your age."
              value={answers.currentAge}
              min={18}
              max={79}
              step={1}
              onChange={updateCurrentAge}
              format={(value) => `Age ${value}`}
            />
          </div>
        </QuestionStep>
      ) : null}

      {step === 1 ? (
        <QuestionStep eyebrow="Your timing" title="At what age would you like work to become optional?" intro="This can mean fully retiring, reducing work, or simply having more choice over how you spend your time.">
          <SliderQuestion
            label="Target retirement age"
            helper={`${yearsUntilRetirement} year${yearsUntilRetirement === 1 ? "" : "s"} from your current age.`}
            value={answers.retirementAge}
            min={Math.min(answers.currentAge + 1, 79)}
            max={80}
            step={1}
            onChange={(value) => update("retirementAge", value)}
            format={(value) => `Age ${value}`}
            quickValues={[55, 60, 65, 70].filter((age) => age > answers.currentAge)}
          />
          <div className="education-callout">
            <CircleHelp size={19} />
            <p>{answers.retirementAge < 65
              ? "Retiring before age 65 can create a period before CPF LIFE would normally begin. Other resources may need to support those years."
              : answers.retirementAge === 65
                ? "Age 65 aligns with the earliest CPF LIFE payout age for most members, although retirement and payout ages do not have to be the same."
                : "A later retirement age adds accumulation years and shortens the period funded from retirement resources. It is one scenario, not necessarily a better choice."}</p>
          </div>
        </QuestionStep>
      ) : null}

      {step === 2 ? (
        <QuestionStep eyebrow="Your lifestyle" title="Do you already have a monthly retirement-spending estimate?" intro="Use today’s prices. The projection will translate the same lifestyle into estimated future dollars.">
          <div className="quiz-choice-grid quiz-choice-grid--two">
            <ChoiceCard title="Yes, I have an estimate" description="Start with the amount you already have in mind." selected={answers.spendingPath === "known"} onClick={() => update("spendingPath", "known")} />
            <ChoiceCard title="Not yet—help me form one" description="Use an illustrative lifestyle starting point, then adjust it." selected={answers.spendingPath === "guided"} onClick={() => update("spendingPath", "guided")} />
          </div>

          {answers.spendingPath ? (
            <div className="quiz-subsection">
              <span className="quiz-subsection__label">Is this spending for one person or a household?</span>
              <div className="segmented-choice">
                <button type="button" className={answers.spendingBasis === "individual" ? "is-selected" : ""} onClick={() => update("spendingBasis", "individual")}>One person</button>
                <button type="button" className={answers.spendingBasis === "household" ? "is-selected" : ""} onClick={() => update("spendingBasis", "household")}>Household</button>
              </div>
            </div>
          ) : null}

          {answers.spendingPath === "guided" ? (
            <div className="quiz-choice-grid quiz-choice-grid--three quiz-subsection">
              {guidedLifestyleOptions.map((option) => (
                <ChoiceCard
                  key={option.id}
                  title={`${option.label} · ${formatCurrency(option.monthlyAmount)}/month`}
                  description={option.note}
                  selected={answers.guidedLifestyle === option.id}
                  onClick={() => chooseGuidedLifestyle(option.id, option.monthlyAmount)}
                />
              ))}
            </div>
          ) : null}

          {answers.spendingPath ? (
            <div className="quiz-subsection">
              <SliderQuestion
                label="Monthly retirement spending in today’s dollars"
                helper="An illustrative starting point only. You can refine the amount after seeing the result."
                value={answers.monthlySpendingToday}
                min={1_500}
                max={12_000}
                step={250}
                onChange={(value) => update("monthlySpendingToday", value)}
                format={(value) => `${formatCurrency(value)}/mo`}
                quickValues={[2_500, 3_500, 5_500, 8_000]}
              />
              <div className="future-value-reveal">
                <div><span>Today’s monthly amount</span><strong>{formatCurrency(answers.monthlySpendingToday)}</strong></div>
                <ArrowRight size={20} aria-hidden="true" />
                <div><span>Estimated at age {answers.retirementAge}</span><strong>{formatCurrency(projectedMonthlySpending)}</strong></div>
              <p>Same intended lifestyle, expressed in future dollars using {answers.retirementSpendingInflationRate}% annual inflation.</p>
              </div>
            </div>
          ) : null}
        </QuestionStep>
      ) : null}

      {step === 3 ? (
        <QuestionStep eyebrow="What you have today" title="What resources are already intended for your future?" intro="Include money you expect to remain available for retirement. Exclude emergency money or funds already committed to a near-term purchase.">
          <div className="quiz-stack">
            <SliderQuestion
              label="Cash savings for long-term use"
              helper="Exclude cash already reserved for a home, renovation, or other near-term goal."
              value={answers.currentCashSavings}
              min={0}
              max={500_000}
              step={5_000}
              onChange={(value) => update("currentCashSavings", value)}
              format={(value) => formatCurrency(value, { compact: value >= 100_000 })}
              quickValues={[0, 25_000, 50_000, 100_000, 250_000]}
            />
            <SliderQuestion
              label="Investments intended for retirement"
              helper="Exclude your home unless you explicitly plan to monetise it later."
              value={answers.currentInvestments}
              min={0}
              max={1_000_000}
              step={10_000}
              onChange={(value) => update("currentInvestments", value)}
              format={(value) => formatCurrency(value, { compact: value >= 100_000 })}
              quickValues={[0, 50_000, 100_000, 250_000, 500_000]}
            />
          </div>
          <p className="range-disclosure">Amounts above these ranges can be entered later in the detailed editor.</p>
        </QuestionStep>
      ) : null}

      {step === 4 ? (
        <QuestionStep eyebrow="Building towards tomorrow" title="How are you currently building towards retirement?" intro="This records what you are doing today. It does not suggest that one approach is better for you.">
          <div className="quiz-choice-grid quiz-choice-grid--three">
            <ChoiceCard compact title="Setting aside cash" selected={answers.contributionApproach === "cash"} onClick={() => chooseContributionApproach("cash")} />
            <ChoiceCard compact title="Investing regularly" selected={answers.contributionApproach === "invest"} onClick={() => chooseContributionApproach("invest")} />
            <ChoiceCard compact title="Doing both" selected={answers.contributionApproach === "both"} onClick={() => chooseContributionApproach("both")} />
            <ChoiceCard compact title="Contributing occasionally" selected={answers.contributionApproach === "occasional"} onClick={() => chooseContributionApproach("occasional")} />
            <ChoiceCard compact title="Not currently contributing" selected={answers.contributionApproach === "none"} onClick={() => chooseContributionApproach("none")} />
          </div>
          {answers.contributionApproach && answers.contributionApproach !== "none" ? (
            <div className="quiz-stack quiz-subsection">
              {answers.contributionApproach !== "invest" ? (
                <SliderQuestion
                  label={answers.contributionApproach === "occasional" ? "Average monthly cash amount" : "Monthly cash amount"}
                  helper="Use a rough monthly average if the amount changes."
                  value={answers.monthlyCashContribution}
                  min={0}
                  max={5_000}
                  step={100}
                  onChange={(value) => update("monthlyCashContribution", value)}
                  format={(value) => `${formatCurrency(value)}/mo`}
                  quickValues={[0, 250, 500, 1_000, 2_000]}
                />
              ) : null}
              {answers.contributionApproach !== "cash" ? (
                <SliderQuestion
                  label={answers.contributionApproach === "occasional" ? "Average monthly investment amount" : "Monthly investment amount"}
                  helper="Use a rough monthly average if contributions are irregular."
                  value={answers.monthlyInvestmentContribution}
                  min={0}
                  max={10_000}
                  step={100}
                  onChange={(value) => update("monthlyInvestmentContribution", value)}
                  format={(value) => `${formatCurrency(value)}/mo`}
                  quickValues={[0, 500, 1_000, 2_000, 5_000]}
                />
              ) : null}
            </div>
          ) : null}
          {answers.contributionApproach === "none" ? (
            <div className="education-callout"><CircleHelp size={19} /><p>Your initial result will show what the resources already entered may support without assuming additional contributions.</p></div>
          ) : null}
        </QuestionStep>
      ) : null}

      {step === 5 ? (
        <QuestionStep eyebrow="Your Singapore retirement foundation" title="Would you like CPF and CPF LIFE included?" intro="CPF is included by default because it is a central retirement resource for many Singaporeans. You remain in control and can leave it out for a separate view.">
          <div className="quiz-choice-grid quiz-choice-grid--two">
            <ChoiceCard title="Yes, include my CPF" description="Model current balances, future contributions and an estimated CPF LIFE payout." selected={answers.includeCpf} onClick={() => update("includeCpf", true)} />
            <ChoiceCard title="No, show a non-CPF view" description="Leave CPF balances, contributions and CPF LIFE income out of this projection." selected={!answers.includeCpf} onClick={() => update("includeCpf", false)} />
          </div>

          {answers.includeCpf ? <div className="quiz-stack quiz-subsection">
            <div>
              <span className="quiz-subsection__label">Your CPF status</span>
              <div className="segmented-choice">
                <button type="button" className={answers.cpfResidency === "Singapore Citizen" ? "is-selected" : ""} onClick={() => update("cpfResidency", "Singapore Citizen")}>Singapore Citizen</button>
                <button type="button" className={answers.cpfResidency === "Permanent Resident" ? "is-selected" : ""} onClick={() => update("cpfResidency", "Permanent Resident")}>Permanent Resident</button>
              </div>
            </div>
            <div>
              <span className="quiz-subsection__label">Are contributions still being added?</span>
              <div className="quiz-choice-grid quiz-choice-grid--three">
                {(["Employed", "Self-employed", "Not contributing"] as CpfWorkStatus[]).map((option) => <ChoiceCard compact key={option} title={option} selected={answers.cpfWorkStatus === option} onClick={() => update("cpfWorkStatus", option)} />)}
              </div>
            </div>
            {answers.cpfWorkStatus !== "Not contributing" ? <SliderQuestion label="Gross monthly income" helper="Used only to estimate future CPF contributions up to your retirement age, subject to CPF wage limits." value={answers.grossMonthlyIncome} min={0} max={20_000} step={250} onChange={(value) => update("grossMonthlyIncome", value)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[3_000, 5_000, 8_000, 12_000]} /> : null}
            {answers.cpfResidency === "Permanent Resident" ? <div className="cpf-pr-grid">
              <label><span>Current PR contribution year</span><select value={answers.cpfPrYear} onChange={(event) => update("cpfPrYear", event.target.value as CpfPrYear)}>{(["First Year", "Second Year", "Third Year Or Later"] as CpfPrYear[]).map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>Contribution arrangement</span><select value={answers.cpfPrRateType} onChange={(event) => update("cpfPrRateType", event.target.value as CpfPrRateType)}>{(["Graduated Employer And Employee", "Full Employer And Graduated Employee", "Full Employer And Employee"] as CpfPrRateType[]).map((option) => <option key={option}>{option}</option>)}</select></label>
            </div> : null}
            <div className="optional-question-block">
              <span className="quiz-subsection__label">Add current CPF balances for a fuller estimate?</span>
              <div className="segmented-choice"><button type="button" className={addCpfBalances ? "is-selected" : ""} onClick={() => setAddCpfBalances(true)}>Add my balances</button><button type="button" className={!addCpfBalances ? "is-selected" : ""} onClick={() => { setAddCpfBalances(false); setAnswers((current) => ({ ...current, cpfOa: 0, cpfSa: 0, cpfMa: 0, cpfRa: 0 })); }}>Not with me now</button></div>
              {!addCpfBalances ? <small>The first view can still project future contributions. Current CPF savings will remain at zero until you add them.</small> : null}
            </div>
            {addCpfBalances ? <div className="cpf-balance-grid">
              <SliderQuestion label="CPF OA" helper="Your current Ordinary Account balance." value={answers.cpfOa} min={0} max={500_000} step={5_000} onChange={(value) => update("cpfOa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 100_000, 250_000]} />
              {answers.currentAge < 55 ? <SliderQuestion label="CPF SA" helper="Your current Special Account balance. The model forms RA at age 55." value={answers.cpfSa} min={0} max={500_000} step={5_000} onChange={(value) => update("cpfSa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 100_000, 250_000]} /> : <SliderQuestion label="CPF RA" helper="At age 55 or above, enter your current Retirement Account balance." value={answers.cpfRa} min={0} max={700_000} step={5_000} onChange={(value) => update("cpfRa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 50_000, 110_000, 220_000, 440_000]} />}
              <SliderQuestion label="CPF MA" helper="Shown separately and not treated as general retirement spending money." value={answers.cpfMa} min={0} max={150_000} step={5_000} onChange={(value) => update("cpfMa", value)} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[0, 25_000, 50_000, 79_000]} />
            </div> : null}
            <div className="education-callout"><CircleHelp size={19} /><p>{answers.currentAge >= 55 ? "Your Special Account is already closed, so this path asks for OA, RA and MA. If you are still working, age-banded contributions continue until your chosen retirement age." : "At age 55, the model forms your Retirement Account and closes the Special Account. CPF LIFE income is then estimated separately from your chosen payout age."}</p></div>
            <SliderQuestion label="CPF LIFE payout start" helper="Choose an age from 65 to 70. This does not have to match your retirement age." value={Math.max(Math.min(70, answers.currentAge), answers.cpfLifeStartAge)} min={Math.min(70, Math.max(65, answers.currentAge))} max={70} step={1} onChange={(value) => update("cpfLifeStartAge", value)} format={(value) => `Age ${value}`} quickValues={[65, 67, 70]} />
            <div className="optional-question-block"><span className="quiz-subsection__label">Fine-tune CPF LIFE assumptions?</span><div className="segmented-choice"><button type="button" className={!refineCpf ? "is-selected" : ""} onClick={() => setRefineCpf(false)}>Keep Standard defaults</button><button type="button" className={refineCpf ? "is-selected" : ""} onClick={() => setRefineCpf(true)}>Fine tune</button></div></div>
            {refineCpf ? <>
              <div><span className="quiz-subsection__label">CPF LIFE plan assumption</span><div className="quiz-choice-grid quiz-choice-grid--three">{(["Standard", "Basic", "Escalating"] as CpfLifePlan[]).map((option) => <ChoiceCard compact key={option} title={option} selected={answers.cpfLifePlan === option} onClick={() => update("cpfLifePlan", option)} />)}</div></div>
              {answers.currentAge < 55 ? <div><span className="quiz-subsection__label">Retirement Sum reference for RA formation</span><div className="quiz-choice-grid quiz-choice-grid--three">{(["Basic", "Full", "Enhanced"] as RetirementSumChoice[]).map((option) => <ChoiceCard compact key={option} title={option} selected={answers.cpfRetirementSum === option} onClick={() => update("cpfRetirementSum", option)} />)}</div></div> : null}
            </> : null}
            {answers.currentAge >= 65 && answers.cpfLifeStartAge <= answers.currentAge ? <div className="optional-question-block">
              <span className="quiz-subsection__label">Do you know your actual monthly CPF LIFE payout?</span>
              <div className="segmented-choice"><button type="button" className={answers.cpfLifeMonthlyOverride <= 0 ? "is-selected" : ""} onClick={() => update("cpfLifeMonthlyOverride", 0)}>Use an estimate</button><button type="button" className={answers.cpfLifeMonthlyOverride > 0 ? "is-selected" : ""} onClick={() => update("cpfLifeMonthlyOverride", Math.max(500, answers.cpfLifeMonthlyOverride || 1_500))}>Use my payout</button></div>
              {answers.cpfLifeMonthlyOverride > 0 ? <SliderQuestion label="Actual monthly CPF LIFE payout" helper="Use the amount shown in your CPF records or official estimator." value={answers.cpfLifeMonthlyOverride} min={100} max={6_000} step={50} onChange={(value) => update("cpfLifeMonthlyOverride", value)} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[500, 1_000, 1_500, 2_500, 4_000]} /> : null}
            </div> : null}
          </div> : <div className="education-callout"><CircleHelp size={19} /><p>Your result will intentionally exclude CPF contributions, account balances and CPF LIFE payouts. You can add them later from Edit assumptions.</p></div>}
        </QuestionStep>
      ) : null}

      {step === 6 ? (
        <QuestionStep eyebrow="Optional events and income" title="Could anything else materially change this retirement picture?" intro="Add only what you reasonably expect. These amounts change the projection; they are not treated as recommendations or guaranteed outcomes.">
          <div className="quiz-subsection optional-question-block">
            <span className="quiz-subsection__label">Include one major future inflow or outflow?</span>
            <div className="segmented-choice"><button type="button" className={answers.includeOneTimeEvents ? "is-selected" : ""} onClick={() => { update("includeOneTimeEvents", true); if (!answers.oneTimeEvents.length) chooseEvent("Major home cost"); }}>Yes</button><button type="button" className={!answers.includeOneTimeEvents ? "is-selected" : ""} onClick={() => update("includeOneTimeEvents", false)}>Not now</button></div>
            {answers.includeOneTimeEvents ? <div className="quiz-stack quiz-subsection">
              <div className="quiz-choice-grid quiz-choice-grid--two">
                {["Major home cost", "Family support", "Property sale", "Possible inheritance"].map((label) => <ChoiceCard compact key={label} title={label} selected={answers.oneTimeEvents[0]?.label === label} onClick={() => chooseEvent(label)} />)}
              </div>
              <SliderQuestion label="Event age" helper="The amount is applied once at this age." value={answers.oneTimeEvents[0]?.age ?? answers.retirementAge} min={answers.currentAge + 1} max={answers.endAge} step={1} onChange={(value) => updateEvent({ age: value })} format={(value) => `Age ${value}`} quickValues={[answers.retirementAge, 65, 70]} />
              <SliderQuestion label="Amount in today’s estimate" helper="Use a reasonable estimate. Test uncertain inflows with and without them later." value={answers.oneTimeEvents[0]?.amount ?? 50_000} min={0} max={1_000_000} step={10_000} onChange={(value) => updateEvent({ amount: value })} format={(value) => formatCurrency(value, { compact: value >= 100_000 })} quickValues={[50_000, 100_000, 250_000, 500_000]} />
              <div><span className="quiz-subsection__label">How certain is this event?</span><div className="segmented-choice"><button type="button" className={answers.oneTimeEvents[0]?.certainty !== "possible" ? "is-selected" : ""} onClick={() => updateEvent({ certainty: "expected" })}>Expected</button><button type="button" className={answers.oneTimeEvents[0]?.certainty === "possible" ? "is-selected" : ""} onClick={() => updateEvent({ certainty: "possible" })}>Possible</button></div></div>
            </div> : null}
          </div>

          <div className="quiz-subsection optional-question-block">
            <span className="quiz-subsection__label">Include another recurring retirement income?</span>
            <div className="segmented-choice"><button type="button" className={answers.includeOtherIncome ? "is-selected" : ""} onClick={() => { update("includeOtherIncome", true); if (!answers.customIncomeStreams.length) chooseIncome("Policy or annuity payout"); }}>Yes</button><button type="button" className={!answers.includeOtherIncome ? "is-selected" : ""} onClick={() => update("includeOtherIncome", false)}>Not now</button></div>
            {answers.includeOtherIncome ? <div className="quiz-stack quiz-subsection">
              <div className="quiz-choice-grid quiz-choice-grid--two">
                {["Policy or annuity payout", "Rental income", "Part-time income", "Other steady income"].map((label) => <ChoiceCard compact key={label} title={label} selected={answers.customIncomeStreams[0]?.label === label} onClick={() => chooseIncome(label)} />)}
              </div>
              <SliderQuestion label="Monthly income" helper="Enter the gross amount available before any personal expenses or tax." value={answers.customIncomeStreams[0]?.amount ?? 1_000} min={0} max={15_000} step={250} onChange={(value) => updateIncome({ amount: value })} format={(value) => `${formatCurrency(value)}/mo`} quickValues={[500, 1_000, 2_000, 5_000]} />
              <SliderQuestion label="Income starts" helper="The income is counted only from this age." value={answers.customIncomeStreams[0]?.startAge ?? answers.retirementAge} min={answers.currentAge + 1} max={answers.endAge} step={1} onChange={(value) => updateIncome({ startAge: value, endAge: Math.max(value, answers.customIncomeStreams[0]?.endAge ?? answers.endAge) })} format={(value) => `Age ${value}`} quickValues={[answers.retirementAge, 65, 70]} />
            </div> : null}
          </div>
          <div className="education-callout"><CircleHelp size={19} /><p>A possible inheritance can make a result look stronger without being dependable. Mark it “Possible” and compare the result again with the event switched off.</p></div>
        </QuestionStep>
      ) : null}

      {step === 7 ? (
        <QuestionStep eyebrow="Optional refinement" title="Would you like to adjust the planning assumptions?" intro="Most people can keep the starting assumptions. Adjust them only if you understand what each rate changes.">
          <div className="quiz-choice-grid quiz-choice-grid--two">
            <ChoiceCard title="Keep the starting assumptions" description={`Inflation ${answers.retirementSpendingInflationRate}% · investments ${answers.preRetirementInvestmentReturnRate}% before retirement.`} selected={!answers.refineAssumptions} onClick={() => update("refineAssumptions", false)} />
            <ChoiceCard title="Let me refine them" description="Explore rates and the projection horizon without changing the calculation method." selected={answers.refineAssumptions} onClick={() => update("refineAssumptions", true)} />
          </div>
          {answers.refineAssumptions ? <div className="quiz-stack quiz-subsection advanced-quiz-panel">
            <SliderQuestion label="Projection end age" helper="Tests how long the scenario should continue." value={answers.endAge} min={Math.max(answers.retirementAge + 1, 80)} max={105} step={1} onChange={(value) => update("endAge", value)} format={(value) => `Age ${value}`} quickValues={[90, 95, 100]} />
            <SliderQuestion label="Retirement spending inflation" helper="How quickly the same lifestyle may cost more over time." value={answers.retirementSpendingInflationRate} min={0} max={5} step={0.1} onChange={(value) => update("retirementSpendingInflationRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[2, 2.5, 3]} />
            <SliderQuestion label="Cash savings return" helper="Annual return assumed for cash savings." value={answers.cashInterestRate} min={0} max={5} step={0.1} onChange={(value) => update("cashInterestRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[0.5, 1, 2]} />
            <SliderQuestion label="Investment return before retirement" helper="A planning assumption, not a guaranteed return." value={answers.preRetirementInvestmentReturnRate} min={0} max={10} step={0.5} onChange={(value) => update("preRetirementInvestmentReturnRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[3, 5, 7]} />
            <SliderQuestion label="Investment return during retirement" helper="Kept separate because retirement portfolios and withdrawals may behave differently." value={answers.retirementReturnRate} min={0} max={8} step={0.5} onChange={(value) => update("retirementReturnRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[1, 3, 5]} />
            <SliderQuestion label="Annual contribution increase" helper="How much regular cash and investment contributions rise each year." value={answers.annualContributionIncreaseRate} min={0} max={8} step={0.5} onChange={(value) => update("annualContributionIncreaseRate", value)} format={(value) => `${value.toFixed(1)}%`} quickValues={[0, 2, 3]} />
          </div> : <div className="education-callout"><CircleHelp size={19} /><p>The assumptions remain visible on the result and can be changed later. Keeping a default is still an active, reviewable choice.</p></div>}
        </QuestionStep>
      ) : null}

      {step === 8 ? (
        <QuestionStep eyebrow="Review" title="Here is the retirement picture we’ll test." intro="These are planning assumptions, not guaranteed outcomes. You can change them from the detailed editor after seeing the result.">
          <div className="review-grid">
            <article>
              <span>Timeline</span>
              <strong>Age {answers.currentAge} → {answers.retirementAge}</strong>
              <small>Projection runs to age {answers.endAge}</small>
            </article>
            <article>
              <span>Retirement lifestyle</span>
              <strong>{formatCurrency(answers.monthlySpendingToday)}/month today</strong>
              <small>{formatCurrency(projectedMonthlySpending)}/month estimated at retirement</small>
            </article>
            <article>
              <span>Starting resources</span>
              <strong>{formatCurrency(answers.currentCashSavings + answers.currentInvestments)}</strong>
              <small>{formatCurrency(answers.currentCashSavings)} cash · {formatCurrency(answers.currentInvestments)} invested</small>
            </article>
            <article>
              <span>Monthly contributions</span>
              <strong>{formatCurrency(answers.monthlyCashContribution + answers.monthlyInvestmentContribution)}</strong>
              <small>{formatCurrency(answers.monthlyCashContribution)} cash · {formatCurrency(answers.monthlyInvestmentContribution)} invested</small>
            </article>
            <article><span>CPF & CPF LIFE</span><strong>{answers.includeCpf ? "Included" : "Excluded by choice"}</strong><small>{answers.includeCpf ? `${formatCurrency(answers.cpfOa + answers.cpfSa + answers.cpfMa + answers.cpfRa)} current CPF · payout from age ${answers.cpfLifeStartAge}` : "No CPF balances, contributions or payouts counted"}</small></article>
            <article><span>Events and other income</span><strong>{answers.includeOneTimeEvents ? "1 event included" : "No event"} · {answers.includeOtherIncome ? "1 income included" : "No extra income"}</strong><small>{answers.oneTimeEvents[0]?.certainty === "possible" ? "Possible event is included—compare without it later" : "Only selected items affect the projection"}</small></article>
            <article><span>Planning assumptions</span><strong>{answers.retirementSpendingInflationRate}% inflation · {answers.preRetirementInvestmentReturnRate}% investment return</strong><small>{answers.refineAssumptions ? "Refined during the quiz" : "Starting assumptions retained"}</small></article>
          </div>
          <div className="assumption-note">
            <Sparkles size={20} />
            <p>{answers.includeCpf ? "CPF balances, future contributions and CPF LIFE are included in this first result." : "CPF was excluded by choice and can be added later in Edit assumptions."} SRS remains optional, while events and other income can be switched off for comparison.</p>
          </div>
        </QuestionStep>
      ) : null}

      <div className="quiz-navigation">
        <button className="secondary-action" type="button" onClick={back}><ArrowLeft size={18} /> Back</button>
        <button className="primary-action" type="button" disabled={!canContinue} onClick={next}>
          {step === stepLabels.length - 1 ? "Build my projection" : "Continue"} <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
}
