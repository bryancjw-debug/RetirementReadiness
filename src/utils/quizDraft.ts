const prefix = "retirement-readiness:quiz:v1:";
export interface SavedQuiz<T> { version: 1; savedAt: string; data: T }

// Storage is untrusted, including on a shared GitHub Pages origin.
export function readQuizDraft<T>(storage: Pick<Storage, "getItem">, key: string, validate: (data: unknown) => data is T): SavedQuiz<T> | null {
  try {
    const raw = storage.getItem(prefix + key);
    if (!raw || raw.length > 150_000) return null;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || typeof saved.savedAt !== "string" || !Number.isFinite(Date.parse(saved.savedAt)) || !validate(saved.data)) return null;
    return saved;
  } catch { return null; }
}
export function writeQuizDraft<T>(storage: Pick<Storage, "setItem">, key: string, data: T): boolean {
  try { storage.setItem(prefix + key, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), data })); return true; } catch { return false; }
}
export function removeQuizDraft(storage: Pick<Storage, "removeItem">, key: string): boolean {
  try { storage.removeItem(prefix + key); return true; } catch { return false; }
}

const optionalShapes: Record<string, unknown> = {
  spendingProfile: { adults: 1, dependants: [{ id: "", label: "", currentAge: 0, supportUntilAge: 0, monthlyAmountToday: 0 }] },
  otherTaxableIncome: { annualAmount: 0, startAge: 0, endAge: 0, growthRate: 0 },
  srsContributionStartAge: 0,
  srsAssetCategory: "",
  retirementTaxResidency: "",
  investmentMix: [{ label: "", amount: 0, returnRate: 0, incomeYield: 0 }],
  retirementInvestmentMix: [{ label: "", amount: 0, returnRate: 0, incomeYield: 0 }],
  retirementTopUp: { enabled: false, annualAmount: 0, startAge: 30, endAge: 65 },
  insuranceEstimate: { enabled: false, hospitalCover: "none", privatePremiumAnnual: 0, premiumGrowthRate: 0, careShield: false, careShieldPremiumAnnual: 0, careShieldJoinAge: 30, careShieldGrowthRate: 0, supplement: false, supplementPremiumAnnual: 0, supplementEndAge: 100 },
  oneTimeEvents: [{ id: "", label: "", age: 30, amount: 0, direction: "inflow", certainty: "expected" }],
  customIncomeStreams: [{ id: "", label: "", startAge: 65, endAge: 100, amount: 0, frequency: "monthly", growthMode: "fixed", annualIncreaseRate: 0 }]
};

export function matchesQuizShape(value: unknown, template: unknown): boolean {
  if (template === undefined || template === null) return value === null || value === undefined || typeof value === "string";
  if (typeof template === "number") return typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 1e12;
  if (typeof template !== "object") return typeof value === typeof template;
  if (Array.isArray(template)) return Array.isArray(value) && value.length < 100 && (!template.length || value.every((item) => matchesQuizShape(item, template[0])));
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.entries(template).every(([key, item]) => {
    const next = (value as Record<string, unknown>)[key];
    if (["spendingProfile", "srsPlanning", "otherTaxableIncome", "srsContributionStartAge", "srsAssetCategory", "retirementTaxResidency"].includes(key) && next === undefined) return true;
    if (key === "srsPlanning" && next !== undefined) {
      if (!next || typeof next !== "object" || Array.isArray(next)) return false;
      return Object.entries(next).every(([field, value]) => {
        if (field === "otherTaxableIncome") return value === undefined || matchesQuizShape(value, optionalShapes.otherTaxableIncome);
        if (field === "includeSrs") return typeof value === "boolean";
        if (["srsResidency", "srsFirstContributionPeriod", "srsWithdrawalStrategy", "srsAssetCategory", "retirementTaxResidency"].includes(field)) return typeof value === "string";
        return ["srsCurrentBalance", "srsAnnualContribution", "srsContributionStartAge", "srsContributionEndAge", "srsReturnRate", "srsFirstWithdrawalAge"].includes(field) && matchesQuizShape(value, 0);
      });
    }
    if (key in optionalShapes && next !== undefined && next !== null) return matchesQuizShape(next, optionalShapes[key]);
    return matchesQuizShape(next, item);
  });
}
