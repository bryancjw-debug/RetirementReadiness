import { describe, expect, it } from "vitest";
import { createDefaultHouseholdPlan } from "../household";
import { defaultInputs, projectRetirement } from "./projection";
import { projectHousehold } from "./householdProjection";
import { evaluateRoom, roomPlanFacts, spendingRoom, type RoomSettings } from "./spendingRoom";
import { scenarioBudget, type SpendingScenario } from "./spendingScenario";

const settings: RoomSettings = { reserve: 20000, careMonthly: 1000, careStartAge: 75, careYears: 5, lifestyleReduction: 500, lifestyleStartAge: 75 };
const individual = { ...defaultInputs, currentAge: 60, retirementAge: 65, endAge: 90, currentCashSavings: 1500000,
  currentInvestments: 0, includeCpf: false, includeSrs: false, cashSavingsContribution: 500, investmentContribution: 500,
  retirementSpendingAnnual: 36000, retirementSpendingInflationRate: 0, cashInterestRate: 0, passiveIncomeYieldRate: 0 };
const plan = { individual };
const overlay: SpendingScenario = { extraMonthly: 100, careMonthly: 500, careStartOffset: 15, careYears: 2, lifestyleReductionMonthly: 200, lifestyleStartOffset: 15 };

describe("Retirement spending comparisons", () => {
  it("keeps the base projection and applies care only in the selected window", () => {
    const baseline = projectRetirement(individual);
    const comparison = projectRetirement(individual, overlay);
    expect(baseline.rows.find(row => row.age === 75)!.spendingNeed).toBe(36000);
    expect(comparison.rows.find(row => row.age === 64)!.spendingNeed).toBe(0);
    expect(comparison.rows.find(row => row.age === 74)!.spendingNeed).toBe(37200);
    expect(comparison.rows.find(row => row.age === 75)!.spendingNeed).toBe(40800);
    expect(comparison.rows.find(row => row.age === 77)!.spendingNeed).toBe(34800);
    expect(projectRetirement(individual)).toEqual(baseline);
  });
  it("never uses a lifestyle cut to cancel care or the extra budget", () => {
    expect(scenarioBudget(1200, 15, overlay)).toBe(7200);
  });
  it("adds a single care cost to the household, not once per partner", () => {
    const household = createDefaultHouseholdPlan();
    const base = projectHousehold(household);
    const changed = projectHousehold(household, { ...overlay, careStartOffset: 35, lifestyleStartOffset: 110 });
    const inflation = (1 + household.retirementSpendingInflationRate / 100) ** 35;
    expect(changed.rows[35].householdSpending - base.rows[35].householdSpending).toBeCloseTo(7200 * inflation);
  });
  it("returns a tested increment and retains the selected real reserve", () => {
    const result = spendingRoom(plan, settings, false, false);
    expect(result.amount).toBeGreaterThan(0);
    expect(evaluateRoom(plan, settings, false, result.amount).passes).toBe(true);
    expect(evaluateRoom(plan, settings, false, result.amount + 10).passes).toBe(false);
  });
  it("does not credit lifestyle reductions to headline headroom", () => {
    expect(spendingRoom(plan, settings, true, false)).toEqual(spendingRoom(plan, { ...settings, lifestyleReduction: 0 }, true, false));
  });
  it("reduces headroom under the cautious assumptions and rejects an unaffordable combination", () => {
    expect(spendingRoom(plan, settings, true, false).amount).toBeLessThan(spendingRoom(plan, settings, false, false).amount);
    expect(evaluateRoom(plan, settings, true, 100000, 1000).passes).toBe(false);
  });
  it("caps redirected savings at planned cash and ordinary investment contributions", () => {
    expect(spendingRoom(plan, settings, false, true).amount).toBeLessThanOrEqual(1000);
    expect(roomPlanFacts({ individual: { ...individual, cashSavingsContribution: 0, investmentContribution: 0 } }).contributions).toBe(0);
    expect(evaluateRoom(plan, settings, false, 0, 2000)).toEqual(evaluateRoom(plan, settings, false, 0, 1000));
  });
  it("does not count restricted starting balances as a cash and investment reserve", () => {
    const locked = { individual: { ...individual, currentCashSavings: 0, currentInvestments: 0,
      cashSavingsContribution: 0, investmentContribution: 0, includeCpf: true, cpfMa: 50000 } };
    expect(spendingRoom(locked, settings, false, false)).toMatchObject({ amount: 0, baselinePasses: false });
  });
  it("rejects a reserve breach in the first retirement year even when a later windfall refills cash", () => {
    const wound = { individual: { ...individual, currentAge: 64, retirementAge: 65, currentCashSavings: 50000,
      cashSavingsContribution: 0, investmentContribution: 0, includeOneTimeEvents: true,
      oneTimeEvents: [{ id: "later", label: "Later receipt", age: 66, amount: 2000000, direction: "inflow" as const }] } };
    expect(evaluateRoom(wound, settings, false).passes).toBe(false);
  });
});
