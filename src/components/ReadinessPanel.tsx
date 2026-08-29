import { useState, type CSSProperties } from "react";
import { BadgeCheck, ChevronDown, ChevronUp, CircleAlert } from "lucide-react";
import type { RetirementInputs, RetirementProjection } from "../types";
import { formatCurrency } from "../utils/formatters";

function initiallyExpanded() {
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(max-width: 1120px)").matches;
}

export function ReadinessPanel({ projection, inputs }: { projection: RetirementProjection; inputs: RetirementInputs }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const ready = projection.summary.status === "ready";
  return (
    <aside className={`readiness-panel ${ready ? "is-ready" : "needs-work"} ${expanded ? "is-expanded" : "is-collapsed"}`}>
      <button
        className="readiness-panel__toggle"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span>
          {ready ? <BadgeCheck size={19} /> : <CircleAlert size={19} />}
          <b>{ready ? "Retirement requirement met" : "Projected shortfall"}</b>
        </span>
        <strong>{Math.round(projection.summary.readinessPercent)}%</strong>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded ? (
        <div className="readiness-panel__body">
          <div className="readiness-gauge" style={{ "--score": `${projection.summary.readinessPercent}%` } as CSSProperties}>
            <div><strong>{Math.round(projection.summary.readinessPercent)}%</strong><span>Ready</span></div>
          </div>
          <div className="readiness-panel__copy">
            <p className="eyebrow">RetirementReadiness</p>
            <h2>{ready ? "You look retirement ready." : "There is a projected gap."}</h2>
            <p>{projection.summary.headline}</p>
          </div>
          <div className="readiness-panel__stats">
            <div className={ready ? "stat-surplus" : "stat-shortfall"}>
              <span>{ready ? "Projected Surplus At End" : "Projected Shortfall"}</span>
              <strong>{formatCurrency(ready ? projection.summary.finalBalance : projection.summary.totalShortfall)}</strong>
            </div>
            <div className="stat-action"><span>Invest More Monthly</span><strong>{formatCurrency(projection.summary.extraMonthlyInvestmentRequired)}</strong></div>
            <div className={ready ? "stat-surplus" : "stat-warning"}>
              <span>Funds Last Until</span><strong>{ready ? `Through Age ${inputs.endAge}` : `Age ${projection.summary.runwayAge}`}</strong>
            </div>
            <div className="stat-neutral"><span>CPF LIFE Starts</span><strong>Age {inputs.cpfLifeStartAge}</strong></div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
