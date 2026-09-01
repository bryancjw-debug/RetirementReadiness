import { describe, expect, it } from "vitest";
import { createDefaultHouseholdPlan } from "../household";
import { cpfContributionForYear } from "./projection";
import { projectHousehold } from "./householdProjection";

describe("projectHousehold", () => {
  it("counts household spending once while keeping both people distinct", () => {
    const plan = createDefaultHouseholdPlan();
    plan.people[0].inputs.currentAge = 64;
    plan.people[0].inputs.retirementAge = 65;
    plan.people[1].inputs.currentAge = 63;
    plan.people[1].inputs.retirementAge = 65;
    plan.retirementSpendingAnnual = 60_000;
    plan.retirementSpendingInflationRate = 0;

    const projection = projectHousehold(plan);
    const firstRetirementRow = projection.rows.find((row) => row.phase === "retirement")!;

    expect(firstRetirementRow.householdSpending).toBe(60_000);
    expect(firstRetirementRow.people).toHaveLength(2);
    expect(firstRetirementRow.people[0].label).toBe("You");
    expect(firstRetirementRow.people[1].label).toBe("Partner");
  });

  it("stops each person's regular contributions at that person's retirement age", () => {
    const plan = createDefaultHouseholdPlan();
    plan.people[0].inputs.currentAge = 60;
    plan.people[0].inputs.retirementAge = 62;
    plan.people[0].inputs.cashSavingsContribution = 1_000;
    plan.people[0].inputs.investmentContribution = 0;
    plan.people[1].inputs.currentAge = 60;
    plan.people[1].inputs.retirementAge = 65;
    plan.people[1].inputs.cashSavingsContribution = 2_000;
    plan.people[1].inputs.investmentContribution = 0;
    plan.annualContributionIncreaseRate = 0;

    const projection = projectHousehold(plan);

    expect(projection.rows[0].cashContribution).toBe(36_000);
    expect(projection.rows[2].cashContribution).toBe(24_000);
    expect(projection.rows[5].cashContribution).toBe(0);
  });

  it("starts CPF LIFE independently for each person", () => {
    const plan = createDefaultHouseholdPlan();
    plan.people[0].inputs.currentAge = 64;
    plan.people[0].inputs.retirementAge = 65;
    plan.people[0].inputs.cpfRa = 220_400;
    plan.people[0].inputs.cpfLifeStartAge = 65;
    plan.people[0].inputs.cpfLifeMonthlyOverride = 1_500;
    plan.people[1].inputs.currentAge = 62;
    plan.people[1].inputs.retirementAge = 65;
    plan.people[1].inputs.cpfRa = 220_400;
    plan.people[1].inputs.cpfLifeStartAge = 68;
    plan.people[1].inputs.cpfLifeMonthlyOverride = 1_200;

    const projection = projectHousehold(plan);
    const yearOne = projection.rows[1];
    const yearSix = projection.rows[6];

    expect(yearOne.people[0].cpfLifeIncome).toBe(18_000);
    expect(yearOne.people[1].cpfLifeIncome).toBe(0);
    expect(yearSix.people[1].cpfLifeIncome).toBe(14_400);
  });

  it("tracks SRS contributions and withdrawals separately for both people", () => {
    const plan = createDefaultHouseholdPlan();
    plan.people.forEach((person, index) => {
      person.inputs.currentAge = 60;
      person.inputs.retirementAge = 65;
      person.inputs.includeSrs = true;
      person.inputs.srsCurrentBalance = index === 0 ? 50_000 : 100_000;
      person.inputs.srsAnnualContribution = index === 0 ? 5_000 : 10_000;
      person.inputs.srsContributionEndAge = 64;
      person.inputs.srsFirstWithdrawalAge = 65;
      person.inputs.srsReturnRate = 0;
    });

    const projection = projectHousehold(plan);

    expect(projection.rows[0].people[0].srsContribution).toBe(5_000);
    expect(projection.rows[0].people[1].srsContribution).toBe(10_000);
    expect(projection.rows[5].people[0].srsWithdrawal).toBeGreaterThan(0);
    expect(projection.rows[5].people[1].srsWithdrawal).toBeGreaterThan(projection.rows[5].people[0].srsWithdrawal);
  });

  it("applies CPF wage caps separately to each person", () => {
    const plan = createDefaultHouseholdPlan();
    plan.people.forEach((person) => {
      person.inputs.grossMonthlyIncome = 20_000;
      person.inputs.currentAge = 35;
      person.inputs.retirementAge = 65;
    });

    const projection = projectHousehold(plan);
    const first = projection.rows[0];

    expect(first.people[0].cpfTotalContribution).toBe(35_520);
    expect(first.people[1].cpfTotalContribution).toBe(35_520);
  });

  it("progresses a first-year PR through later CPF contribution years", () => {
    const plan = createDefaultHouseholdPlan();
    const inputs = plan.people[0].inputs;
    inputs.currentAge = 35;
    inputs.retirementAge = 65;
    inputs.cpfResidency = "Permanent Resident";
    inputs.cpfPrYear = "First Year";
    inputs.cpfPrRateType = "Graduated Employer And Employee";
    inputs.grossMonthlyIncome = 5_000;

    const firstYear = cpfContributionForYear(inputs, 35).total;
    const secondYear = cpfContributionForYear(inputs, 36).total;
    const thirdYear = cpfContributionForYear(inputs, 37).total;

    expect(secondYear).toBeGreaterThan(firstYear);
    expect(thirdYear).toBeGreaterThan(secondYear);
  });

  it("applies a shared event once without duplicating it across people", () => {
    const plan = createDefaultHouseholdPlan();
    plan.people[0].inputs.currentAge = 40;
    plan.people[1].inputs.currentAge = 38;
    plan.includeOneTimeEvents = true;
    plan.oneTimeEvents = [{ id: "renovation", label: "Major home cost", age: 45, amount: 80_000, direction: "outflow", certainty: "expected" }];

    const projection = projectHousehold(plan);
    const eventRow = projection.rows.find((row) => row.people[0].age === 45)!;

    expect(eventRow.oneTimeOutflow).toBe(80_000);
    expect(projection.rows.filter((row) => row.oneTimeOutflow > 0)).toHaveLength(1);
  });

  it("keeps other retirement income attributed to its person before combining it", () => {
    const plan = createDefaultHouseholdPlan();
    plan.retirementStart = "first";
    plan.retirementSpendingInflationRate = 0;
    plan.people[0].inputs.currentAge = 64;
    plan.people[0].inputs.retirementAge = 65;
    plan.people[0].inputs.customIncomeStreams = [{ id: "rental", label: "Rental income", startAge: 65, endAge: 80, amount: 1_500, frequency: "monthly", growthMode: "fixed", annualIncreaseRate: 0 }];
    plan.people[1].inputs.customIncomeStreams = [];

    const projection = projectHousehold(plan);
    const incomeRow = projection.rows.find((row) => row.people[0].age === 65)!;

    expect(incomeRow.people[0].customIncome).toBe(18_000);
    expect(incomeRow.people[1].customIncome).toBe(0);
    expect(incomeRow.customIncome).toBe(18_000);
  });

  it("keeps SA closed and continues CPF contributions for a working partner above 55", () => {
    const plan = createDefaultHouseholdPlan();
    const partner = plan.people[1].inputs;
    partner.currentAge = 58;
    partner.retirementAge = 67;
    partner.endAge = 58;
    partner.cpfWorkStatus = "Employed";
    partner.grossMonthlyIncome = 6_000;
    partner.cpfOa = 20_000;
    partner.cpfSa = 80_000;
    partner.cpfRa = 180_000;
    partner.cpfMa = 50_000;

    const first = projectHousehold(plan).rows[0].people[1];
    expect(first.cpfSa).toBe(0);
    expect(first.cpfTotalContribution).toBeGreaterThan(0);
    expect(first.cpfRa).toBeGreaterThan(180_000);
  });
});
