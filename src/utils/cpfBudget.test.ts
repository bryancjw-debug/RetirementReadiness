import { describe, expect, it } from "vitest";
import { applicableBhs, defaultInputs, projectRetirement, cpfContributionForYear } from "./projection";
import { additionalInsuranceCashExpense, insuranceDefaults, insuranceForYear, normalizeInsurance, medishieldPremium } from "./insurance";
import { createDefaultHouseholdPlan } from "../household";
import { projectHousehold } from "./householdProjection";

const inputs = { ...defaultInputs, currentAge: 40, retirementAge: 41, endAge: 43,
  includeCpf: true, cpfMa: 30_000, cpfWorkStatus: "Not contributing" as const,
  currentCashSavings: 50_000, currentInvestments: 0, cashSavingsContribution: 0,
  investmentContribution: 0, cashInterestRate: 0, retirementSpendingAnnual: 0,
  insuranceEstimate: { ...insuranceDefaults, enabled: true, hospitalCover: "none" as const,
    supplement: true, supplementPremiumAnnual: 1_200, cashPremiumsInRetirementSpending: true } };

describe("BHS cohort and insurance budget safeguards", () => {
  it("uses 2026 BHS and freezes the age-65 cohort including older users", () => {
    expect(applicableBhs(30)).toBe(79_000);
    expect(applicableBhs(64, 65)).toBe(82_600);
    expect(applicableBhs(64, 66)).toBe(82_600);
    expect(applicableBhs(65, 90)).toBe(79_000);
    expect(applicableBhs(66)).toBe(75_500);
    expect(applicableBhs(70, 90)).toBe(63_000);
  });
  it.each([[39, 300], [40, 600], [69, 600], [70, 900]])("uses the full IP allowance at attained age %s", (age, awl) => {
    const year = insuranceForYear({ ...inputs, currentAge: age, insuranceEstimate: {
      ...insuranceDefaults, enabled: true, hospitalCover: "integrated", premiumGrowthRate: 0 } }, age);
    expect(year.medisaveEligible).toBe(medishieldPremium(age) + awl);
    expect(year.cashRequired).toBe(0);
  });
  it("preserves legacy actual premiums and additive budget choices", () => {
    const { privatePremiumMode, cashPremiumsInSavings, cashPremiumsInRetirementSpending, ...legacy } = insuranceDefaults;
    expect(normalizeInsurance(legacy).privatePremiumMode).toBe("actual");
    expect(normalizeInsurance(legacy).cashPremiumsInSavings).toBe(false);
    expect(normalizeInsurance(undefined).cashPremiumsInSavings).toBe(true);
    expect(normalizeInsurance(undefined).cashPremiumsInRetirementSpending).toBe(true);
    expect(normalizeInsurance({ ...insuranceDefaults, cashPremiumsInRetirementSpending: false }).cashPremiumsInRetirementSpending).toBe(false);
  });
  it("does not deduct budgeted cash premiums twice before or after retirement", () => {
    const rows = projectRetirement(inputs).rows;
    for (const row of rows) {
      expect(row.insuranceCashPremium).toBe(600);
      expect(row.insuranceCashExpense).toBe(0);
      expect(row.endingCashSavings).toBe(50_000);
    }
  });
  it("adds unbudgeted premiums and unexpected MediSave exhaustion", () => {
    const unbudgeted = { ...inputs, insuranceEstimate: { ...inputs.insuranceEstimate,
      cashPremiumsInSavings: false, cashPremiumsInRetirementSpending: false } };
    expect(additionalInsuranceCashExpense(unbudgeted, 40, 600)).toBe(600);
    expect(additionalInsuranceCashExpense(unbudgeted, 41, 600)).toBe(600);
    expect(additionalInsuranceCashExpense(inputs, 40, 100)).toBe(500);
    expect(projectRetirement({ ...inputs, cpfMa: 100 }).rows[0].insuranceCashExpense).toBe(500);
  });
  it("keeps household budget treatment separate for each member", () => {
    const plan = createDefaultHouseholdPlan();
    plan.currentCashSavings = 50_000;
    plan.people = plan.people.map((person, index) => ({ ...person, inputs: { ...inputs,
      insuranceEstimate: { ...inputs.insuranceEstimate, cashPremiumsInSavings: index === 0 } } })) as typeof plan.people;
    const row = projectHousehold(plan).rows[0];
    expect(row.people.map(p => p.insuranceCashExpense)).toEqual([0, 600]);
    expect(row.householdSpending).toBe(600);
  });
  it("estimates the employee and OA amounts used by the salary warning and housing preview", () => {
    const cpf = cpfContributionForYear({ ...defaultInputs, includeCpf: true, currentAge: 30,
      retirementAge: 65, cpfWorkStatus: "Employed", grossMonthlyIncome: 5_000 }, 30);
    expect(cpf.employee / 12).toBe(1_000);
    expect(cpf.oa / 12).toBeCloseTo(1_150, 0);
  });
});
