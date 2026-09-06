import { describe, expect, it } from "vitest";
import { matchesQuizShape, readQuizDraft, removeQuizDraft, writeQuizDraft } from "./quizDraft";

describe("local quiz drafts", () => {
  const createStore = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; };
  const validate = (v: unknown): v is { age: number } => matchesQuizShape(v, { age: 30 });
  it("round trips a draft and isolates individual and couple plans", () => { const s = createStore(); expect(writeQuizDraft(s, "individual", { age: 62 })).toBe(true); expect(readQuizDraft(s, "individual", validate)?.data.age).toBe(62); expect(readQuizDraft(s, "couple", validate)).toBeNull(); expect(removeQuizDraft(s, "individual")).toBe(true); expect(readQuizDraft(s, "individual", validate)).toBeNull(); });
  it("rejects malformed, old and incomplete data", () => { const s = createStore(); for (const raw of ["{", '{"version":2}', '{"version":1,"savedAt":"2026-09-03","data":{"age":"62"}}']) { s.setItem("retirement-readiness:quiz:v1:individual", raw); expect(readQuizDraft(s, "individual", validate)).toBeNull(); } });
  it("handles unavailable storage without breaking the quiz", () => { const s = { getItem: () => { throw Error(); }, setItem: () => { throw Error(); }, removeItem: () => { throw Error(); } }; expect(readQuizDraft(s, "individual", validate)).toBeNull(); expect(writeQuizDraft(s, "individual", {})).toBe(false); expect(removeQuizDraft(s, "individual")).toBe(false); });
  it("validates optional financial fields even when a fresh plan has none", () => {
    expect(matchesQuizShape({ retirementTopUp: "bad", oneTimeEvents: [] }, { retirementTopUp: undefined, oneTimeEvents: [] })).toBe(false);
    expect(matchesQuizShape({ oneTimeEvents: [{ label: {} }] }, { oneTimeEvents: [] })).toBe(false);
    expect(matchesQuizShape({ retirementTopUp: { enabled: true, annualAmount: 8000, startAge: 40, endAge: 64 } }, { retirementTopUp: undefined })).toBe(true);
  });
});
