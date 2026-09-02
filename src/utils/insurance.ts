import type { InsuranceEstimate, RetirementInputs } from "../types";

export const insuranceDefaults: InsuranceEstimate = {
  enabled: false, hospitalCover: "medishield", privatePremiumAnnual: 600,
  premiumGrowthRate: 3, careShield: false, careShieldPremiumAnnual: 400,
  careShieldJoinAge: 30, careShieldGrowthRate: 4, supplement: false,
  supplementPremiumAnnual: 600, supplementEndAge: 100
};

const positive = (value: number, fallback = 0) => Number.isFinite(value) ? Math.max(0, value) : fallback;

export function normalizeInsurance(value?: InsuranceEstimate): InsuranceEstimate {
  const v = { ...insuranceDefaults, ...value };
  return {
    ...v, enabled: Boolean(v.enabled), careShield: Boolean(v.careShield), supplement: Boolean(v.supplement),
    hospitalCover: ["none", "medishield", "integrated"].includes(v.hospitalCover) ? v.hospitalCover : "medishield",
    privatePremiumAnnual: positive(v.privatePremiumAnnual),
    premiumGrowthRate: Math.min(20, positive(v.premiumGrowthRate, 3)),
    careShieldPremiumAnnual: positive(v.careShieldPremiumAnnual),
    careShieldJoinAge: Math.min(100, Math.max(30, Math.floor(positive(v.careShieldJoinAge, 30)))),
    careShieldGrowthRate: Math.min(20, positive(v.careShieldGrowthRate, 4)),
    supplementPremiumAnnual: positive(v.supplementPremiumAnnual),
    supplementEndAge: Math.min(120, Math.floor(positive(v.supplementEndAge, 100)))
  };
}

// MOH premium schedule, policy renewals from 1 April 2025; before subsidies,
// including GST. Bands use age NEXT birthday, not attained age.
export function medishieldPremium(age: number) {
  const bands = [[20, 200], [30, 295], [40, 503], [50, 637], [60, 903],
    [65, 1131], [70, 1326], [73, 1643], [75, 1816], [78, 2027],
    [80, 2187], [83, 2303], [85, 2616], [88, 2785], [90, 2785], [Infinity, 2826]];
  return bands.find(([upper]) => age + 1 <= upper)![1];
}

export function insuranceForYear(inputs: RetirementInputs, age: number) {
  const empty = { total: 0, medisaveEligible: 0, cashRequired: 0 };
  if (!inputs.includeCpf) return empty;
  const settings = normalizeInsurance(inputs.insuranceEstimate);
  if (!settings.enabled) {
    const legacy = positive(inputs.cpfMaMedicalPremiumAnnual);
    return { total: legacy, medisaveEligible: legacy, cashRequired: 0 };
  }
  const years = Math.max(0, age - inputs.currentAge);
  const repricing = (1 + settings.premiumGrowthRate / 100) ** years;
  const msl = settings.hospitalCover === "none" ? 0 : medishieldPremium(age) * repricing;
  // An age-band proxy, not an insurer quotation. User's current private premium
  // is scaled with the national age curve plus the stated repricing assumption.
  const privatePremium = settings.hospitalCover === "integrated"
    ? settings.privatePremiumAnnual * medishieldPremium(age) / medishieldPremium(inputs.currentAge) * repricing : 0;
  const awl = age + 1 <= 40 ? 300 : age + 1 <= 70 ? 600 : 900;
  const careEndAge = Math.max(67, settings.careShieldJoinAge + 9);
  const care = settings.careShield && age >= settings.careShieldJoinAge && age <= careEndAge
    ? settings.careShieldPremiumAnnual * (1 + settings.careShieldGrowthRate / 100) **
      Math.max(0, Math.min(age, 67) - Math.min(Math.max(inputs.currentAge, settings.careShieldJoinAge), 67)) : 0;
  const supplement = settings.supplement && age <= settings.supplementEndAge ? settings.supplementPremiumAnnual : 0;
  const total = msl + privatePremium + care + supplement;
  const medisaveEligible = msl + Math.min(privatePremium, awl) + care + Math.min(supplement, 600);
  return { total, medisaveEligible, cashRequired: Math.max(0, total - medisaveEligible) };
}
