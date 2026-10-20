import { ArrowRight, Check, Gauge } from "lucide-react";

export function RetirementWelcome({ onStart, onPlanTogether, onExploreSample, resume = false }: {
  onStart: () => void;
  onPlanTogether?: () => void;
  onExploreSample?: () => void;
  resume?: boolean;
}) {
  return <section className="onboarding-welcome" aria-labelledby="welcome-title">
    <div className="onboarding-welcome__copy">
      <p className="eyebrow">Your guided Singapore retirement checkup</p>
      <h2 id="welcome-title" tabIndex={-1}>See how ready you are for the retirement you want.</h2>
      <p>Answer one simple question at a time. We will bring your savings, investments and CPF together into a retirement picture you can understand and adjust.</p>
      <div className="welcome-points"><span><Check size={17} /> At your own pace</span><span><Check size={17} /> Estimates are enough</span><span><Check size={17} /> No product recommendations</span></div>
      <div className="welcome-actions">
        <button className="primary-action welcome-primary-action" type="button" onClick={onStart}>{resume ? "Continue current plan" : "Start my checkup"} <ArrowRight size={18} /></button>
        {onPlanTogether ? <button className="secondary-action plan-together-action" type="button" onClick={onPlanTogether}>Plan together <ArrowRight size={18} /></button> : null}
        {onExploreSample ? <button className="text-action" type="button" onClick={onExploreSample}>Explore a sample instead</button> : null}
      </div>
      {resume ? <p className="small">Your current answers and results are kept in this open session.</p> : null}
    </div>
    <aside className="welcome-preview" aria-label="Example retirement result preview">
      <div className="welcome-preview__top"><span>Example result</span><strong>Retirement outlook</strong></div>
      <div className="welcome-readiness-preview"><div className="welcome-readiness-ring" aria-hidden="true"><span>82%</span></div><div><small>Estimated need funded</small><strong>Your answer, at a glance</strong><p>See what is on track and what could close the gap.</p></div></div>
      <div className="welcome-wealth-preview" aria-hidden="true">{[24,31,39,48,59,67,76,72,64,57,51].map((height,index)=><i key={index} style={{height:`${height}%`}} />)}</div>
      <div className="welcome-preview__facts"><span><Gauge size={17} /> CPF-aware projection</span><span>Age-by-age view</span></div>
      <small className="welcome-preview__note">Illustrative preview. Your figures and assumptions replace these.</small>
    </aside>
    <div className="welcome-confidence" aria-label="Planning experience details"><span><Check size={16} /> Clear, guided questions</span><span><Check size={16} /> Plan alone or together</span><span><Check size={16} /> Saved only when you choose</span></div>
  </section>;
}
