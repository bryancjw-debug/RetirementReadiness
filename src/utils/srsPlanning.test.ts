import { describe, expect, it } from "vitest";
import { defaultInputs, projectRetirement, sanitizeInputs } from "./projection";
import { compareSrsStrategies, retirementTaxForYear, srsContributionForAge, taxOnIncome } from "./srsPlanning";
import { buildRetirementFundingRows } from "./fundingChart";
import { dependantSpendingForYear, lifestyleBudgets } from "./lifestyle";
import { createDefaultHouseholdPlan } from "../household";
import { projectHousehold } from "./householdProjection";
import { createInitialOnboardingAnswers, onboardingAnswersToRetirementInputs } from "../onboarding";

const inputs = { ...defaultInputs, currentAge: 60, retirementAge: 65, endAge: 85, includeCpf: false, includeSrs: true, srsCurrentBalance: 400000, srsAnnualContribution: 0, srsReturnRate: 0, srsFirstWithdrawalAge: 65, retirementSpendingInflationRate: 0 };

describe("SRS and household budgets", () => {
  it("uses a moderate 3.5% SRS return for new plans", () => {
    expect(defaultInputs.srsReturnRate).toBe(3.5);
    expect(createDefaultHouseholdPlan().people.every((person) => person.inputs.srsReturnRate === 3.5)).toBe(true);
    const legacy = sanitizeInputs({ ...defaultInputs, retirementAge: 62,
      srsContributionEndAge: undefined as unknown as number,
      srsReturnRate: undefined as unknown as number });
    expect(legacy.srsContributionEndAge).toBe(62);
    expect(legacy.srsReturnRate).toBe(3.5);
  });
  it("uses illustrative couple budgets that differ from individual budgets", () => {
    for (const budget of lifestyleBudgets) { expect(budget.couple).toBeGreaterThan(budget.single); expect(budget.shares.reduce((a,b)=>a+b,0)).toBeCloseTo(1); }
  });
  it("inflates dependant support and stops at the support end age", () => {
    const profile = { adults: 2 as const, dependants: [{ id:"1",label:"Child",currentAge:18,supportUntilAge:25,monthlyAmountToday:1000 }] };
    expect(dependantSpendingForYear(profile,6,2.5)).toBeCloseTo(12000*1.025**6);
    expect(dependantSpendingForYear(profile,7,2.5)).toBe(0);
    const rows = projectRetirement({...inputs,currentAge:60,retirementAge:62,spendingProfile:profile}).rows;
    expect(rows.find(r=>r.age===61)!.dependantSpending).toBe(0);
    expect(rows.find(r=>r.age===62)!.dependantSpending).toBe(12000);
    expect(rows.find(r=>r.age===67)!.dependantSpending).toBe(0);
  });
  it("keeps contributions separate and respects the selected start and stop", () => {
    const scenario = {...inputs,srsAnnualContribution:20000,srsContributionStartAge:62,srsContributionEndAge:63};
    expect(srsContributionForAge(scenario,61)).toBe(0);
    expect(srsContributionForAge(scenario,62)).toBe(15300);
    expect(srsContributionForAge(scenario,64)).toBe(0);
    const withSrs = projectRetirement(scenario).rows[2];
    const without = projectRetirement({...scenario,includeSrs:false}).rows[2];
    expect(withSrs.cashContribution).toBe(without.cashContribution);
    expect(withSrs.investmentContribution).toBe(without.investmentContribution);
  });
  it("allows SRS contributions after retirement until a qualifying withdrawal begins", () => {
    const scenario = {...inputs, retirementAge:62, srsAnnualContribution:1000, srsContributionStartAge:62, srsContributionEndAge:64, srsFirstWithdrawalAge:65};
    expect(srsContributionForAge(scenario,62)).toBe(1000);
    expect(srsContributionForAge(scenario,64)).toBe(1000);
    expect(srsContributionForAge(scenario,65)).toBe(0);
  });
  it("bounds guided SRS balances, return rates and withdrawal age", () => {
    const safe = sanitizeInputs({...inputs, srsCurrentBalance:900000, srsReturnRate:-4, srsFirstWithdrawalAge:99});
    expect(safe.srsCurrentBalance).toBe(500000);
    expect(safe.srsReturnRate).toBe(0);
    expect(safe.srsFirstWithdrawalAge).toBe(80);
  });
  it("has no SRS tax at $40k gross with no other income, but adds tax with rent", () => {
    expect(retirementTaxForYear(inputs,65,40000).srsTax).toBe(0);
    const tax=retirementTaxForYear({...inputs,otherTaxableIncome:{annualAmount:40000,startAge:65,endAge:75,growthRate:0}},65,40000);
    expect(tax.otherTax).toBe(550);
    expect(tax.totalTax).toBeCloseTo(1950, 2);
    expect(tax.srsTax).toBeCloseTo(1400, 2);
  });
  it("separates citizenship contribution caps from withdrawal tax residency", () => {
    const foreignResident={...inputs,srsResidency:"Foreigner" as const,retirementTaxResidency:"Resident" as const,srsAnnualContribution:40000};
    expect(srsContributionForAge(foreignResident,60)).toBe(35700);
    expect(retirementTaxForYear(foreignResident,65,40000).srsTax).toBe(0);
    expect(retirementTaxForYear({...inputs,retirementTaxResidency:"Non-resident"},65,40000).srsTax).toBe(4800);
    expect(taxOnIncome(320000,true)).toBe(44550);
  });
  it("clears the remaining SRS balance in the tenth annual row, never earlier", () => {
    const scenario={...inputs,srsReturnRate:5,srsWithdrawalStrategy:"Even Over Ten Years" as const};
    const rows=projectRetirement(scenario).rows;
    expect(rows.find(r=>r.age===73)!.srsBalance).toBeGreaterThan(0);
    expect(rows.find(r=>r.age===74)!.srsBalance).toBeCloseTo(0);
    expect(rows.find(r=>r.age===75)!.srsWithdrawal).toBe(0);
    const comparison=compareSrsStrategies(sanitizeInputs(scenario));
    comparison.even.rows.forEach(expected => expect(rows.find(row => row.age === expected.age)!.srsWithdrawal).toBeCloseTo(expected.withdrawal, 2));
  });
  it("never drags a withdrawal into a shorter planning horizon", () => {
    const rows=projectRetirement({...inputs,endAge:66,srsFirstWithdrawalAge:70}).rows;
    expect(rows.every(r=>r.srsWithdrawal===0)).toBe(true);
  });
  it("reconciles net funding, gross withdrawals and tax without double-counting", () => {
    const rows=projectRetirement({...inputs,otherTaxableIncome:{annualAmount:40000,startAge:65,endAge:70,growthRate:0}}).rows;
    for(const row of buildRetirementFundingRows(rows)) {
      expect(row.cpfLife+row.dividends+row.customIncome+row.taxableIncome+row.srs+row.cash+row.investments+row.cpf+row.shortfall).toBeCloseTo(row.spending);
      expect(row.srsGross-row.srsTax).toBeCloseTo(row.srsNet);
    }
  });
  it("keeps both partners' tax calculations separate", () => {
    const plan=createDefaultHouseholdPlan();
    plan.people.forEach(p=>{ p.inputs={...inputs,otherTaxableIncome:{annualAmount:20000,startAge:65,endAge:85,growthRate:0}}; });
    const row=projectHousehold(plan).rows.find(r=>r.people[0].age===65)!;
    expect(row.people[0].totalIncomeTax).toBe(550);
    expect(row.people[1].totalIncomeTax).toBe(550);
    expect(row.totalIncomeTax).toBe(1100);
    expect(row.otherTaxableIncome).toBe(40000);
  });
  it("retains SRS settings through the individual questionnaire", () => {
    const scenario={...inputs,srsContributionStartAge:62,otherTaxableIncome:{annualAmount:12000,startAge:65,endAge:80,growthRate:1}};
    const rebuilt=onboardingAnswersToRetirementInputs(createInitialOnboardingAnswers(scenario),defaultInputs);
    expect(rebuilt.includeSrs).toBe(true);
    expect(rebuilt.srsContributionStartAge).toBe(62);
    expect(rebuilt.otherTaxableIncome).toEqual(scenario.otherTaxableIncome);
  });
});
