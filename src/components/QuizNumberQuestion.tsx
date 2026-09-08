import { useId, useState, type CSSProperties } from "react";

export function QuizNumberQuestion({ label, helper, value, min, max, step, onChange, format = String, category }: {
  label: string; helper: string; value: number; min: number; max: number; step: number;
  onChange: (value: number) => void; format?: (value: number) => string; quickValues?: number[];
  category?: "cash" | "investments" | "cpf";
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const wholeYears = step === 1 && max <= 120;
  const normalize = (n: number) => Math.max(min, Math.min(max, wholeYears ? Math.round(n) : n));
  const progress = Math.min(100, Math.max(0, (value - min) / Math.max(1, max - min) * 100));
  const invalid = draft !== null && (draft.trim() === "" || !Number.isFinite(Number(draft)) || Number(draft) < min || Number(draft) > max);
  return <div className="quiz-slider-block" data-category={category}>
    <div className="quiz-slider-block__header">
      <div><label htmlFor={id}>{label}</label><p id={`${id}-help`}>{helper}</p></div>
      <div className="quiz-number-answer">
        <input id={id} type="number" inputMode={step < 1 ? "decimal" : "numeric"} min={min} max={max} step="any"
          aria-describedby={`${id}-help ${id}-value`} aria-invalid={invalid}
          value={draft ?? value}
          onChange={(event) => { const raw = event.target.value; setDraft(raw); const n = Number(raw); if (raw !== "" && Number.isFinite(n) && n >= min && n <= max && (!wholeYears || Number.isInteger(n))) onChange(n); }}
          onBlur={() => { if (draft !== null && draft !== "" && Number.isFinite(Number(draft))) onChange(normalize(Number(draft))); setDraft(null); }} />
        <span id={`${id}-value`}>{format(value)}</span>
      </div>
    </div>
    <input className="quiz-range" type="range" aria-label={`${label} slider`} aria-valuetext={format(value)} min={min} max={max} step={step} value={value}
      style={{ "--range-progress": `${progress}%` } as CSSProperties} onChange={(event) => { setDraft(null); onChange(Number(event.target.value)); }} />
    <div className="quiz-range-labels" aria-hidden="true"><span>{format(min)}</span><span>{format(max)}</span></div>
  </div>;
}
