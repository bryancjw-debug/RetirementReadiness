import { useEffect, useRef, useState } from "react";

export function QuizProgress({ detail, steps, currentStep, onNavigate }: { detail: string; steps: string[]; currentStep: number; onNavigate: (step: number) => void }) {
  const furthest = useRef(currentStep);
  const [expanded, setExpanded] = useState(() => window.matchMedia("(min-width: 1001px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1001px)");
    const sync = () => setExpanded(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && expanded && window.innerWidth <= 1000) { setExpanded(false); document.querySelector<HTMLElement>(".mobile-section-action")?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [expanded]);
  furthest.current = Math.max(furthest.current, currentStep);
  return <nav className="quiz-progress" aria-label="Plan progress">
    <div className="quiz-progress__top"><span>Section {currentStep + 1} of {steps.length}</span><strong>{detail}</strong></div>
    <details id="quiz-sections-menu" className="section-menu" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>Plan sections</summary><ol>{steps.map((label, index) => <li key={label}><button type="button" disabled={index > furthest.current} aria-current={index === currentStep ? "step" : undefined} onClick={() => { onNavigate(index); if (window.innerWidth <= 1000) setExpanded(false); }}><span>{index + 1}</span>{label}</button></li>)}</ol></details>
  </nav>;
}
