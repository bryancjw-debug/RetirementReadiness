import { describe, expect, it } from "vitest";
import { defaultInputs, projectRetirement, retirementTopUpForYear, createInitialCpfState, sanitizeInputs, retirementSumsForYear, applyMedisaveCap, cpfContributionForYear, routeRetirementAllocation } from "./projection";
import { insuranceDefaults, insuranceForYear, medishieldPremium } from "./insurance";
import { createInitialOnboardingAnswers, onboardingAnswersToRetirementInputs } from "../onboarding";
import { createDefaultHouseholdPlan } from "../household";
import { projectHousehold } from "./householdProjection";

const base = { ...defaultInputs, currentAge: 54, retirementAge: 65, endAge: 70,
  currentCashSavings: 100_000, currentInvestments: 0, cashSavingsContribution: 0,
  investmentContribution: 0, cashInterestRate: 0, retirementSpendingAnnual: 0,
  cpfOa: 0, cpfSa: 0, cpfMa: 0, cpfRa: 0 };

describe("retirement-only CPF top-ups", () => {
  it("allows self-employed voluntary contributions even when NTI is zero", () => {
    const contribution = cpfContributionForYear({ ...base, cpfWorkStatus: "Self-employed", grossMonthlyIncome: 0, selfEmployedNetTradeIncomeAnnual: 0, selfEmployedVoluntaryCpfAnnual: 6_000 }, 54);
    expect(contribution.total).toBe(6_000);
    expect(contribution.oa).toBeGreaterThan(0);
  });

  it("routes MA overflow beyond the under-55 FRS to OA", () => {
    const inputs = sanitizeInputs({ ...base, cpfSa: 219_400, cpfMa: 81_000 });
    const state = createInitialCpfState(inputs);
    expect(applyMedisaveCap(inputs, state, 54)).toBe(2_000);
    expect(state.sa).toBe(220_400);
    expect(state.oa).toBe(1_000);
    expect(state.ma).toBe(79_000);
  });

  it("uses cohort FRS for later contributions, not the chosen Enhanced target", () => {
    const inputs = sanitizeInputs({ ...base, currentAge: 55, cpfRetirementSum: "Enhanced", cpfRa: 220_400 });
    const state = createInitialCpfState(inputs);
    expect(routeRetirementAllocation(inputs, state, 55, 1_000).toOa).toBe(1_000);
    expect(state.ra).toBe(220_400);
  });

  it("uses post-LIFE retirement inflows for more income until cohort FRS is met", () => {
    const inputs = sanitizeInputs({ ...base, currentAge: 65, retirementAge: 70, cpfRa: 1_000 });
    const state = createInitialCpfState(inputs);
    state.lifeStarted = true; state.ra = 0; state.lifeBase = 1_000; state.lifeReserve = 1_000;
    expect(routeRetirementAllocation(inputs, state, 65, 500).toRa).toBe(500);
    expect(state.ra).toBe(0);
    expect(state.lifeBase).toBe(1_500);
    expect(state.lifeReserve).toBe(1_500);
  });
  it.each(["Employed", "Self-employed", "Not contributing"] as const)("funds SA then RA for %s without requiring employment", (cpfWorkStatus) => {
    const result = projectRetirement({ ...base, cpfWorkStatus,
      retirementTopUp: { enabled: true, annualAmount: 8_000, startAge: 54, endAge: 55 } });
    expect(result.rows[0].cpfRetirementTopUp).toBe(8_000);
    expect(result.rows[0].endingCashSavings).toBe(92_000);
    expect(result.rows[0].cpfSa).toBeGreaterThan(8_000);
    expect(result.rows[1].cpfSa).toBe(0);
    expect(result.rows[1].cpfRa).toBeGreaterThan(16_000);
    expect(result.rows[1].endingCashSavings).toBe(84_000);
    expect(result.rows[2].cpfRetirementTopUp).toBe(0);
  });

  it("does not cap a permitted cash top-up at the $8,000 tax relief amount or Annual Limit", () => {
    const result = projectRetirement({ ...base, retirementTopUp: { enabled: true, annualAmount: 50_000, startAge: 54, endAge: 54 } });
    expect(result.rows[0].cpfRetirementTopUp).toBe(50_000);
  });

  it("caps SA top-ups at FRS and reports the unfilled amount", () => {
    const result = projectRetirement({ ...base, cpfSa: 219_400, retirementTopUp: { enabled: true, annualAmount: 8_000, startAge: 54, endAge: 54 } });
    expect(result.rows[0].cpfRetirementTopUp).toBe(1_000);
    expect(result.rows[0].cpfRetirementTopUpUnfilled).toBe(7_000);
  });

  it("does not sell investments or create money when a top-up exceeds available cash", () => {
    const result = projectRetirement({ ...base, currentCashSavings: 500, currentInvestments: 100_000, retirementTopUp: { enabled: true, annualAmount: 8_000, startAge: 54, endAge: 54 } });
    expect(result.rows[0].cpfRetirementTopUp).toBe(500);
    expect(result.rows[0].cpfRetirementTopUpUnfilled).toBe(7_500);
    expect(result.rows[0].endingCashSavings).toBe(0);
    expect(result.rows[0].investmentWithdrawal).toBe(0);
  });

  it("keeps top-ups and attributed interest in RA even with a Basic target", () => {
    const inputs = { ...base, cpfRetirementSum: "Basic" as const, currentCashSavings: 250_000,
      retirementTopUp: { enabled: true, annualAmount: 200_000, startAge: 54, endAge: 54 } };
    const result = projectRetirement(inputs);
    expect(result.rows[1].cpfOa).toBeCloseTo(0, 2);
    expect(result.rows[1].cpfRa).toBeGreaterThan(200_000);
    expect(result.summary.estimatedCpfWithdrawableAt55).toBeCloseTo(0, 2);
  });

  it("uses a persistent RA top-up basis, not the declining LIFE reserve, for ERS headroom", () => {
    const inputs = sanitizeInputs({ ...base, currentAge: 65, retirementAge: 66,
      cpfRa: 440_000, retirementTopUp: { enabled: true, annualAmount: 8_000, startAge: 65, endAge: 70 } });
    const state = createInitialCpfState(inputs);
    state.lifeStarted = true; state.lifeBase = 440_000; state.ra = 0; state.lifeReserve = 200_000;
    const applied = retirementTopUpForYear(inputs, state, 65, 100_000);
    expect(applied.applied).toBe(800);
    expect(state.ra).toBe(0);
    expect(state.lifeBase).toBe(440_800);
    expect(state.raTopupBasis).toBe(retirementSumsForYear(2026).ers);
  });

  it("excludes all new CPF features when CPF is disabled", () => {
    const result = projectRetirement({ ...base, includeCpf: false,
      retirementTopUp: { enabled: true, annualAmount: 8_000, startAge: 54, endAge: 65 },
      insuranceEstimate: { ...insuranceDefaults, enabled: true } });
    expect(result.rows.every((r) => r.cpfTotal === 0 && r.cpfRetirementTopUp === 0 && r.insurancePremiumTotal === 0)).toBe(true);
  });

  it("preserves quiz selections into the detailed projection inputs", () => {
    const answers = createInitialOnboardingAnswers(base);
    answers.retirementTopUp = { enabled: true, annualAmount: 4_000, startAge: 54, endAge: 62 };
    answers.insuranceEstimate = { ...insuranceDefaults, enabled: true, supplement: true };
    const inputs = onboardingAnswersToRetirementInputs(answers, base);
    expect(inputs.retirementTopUp).toEqual(answers.retirementTopUp);
    expect(inputs.insuranceEstimate).toEqual(answers.insuranceEstimate);
  });
});

