import { useEffect, useState } from "react";
import { readQuizDraft, removeQuizDraft, writeQuizDraft, type SavedQuiz } from "../utils/quizDraft";

export function QuizDraftControls<T>({ storageKey, value, validate, onResume, active = true }: {
  storageKey: string; value: T; validate: (data: unknown) => data is T; onResume: (data: T) => void; active?: boolean;
}) {
  const [saved, setSaved] = useState<SavedQuiz<T> | null>(() => { try { return readQuizDraft(localStorage, storageKey, validate); } catch { return null; } });
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    if (!remember || !active) return;
    try { const ok = writeQuizDraft(localStorage, storageKey, value); setStatus(ok ? "Progress saved on this device." : "Could not save. Keep this tab open to retain your answers."); if (ok) setSaved({ version: 1, savedAt: new Date().toISOString(), data: value }); }
    catch { setStatus("Saving is unavailable. Keep this tab open to retain your answers."); }
  }, [remember, active, storageKey, value]);
  function clear() {
    setRemember(false);
    try { const ok = removeQuizDraft(localStorage, storageKey); setStatus(ok ? "Saved copy cleared. Your open plan is unchanged." : "Could not clear the saved copy. Check browser storage settings."); if (ok) setSaved(null); }
    catch { setStatus("Could not access browser storage."); }
    setConfirmClear(false);
  }
  return <aside className="quiz-draft" aria-label="Save your progress">
    {saved && !remember ? <div className="draft-resume"><span>Saved {new Date(saved.savedAt).toLocaleDateString()}</span><button type="button" className="secondary-action" onClick={() => { onResume(saved.data); setRemember(true); }}>Resume your plan</button></div> : null}
    <label><input type="checkbox" checked={remember} onChange={(event) => { setRemember(event.target.checked); if (!event.target.checked) setStatus("Saving paused. The existing saved copy is retained until you clear it."); }} /> Save progress on this device</label>
    <small>Optional. Financial answers are stored in this browser, not an account. Avoid this on shared devices.</small>
    <span className="draft-status" role="status">{status}</span>
    {saved || remember || status.startsWith("Progress saved") ? <button className="text-action" type="button" onClick={() => setConfirmClear(true)}>Clear saved answers</button> : null}
    {confirmClear ? <div className="draft-confirm" role="group" aria-label="Confirm clearing saved answers"><p>Remove this device's saved copy? Your open plan will not change.</p><button type="button" className="secondary-action" onClick={() => setConfirmClear(false)}>Cancel</button><button type="button" className="secondary-action" onClick={clear}>Clear saved copy</button></div> : null}
  </aside>;
}
