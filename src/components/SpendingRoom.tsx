import { useId, useMemo, useState } from "react";
import { formatCurrency } from "../utils/formatters";
import { evaluateRoom, roomPlanFacts, spendingRoom, type RoomPlan, type RoomSettings } from "../utils/spendingRoom";
import "./spendingRoom.css";

function NumberInput({ label, value, max, onChange }: {
  label: string; value: number; max: number; onChange: (value: number) => void;
}) {
  return <label>{label}<input type="number" min={0} max={max} step={1} value={value}
    onChange={event => onChange(Math.round(Math.max(0, Math.min(max, Number(event.target.value)))))}/></label>;
}

export function SpendingRoom({ plan, incomplete = false }: { plan: RoomPlan; incomplete?: boolean }) {
  const id = useId();
  const facts = roomPlanFacts(plan);
  const [view, setView] = useState<"retirement" | "before">("retirement");
  const [reserve, setReserve] = useState<number | null>(null);
  const [careMonthly, setCareMonthly] = useState(1000);
  const [careStartAge, setCareStartAge] = useState(Math.max(85, facts.referenceAge));
  const [careYears, setCareYears] = useState(5);
  const [lifestyleReduction, setLifestyleReduction] = useState(0);
  const [lifestyleStartAge, setLifestyleStartAge] = useState(Math.max(75, facts.referenceAge));
  const [compare, setCompare] = useState(false);
  const [extraMonthly, setExtraMonthly] = useState(0);
  const [spendNow, setSpendNow] = useState(0);
  const [cautious, setCautious] = useState(true);
  const [exploreLifestyle, setExploreLifestyle] = useState(false);
  const settings: RoomSettings = {
    reserve: reserve ?? Math.round(facts.budget * 12), careMonthly, careStartAge, careYears,
    lifestyleReduction, lifestyleStartAge
  };
  const before = view === "before";
  const releasedSavings = Math.min(spendNow, facts.contributions);
  const useful = !before || facts.contributions > 0;
  const eligible = !incomplete && facts.budget > 0;
  const monthly = (value: number) => `${formatCurrency(value)}/mo`;
  const result = useMemo(() => {
    if (!eligible || !useful) return null;
    return {
      cautious: spendingRoom(plan, settings, true, before),
      base: spendingRoom(plan, settings, false, before)
    };
  }, [plan, eligible, useful, before, settings.reserve, careMonthly, careStartAge, careYears]);
  const combined = eligible && compare
    ? evaluateRoom(plan, settings, cautious, extraMonthly, releasedSavings, exploreLifestyle) : null;

  return <section className="spending-room" aria-labelledby={id}>
    <header><p className="eyebrow">Explore the model</p><h3 id={id}>Room to spend</h3></header>
    {incomplete || facts.budget <= 0 ? <p>Add missing balances and a retirement budget before estimating extra spending room.</p> : <>
      <div className="spending-room__choices" role="group" aria-label="Spending timing">
        <button type="button" aria-pressed={!before} onClick={() => setView("retirement")}>In retirement</button>
        <button type="button" aria-pressed={before} onClick={() => setView("before")}>Before retirement</button>
      </div>
      {!useful ? <p>No planned monthly cash or investment contributions to reduce.</p> : result && <>
        <div className="spending-room__figures" aria-live="polite">
          <div><span>{before ? "Monthly savings you could redirect" : "Extra monthly retirement spending"}</span>
            <strong>{result.cautious.atLimit ? "At least " : ""}{monthly(result.cautious.amount)}</strong><small>Cautious scenario · today's SGD</small></div>
          <div><span>Base-case comparison</span><strong>{result.base.atLimit ? "At least " : ""}{monthly(result.base.amount)}</strong>
            <small>{result.base.baselinePasses ? "Same reserve, unchanged assumptions" : "Entered plan does not pass the reserve or funding check"}</small></div>
        </div>
        {!result.cautious.baselinePasses ? <p>Your base retirement budget is funded, but there is no extra room under this cautious scenario and reserve.</p>
          : !result.cautious.amount ? <p>Less than $10/month of additional room in this scenario.</p>
          : !before ? <p>Current budget: <strong>{monthly(facts.budget)}</strong> · With cautious headroom: <strong>{monthly(facts.budget + result.cautious.amount)}</strong> in today's dollars.</p> : null}
        {before ? <p>This reduces planned cash savings and ordinary investments proportionally until retirement, including their future increases. CPF and SRS contributions stay unchanged. It does not estimate spare salary or day-to-day affordability.</p> : null}
      </>}
      <p>Keep at least <strong>{formatCurrency(settings.reserve)}</strong> in cash and investments at each retirement year-end, in today's dollars. These estimates are not guarantees. The two headroom amounts are alternatives, not amounts to add together.</p>
      <details>
        <summary>Cautious assumptions and reserve</summary>
        <p>Illustrative stress: five extra years, investment returns 1 percentage point lower before and during retirement, and spending inflation 1 percentage point higher. Income assumptions stay unchanged. Not a probability estimate or a market crash simulation.</p>
        <div className="spending-room__inputs">
          <NumberInput label="Reserve in today's SGD" value={settings.reserve} max={100000000} onChange={setReserve}/>
          <NumberInput label="Extra net care cost per month (today's SGD)" value={careMonthly} max={100000} onChange={setCareMonthly}/>
          <NumberInput label={`Care starts at age${"household" in plan ? " of younger partner" : ""}`} value={careStartAge} max={150} onChange={setCareStartAge}/>
          <NumberInput label="Years of extra care costs" value={careYears} max={50} onChange={setCareYears}/>
        </div>
        <p>Reserve defaults to 12 months of your entered budget. Care defaults to an illustrative $1,000/month for five years, not a quote. Count only additional out-of-pocket costs not already in your budget or covered elsewhere. Care applies during retirement and rises with scenario inflation. No automatic spending cuts at older ages. <a href="https://www.cpf.gov.sg/member/infohub/reports-and-statistics/retirement-and-health-study" target="_blank" rel="noreferrer">CPF research on spending in later life</a></p>
      </details>
      <details onToggle={event => setCompare(event.currentTarget.open)}>
        <summary>Try both changes together</summary>
        <div className="spending-room__inputs">
          <NumberInput label="Spend more in retirement per month (today's SGD)" value={extraMonthly} max={100000} onChange={setExtraMonthly}/>
          {facts.contributions > 0 ? <NumberInput label="Reduce planned savings per month" value={releasedSavings} max={facts.contributions} onChange={setSpendNow}/> : null}
          <label className="spending-room__check"><input type="checkbox" checked={cautious} onChange={event => setCautious(event.target.checked)}/> Use cautious assumptions</label>
          <label className="spending-room__check"><input type="checkbox" checked={exploreLifestyle} onChange={event => setExploreLifestyle(event.target.checked)}/> Try lower lifestyle spending later</label>
          {exploreLifestyle && <>
            <NumberInput label="Monthly lifestyle reduction (today's SGD)" value={lifestyleReduction} max={facts.budget} onChange={setLifestyleReduction}/>
            <NumberInput label={`Reduce lifestyle spending from age${"household" in plan ? " of younger partner" : ""}`} value={lifestyleStartAge} max={150} onChange={setLifestyleStartAge}/>
          </>}
        </div>
        {combined && <p role="status"><strong>{combined.passes ? "Every modelled year is funded and the reserve is retained." : combined.funded ? "Spending is funded, but the reserve is not retained." : "This combination leaves a projected shortfall."}</strong> Lowest retirement year-end cash and investments: {formatCurrency(combined.minimumReserve)} in today's dollars.</p>}
        <p>Lifestyle reductions apply only here, not to either headline amount. Comparisons do not change the saved plan, charts or export.</p>
      </details>
    </>}
  </section>;
}
