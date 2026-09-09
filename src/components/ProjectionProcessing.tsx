import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Sparkles, Users } from "lucide-react";

interface ProjectionProcessingProps {
  duration: number;
  household?: boolean;
  onComplete: () => void;
}

const individualSteps = [
  "Checking your retirement timeline",
  "Projecting CPF, SRS and other resources",
  "Testing retirement income and drawdowns",
  "Preparing your personalised insights"
];

const householdSteps = [
  "Checking both retirement timelines",
  "Projecting each CPF and SRS journey",
  "Combining shared resources and spending",
  "Preparing your household insights"
];

export function ProjectionProcessing({ duration, household = false, onComplete }: ProjectionProcessingProps) {
  const [stage, setStage] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const steps = household ? householdSteps : individualSteps;

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    setStage(0);
    const stageTimers = steps.slice(1).map((_, index) => window.setTimeout(
      () => setStage(index + 1),
      Math.round(duration * (index + 1) / steps.length)
    ));
    const completionTimer = window.setTimeout(() => onCompleteRef.current(), duration);
    return () => {
      stageTimers.forEach(window.clearTimeout);
      window.clearTimeout(completionTimer);
    };
  }, [duration, steps.length]);

  const Icon = household ? Users : Sparkles;
  return <section className="projection-processing" aria-live="polite" aria-label="Building your retirement projection">
    <div className="processing-orbit" aria-hidden="true"><Icon size={24} /></div>
    <p className="eyebrow">{household ? "Building your household retirement picture" : "Building your retirement picture"}</p>
    <h2>{household ? "Aligning both journeys on one clear timeline…" : "Turning your answers into a year-by-year projection…"}</h2>
    <div className="processing-progress" aria-hidden="true"><i style={{ animationDuration: `${duration}ms` }} /></div>
    <div className="processing-steps">
      {steps.map((label, index) => <span className={index < stage ? "is-complete" : index === stage ? "is-active" : ""} key={label}>
        {index < stage ? <Check size={17} /> : <LoaderCircle size={17} />}
        {label}
      </span>)}
    </div>
  </section>;
}