describe("simple insurance estimate", () => {
  it("uses age-next-birthday MediShield bands", () => {
    expect(medishieldPremium(29)).toBe(295);
    expect(medishieldPremium(30)).toBe(503);
    expect(medishieldPremium(70)).toBe(1643);
    expect(medishieldPremium(100)).toBe(2826);
  });

  it.each([[39, 300], [40, 600], [69, 600], [70, 900]])("applies the private IP withdrawal limit at age %s", (age, limit) => {
    const yearly = insuranceForYear({ ...base, currentAge: age, insuranceEstimate: { ...insuranceDefaults,
      enabled: true, hospitalCover: "integrated", privatePremiumAnnual: 2_000, premiumGrowthRate: 0 } }, age);
    expect(yearly.medisaveEligible).toBe(medishieldPremium(age) + limit);
    expect(yearly.cashRequired).toBe(2_000 - limit);
  });

  it("caps supplements at actual premium or $600, whichever is less", () => {
    for (const premium of [0, 300, 600, 1_200]) {
      const yearly = insuranceForYear({ ...base, insuranceEstimate: { ...insuranceDefaults, enabled: true,
        hospitalCover: "none", supplement: true, supplementPremiumAnnual: premium } }, 54);
      expect(yearly.medisaveEligible).toBe(Math.min(premium, 600));
      expect(yearly.total).toBe(premium);
    }
  });

  it("stops standard CareShield payments after 67 and late-joiner payments after ten payments", () => {
    const inputs = { ...base, currentAge: 61, insuranceEstimate: { ...insuranceDefaults, enabled: true,
      hospitalCover: "none" as const, careShield: true, careShieldJoinAge: 61, careShieldPremiumAnnual: 500 } };
    expect(insuranceForYear(inputs, 67).total).toBeGreaterThan(500);
    expect(insuranceForYear(inputs, 70).total).toBe(insuranceForYear(inputs, 67).total);
    expect(insuranceForYear(inputs, 71).total).toBe(0);
    inputs.insuranceEstimate.careShieldJoinAge = 30;
    expect(insuranceForYear(inputs, 68).total).toBe(0);
  });

  it("replaces the legacy MA input and sends exhausted MA premiums to cash", () => {
    const result = projectRetirement({ ...base, cpfMa: 100, cpfMaMedicalPremiumAnnual: 10_000,
      insuranceEstimate: { ...insuranceDefaults, enabled: true, hospitalCover: "none", supplement: true } });
    expect(result.rows[0].insurancePremiumTotal).toBe(600);
    expect(result.rows[0].cpfMaMedicalPremium).toBe(100);
    expect(result.rows[0].insuranceCashPremium).toBe(500);
    expect(result.rows[0].cashWithdrawal).toBe(500);
    expect(result.rows[0].endingCashSavings).toBe(99_500);
    expect(result.rows[0].cpfMa).toBe(0);
  });

  it("never silently drops a premium when no funding is available", () => {
    const result = projectRetirement({ ...base, currentCashSavings: 0,
      insuranceEstimate: { ...insuranceDefaults, enabled: true, hospitalCover: "none", supplement: true } });
    expect(result.rows[0].shortfall).toBe(600);
    expect(result.rows[0].endingCashSavings).toBe(0);
  });

  it("retains surplus retirement income as cash", () => {
    const result = projectRetirement({ ...base, retirementAge: 55,
      customIncomeStreams: [{ id: "pension", label: "Pension", startAge: 55, endAge: 60, amount: 1_000, frequency: "monthly", growthMode: "fixed", annualIncreaseRate: 0 }] });
    expect(result.rows[1].endingCashSavings - result.rows[0].endingCashSavings).toBe(12_000);
  });
});

describe("couple top-ups and insurance", () => {
  it("allocates a limited shared top-up budget fairly and keeps owned accounts separate", () => {
    const plan = createDefaultHouseholdPlan();
    plan.currentCashSavings = 1_000; plan.currentInvestments = 0;
    plan.people = plan.people.map((person) => ({ ...person, inputs: { ...base,
      retirementTopUp: { enabled: true, annualAmount: 8_000, startAge: 54, endAge: 54 } } })) as typeof plan.people;
    const row = projectHousehold(plan).rows[0];
    expect(row.people.map((p) => p.cpfRetirementTopUp)).toEqual([500, 500]);
    expect(row.endingCashSavings).toBe(0);
    expect(row.people[0].cpfSa).toBe(row.people[1].cpfSa);
  });

  it("deducts each person's premiums and observes mortgage end age after retirement", () => {
    const plan = createDefaultHouseholdPlan();
    plan.currentCashSavings = 100_000;
    plan.people = plan.people.map((person, i) => ({ ...person, inputs: { ...base, currentAge: 64,
      retirementAge: 65, cpfOa: 100_000, cpfOaHousingMonthly: i === 0 ? 500 : 0,
      cpfOaHousingEndAge: 66, insuranceEstimate: { ...insuranceDefaults, enabled: true, hospitalCover: "none" as const, supplement: true } } })) as typeof plan.people;
    const rows = projectHousehold(plan).rows;
    expect(rows[0].people[0].insuranceCashPremium).toBe(600);
    expect(rows[0].people[1].insuranceCashPremium).toBe(600);
    expect(rows[0].householdSpending).toBe(1_200);
    expect(rows[2].people[0].cpfOa).toBeLessThan(rows[2].people[1].cpfOa);
  });
});
