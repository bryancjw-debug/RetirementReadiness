import type { RetirementInputs } from "../types";
import type { HouseholdPersonPlan, HouseholdPlan } from "../household";
import {
  accrueLockedSaInterest,
  applyMedisaveCap,
  formRaIfNeeded,
  startCpfLifeIfNeeded,
  routeRetirementAllocation,
  retirementTopUpForYear,
  type CpfState,
  cpfContributionForYear,
  createInitialCpfState,
  cpfInterest,
  cpfLifeAnnual,
  estimateSrsWithdrawalTax,
  sanitizeInputs,
  srsContributionCap
} from "./projection";
import { insuranceForYear } from "./insurance";

type PersonState = {
  cpf: CpfState;
  srsBalance: number;
  srsWithdrawalBase: number;
};

export interface HouseholdPersonYear {
  cpfRetirementTopUp: number;
  cpfRetirementTopUpUnfilled: number;
  cpfMaMedicalPremium: number;
  insurancePremiumTotal: number;
  insuranceCashPremium: number;
  housingCashPayment: number;
  id: HouseholdPersonPlan["id"];
  label: string;
  age: number;
  retired: boolean;
  cpfEmployeeContribution: number;
  cpfEmployerContribution: number;
  cpfTotalContribution: number;
  cpfOa: number;
  cpfSa: number;
  cpfMa: number;
  cpfRa: number;
  cpfLifeReserve: number;
  cpfLifeIncome: number;
  customIncome: number;
  cpfDrawdown: number;
  srsContribution: number;
  srsGrowth: number;
  srsWithdrawal: number;
  srsTaxableAmount: number;
  srsEstimatedTax: number;
  srsNetWithdrawal: number;
  srsBalance: number;
}

export interface HouseholdYear {
  yearIndex: number;
  calendarYear: number;
  phase: "build-up" | "retirement";
  people: [HouseholdPersonYear, HouseholdPersonYear];
  householdSpending: number;
  oneTimeInflow: number;
  oneTimeOutflow: number;
  cashContribution: number;
  investmentContribution: number;
  savingsInterest: number;
  investmentGrowth: number;
  passiveIncome: number;
  cpfLifeIncome: number;
  customIncome: number;
  srsNetWithdrawal: number;
  cashWithdrawal: number;
  investmentWithdrawal: number;
  cpfDrawdown: number;
  shortfall: number;
  endingCashSavings: number;
  endingInvestments: number;
  totalCpf: number;
  totalSrs: number;
  totalTrackedResources: number;
}

export interface HouseholdPersonSummary {
  id: HouseholdPersonPlan["id"];
  label: string;
  currentAge: number;
  retirementAge: number;
  cpfLifeStartAge: number;
  cpfAt55: number;
  cpfLifeMonthlyAtStart: number;
  totalCpfContributions: number;
  finalCpf: number;
  totalSrsContributions: number;
  totalSrsGrowth: number;
  totalSrsWithdrawals: number;
  totalSrsEstimatedTax: number;
  finalSrs: number;
  totalCustomIncome: number;
}

export interface HouseholdProjection {
  rows: HouseholdYear[];
  people: [HouseholdPersonSummary, HouseholdPersonSummary];
  summary: {
    status: "ready" | "not-ready";
    readinessPercent: number;
    firstShortfallYear: number | null;
    runwayYear: number;
    totalRetirementNeed: number;
    totalFundedRetirementNeed: number;
    totalShortfall: number;
    finalTrackedResources: number;
    peakTrackedResources: number;
    peakYear: number;
    retirementStartYear: number;
    retirementStartAges: [number, number];
  };
}

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const rate = (value: number) => (Number.isFinite(value) ? value / 100 : 0);

function createPersonState(person: HouseholdPersonPlan): PersonState {
  const inputs = sanitizeInputs(person.inputs);
  return {
    cpf: createInitialCpfState(inputs),
    srsBalance: inputs.includeSrs ? inputs.srsCurrentBalance : 0,
    srsWithdrawalBase: 0
  };
}

function srsForYear(inputs: RetirementInputs, state: PersonState, age: number) {
  const contribution = inputs.includeSrs
    && age < inputs.retirementAge
    && age <= inputs.srsContributionEndAge
    && age < inputs.srsFirstWithdrawalAge
    ? Math.min(inputs.srsAnnualContribution, srsContributionCap(inputs))
    : 0;
  state.srsBalance += contribution;
  const growth = state.srsBalance * rate(inputs.srsReturnRate);
  state.srsBalance += growth;
  let withdrawal = 0;
  if (inputs.includeSrs && age >= inputs.srsFirstWithdrawalAge && age < inputs.srsFirstWithdrawalAge + 10) {
    if (state.srsWithdrawalBase <= 0) state.srsWithdrawalBase = state.srsBalance;
    const withdrawalYear = age - inputs.srsFirstWithdrawalAge + 1;
    const yearsRemaining = 11 - withdrawalYear;
    withdrawal = withdrawalYear === 10
      ? state.srsBalance
      : inputs.srsWithdrawalStrategy === "Tax Aware"
        ? Math.min(state.srsBalance, state.srsBalance / yearsRemaining)
        : Math.min(state.srsBalance, state.srsWithdrawalBase / 10);
    state.srsBalance -= withdrawal;
  }
  const tax = estimateSrsWithdrawalTax(withdrawal, inputs.srsResidency);
  return {
    contribution,
    growth,
    withdrawal,
    taxableAmount: tax.taxableAmount,
    estimatedTax: tax.estimatedTax,
    netWithdrawal: Math.max(0, withdrawal - tax.estimatedTax)
  };
}

function annualContribution(monthly: number, annualIncreaseRate: number, yearsFromStart: number) {
  return nonNegative(monthly) * 12 * Math.pow(1 + rate(annualIncreaseRate), Math.max(0, yearsFromStart));
}

function customIncomeForAge(inputs: RetirementInputs, age: number) {
  return inputs.customIncomeStreams.reduce((sum, stream) => {
    if (age < stream.startAge || age > stream.endAge || stream.amount <= 0) return sum;
    const annualBase = stream.frequency === "monthly" ? stream.amount * 12 : stream.amount;
    const increase = stream.growthMode === "increasing"
      ? Math.pow(1 + rate(stream.annualIncreaseRate), age - stream.startAge)
      : 1;
    return sum + annualBase * increase;
  }, 0);
}

function householdEventTotals(plan: HouseholdPlan, anchorAge: number) {
  if (!plan.includeOneTimeEvents) return { inflow: 0, outflow: 0 };
  return plan.oneTimeEvents.reduce((totals, event) => {
    if (event.age !== anchorAge || event.amount <= 0) return totals;
    totals[event.direction] += event.amount;
    return totals;
  }, { inflow: 0, outflow: 0 });
}

function retirementStartOffset(plan: HouseholdPlan) {
  const offsets = plan.people.map((person) => person.inputs.retirementAge - person.inputs.currentAge);
  return plan.retirementStart === "both" ? Math.max(...offsets) : Math.min(...offsets);
}

function drawCpf(people: HouseholdPersonPlan[], states: PersonState[], ages: number[], amount: number) {
  let remaining = amount;
  const draws = [0, 0];
  for (const account of ["sa", "oa"] as const) {
    const eligible = states.map((state, index) => (
      people[index].inputs.includeCpf
      && ages[index] >= 55
      && ages[index] >= people[index].inputs.retirementAge
        ? state.cpf[account]
        : 0
    ));
    const available = eligible[0] + eligible[1];
    if (available <= 0 || remaining <= 0) continue;
    const used = Math.min(available, remaining);
    let allocated = 0;
    eligible.forEach((balance, index) => {
      const personDraw = index === eligible.length - 1
        ? used - allocated
        : used * (balance / available);
      const capped = Math.min(balance, Math.max(0, personDraw));
      states[index].cpf[account] -= capped;
      draws[index] += capped;
      allocated += capped;
    });
    remaining = Math.max(0, amount - draws[0] - draws[1]);
  }
  return { total: draws[0] + draws[1], byPerson: draws as [number, number] };
}

export function projectHousehold(rawPlan: HouseholdPlan): HouseholdProjection {
  const plan: HouseholdPlan = {
    ...rawPlan,
    people: rawPlan.people.map((person) => ({ ...person, inputs: sanitizeInputs(person.inputs) })) as HouseholdPlan["people"]
  };
  const states = plan.people.map(createPersonState);
  const rows: HouseholdYear[] = [];
  const horizon = Math.max(...plan.people.map((person) => person.inputs.endAge - person.inputs.currentAge));
  const startOffset = retirementStartOffset(plan);
  let cash = nonNegative(plan.currentCashSavings);
  let investments = nonNegative(plan.currentInvestments);

  for (let yearIndex = 0; yearIndex <= horizon; yearIndex += 1) {
    const calendarYear = 2026 + yearIndex;
    const phase: HouseholdYear["phase"] = yearIndex < startOffset ? "build-up" : "retirement";
    const ages = plan.people.map((person) => person.inputs.currentAge + yearIndex);
    const personRows: HouseholdPersonYear[] = [];
    let totalCpfLifeIncome = 0;
    let totalCustomIncome = 0;
    let totalSrsNetWithdrawal = 0;
    let cashContribution = 0;
    let investmentContribution = 0;

    plan.people.forEach((person, index) => {
      const inputs = person.inputs;
      const state = states[index];
      const age = ages[index];
      formRaIfNeeded(inputs, state.cpf, age);
      startCpfLifeIfNeeded(inputs, state.cpf, age);
      const cpfContribution = inputs.includeCpf
        ? cpfContributionForYear(inputs, age)
        : { oa: 0, sa: 0, ma: 0, ra: 0, total: 0, employee: 0, employer: 0 };
      state.cpf.oa += cpfContribution.oa;
      state.cpf.ma += cpfContribution.ma;
      routeRetirementAllocation(inputs, state.cpf, age, cpfContribution.sa + cpfContribution.ra);
      applyMedisaveCap(inputs, state.cpf, age);
      const mortgage = inputs.includeCpf && age <= inputs.cpfOaHousingEndAge ? inputs.cpfOaHousingMonthly * 12 : 0;
      const oaHousing = Math.min(state.cpf.oa, mortgage);
      state.cpf.oa -= oaHousing;
      const insurance = insuranceForYear(inputs, age);
      const cpfMaMedicalPremium = Math.min(state.cpf.ma, insurance.medisaveEligible);
      state.cpf.ma -= cpfMaMedicalPremium;
      const cpfLifeIncome = inputs.includeCpf && state.cpf.lifeStarted
        ? cpfLifeAnnual(inputs, state.cpf.lifeBase, inputs.cpfLifeStartAge, age)
        : 0;
      const customIncome = phase === "retirement" ? customIncomeForAge(inputs, age) : 0;
      const srs = srsForYear(inputs, state, age);
      totalCpfLifeIncome += cpfLifeIncome;
      totalCustomIncome += customIncome;
      totalSrsNetWithdrawal += srs.netWithdrawal;
      if (age < inputs.retirementAge) {
        cashContribution += annualContribution(inputs.cashSavingsContribution, plan.annualContributionIncreaseRate, yearIndex);
        investmentContribution += annualContribution(inputs.investmentContribution, plan.annualContributionIncreaseRate, yearIndex);
      }
      personRows.push({
        cpfRetirementTopUp: 0,
        cpfRetirementTopUpUnfilled: 0,
        cpfMaMedicalPremium,
        insurancePremiumTotal: insurance.total,
        insuranceCashPremium: insurance.total - cpfMaMedicalPremium,
        housingCashPayment: mortgage - oaHousing,
        id: person.id,
        label: person.label,
        age,
        retired: age >= inputs.retirementAge,
        cpfEmployeeContribution: cpfContribution.employee,
        cpfEmployerContribution: cpfContribution.employer,
        cpfTotalContribution: cpfContribution.total,
        cpfOa: 0,
        cpfSa: 0,
        cpfMa: 0,
        cpfRa: 0,
        cpfLifeReserve: 0,
        cpfLifeIncome,
        customIncome,
        cpfDrawdown: 0,
        srsContribution: srs.contribution,
        srsGrowth: srs.growth,
        srsWithdrawal: srs.withdrawal,
        srsTaxableAmount: srs.taxableAmount,
        srsEstimatedTax: srs.estimatedTax,
        srsNetWithdrawal: srs.netWithdrawal,
        srsBalance: state.srsBalance
      });
    });

    const eventTotals = householdEventTotals(plan, ages[0]);
    const extraCashCosts = personRows.reduce((sum, row) => sum + row.insuranceCashPremium + row.housingCashPayment, 0);
    const eligibleTopups = plan.people.map((person, index) => retirementTopUpForYear(person.inputs, { ...states[index].cpf }, ages[index], Infinity).applied);
    const topupTotal = eligibleTopups.reduce((sum, amount) => sum + amount, 0);
    const topupBudget = Math.min(topupTotal, Math.max(0, cash + cashContribution + eventTotals.inflow - extraCashCosts - eventTotals.outflow));
    plan.people.forEach((person, index) => {
      const topup = retirementTopUpForYear(person.inputs, states[index].cpf, ages[index], topupTotal > 0 ? topupBudget * eligibleTopups[index] / topupTotal : 0);
      personRows[index].cpfRetirementTopUp = topup.applied;
      personRows[index].cpfRetirementTopUpUnfilled = topup.unfilled;
      const newIncome = person.inputs.includeCpf && states[index].cpf.lifeStarted
        ? cpfLifeAnnual(person.inputs, states[index].cpf.lifeBase, person.inputs.cpfLifeStartAge, ages[index]) : 0;
      totalCpfLifeIncome += newIncome - personRows[index].cpfLifeIncome;
      personRows[index].cpfLifeIncome = newIncome;
    });
    const investmentsBeforeGrowth = investments + investmentContribution;
    const investmentRate = phase === "build-up" ? plan.preRetirementInvestmentReturnRate : plan.retirementReturnRate;
    const investmentGrowth = investmentsBeforeGrowth * rate(investmentRate);
    const passiveIncome = phase === "retirement" ? investmentsBeforeGrowth * rate(plan.passiveIncomeYieldRate) : 0;
    const householdSpending = (phase === "retirement"
      ? nonNegative(plan.retirementSpendingAnnual) * Math.pow(1 + rate(plan.retirementSpendingInflationRate), yearIndex)
      : 0) + extraCashCosts;
    const nonSrsIncome = passiveIncome + totalCpfLifeIncome + totalCustomIncome;
    const srsIncomeUsed = Math.min(totalSrsNetWithdrawal, Math.max(0, householdSpending + eventTotals.outflow - nonSrsIncome));
    const srsToCash = totalSrsNetWithdrawal - srsIncomeUsed;
    const cashBeforeInterest = cash + cashContribution + srsToCash + eventTotals.inflow - topupBudget;
    const savingsInterest = cashBeforeInterest * rate(plan.cashInterestRate);
    const spendingGap = Math.max(0, householdSpending + eventTotals.outflow - nonSrsIncome - srsIncomeUsed);
    const cashAvailable = cashBeforeInterest + savingsInterest;
    const investmentsAvailable = investmentsBeforeGrowth + investmentGrowth;
    const cashWithdrawal = Math.min(spendingGap, cashAvailable);
    const investmentWithdrawal = Math.min(Math.max(0, spendingGap - cashWithdrawal), investmentsAvailable);
    const remainingGap = Math.max(0, spendingGap - cashWithdrawal - investmentWithdrawal);
    const cpfDraw = drawCpf(plan.people, states, ages, remainingGap);
    const shortfall = Math.max(0, remainingGap - cpfDraw.total);
    cash = Math.max(0, cashAvailable - cashWithdrawal) + Math.max(0, nonSrsIncome - householdSpending - eventTotals.outflow);
    investments = Math.max(0, investmentsAvailable - investmentWithdrawal);

    personRows.forEach((personRow, index) => {
      const inputs = plan.people[index].inputs;
      const state = states[index];
      personRow.cpfDrawdown = cpfDraw.byPerson[index];
      if (inputs.includeCpf) {
        if (state.cpf.lifeStarted) {
          if (inputs.cpfLifePlan === "Basic") {
            state.cpf.ra = Math.max(0, state.cpf.ra - personRow.cpfLifeIncome);
            state.cpf.lifeReserve = state.cpf.ra;
          } else {
            state.cpf.lifeReserve = Math.max(0, state.cpf.lifeReserve - personRow.cpfLifeIncome);
          }
        }
        const interest = cpfInterest(state.cpf, personRow.age, state.cpf.lifeStarted, inputs.cpfLifePlan);
        accrueLockedSaInterest(state.cpf, interest.sa);
        state.cpf.oa += interest.oa;
        state.cpf.sa += interest.sa;
        state.cpf.ma += interest.ma;
        state.cpf.ra += interest.ra;
        applyMedisaveCap(inputs, state.cpf, personRow.age);
        if (inputs.cpfLifePlan === "Basic") state.cpf.lifeReserve = state.cpf.ra;
      }
      personRow.cpfOa = state.cpf.oa;
      personRow.cpfSa = state.cpf.sa;
      personRow.cpfMa = state.cpf.ma;
      personRow.cpfRa = state.cpf.ra;
      personRow.cpfLifeReserve = state.cpf.lifeReserve;
    });

    const totalCpf = states.reduce((sum, state) => sum + state.cpf.oa + state.cpf.sa + state.cpf.ma + state.cpf.ra, 0);
    const totalSrs = states.reduce((sum, state) => sum + state.srsBalance, 0);
    const totalLifeReserve = states.reduce((sum, state) => sum + state.cpf.lifeReserve, 0);
    rows.push({
      yearIndex,
      calendarYear,
      phase,
      people: personRows as HouseholdYear["people"],
      householdSpending,
      oneTimeInflow: eventTotals.inflow,
      oneTimeOutflow: eventTotals.outflow,
      cashContribution,
      investmentContribution,
      savingsInterest,
      investmentGrowth,
      passiveIncome,
      cpfLifeIncome: totalCpfLifeIncome,
      customIncome: totalCustomIncome,
      srsNetWithdrawal: totalSrsNetWithdrawal,
      cashWithdrawal,
      investmentWithdrawal,
      cpfDrawdown: cpfDraw.total,
      shortfall,
      endingCashSavings: cash,
      endingInvestments: investments,
      totalCpf,
      totalSrs,
      totalTrackedResources: cash + investments + totalCpf + totalSrs + totalLifeReserve
    });
  }

  const personSummaries = plan.people.map((person, index) => {
    const personRows = rows.map((row) => row.people[index]);
    const at55 = personRows.find((row) => row.age === 55) ?? personRows.find((row) => row.age > 55);
    const lifeStart = personRows.find((row) => row.age === person.inputs.cpfLifeStartAge);
    const last = personRows.at(-1)!;
    return {
      id: person.id,
      label: person.label,
      currentAge: person.inputs.currentAge,
      retirementAge: person.inputs.retirementAge,
      cpfLifeStartAge: person.inputs.cpfLifeStartAge,
      cpfAt55: at55 ? at55.cpfOa + at55.cpfSa + at55.cpfRa + at55.cpfLifeReserve : 0,
      cpfLifeMonthlyAtStart: (lifeStart?.cpfLifeIncome ?? 0) / 12,
      totalCpfContributions: personRows.reduce((sum, row) => sum + row.cpfTotalContribution, 0),
      finalCpf: last.cpfOa + last.cpfSa + last.cpfMa + last.cpfRa + last.cpfLifeReserve,
      totalSrsContributions: personRows.reduce((sum, row) => sum + row.srsContribution, 0),
      totalSrsGrowth: personRows.reduce((sum, row) => sum + row.srsGrowth, 0),
      totalSrsWithdrawals: personRows.reduce((sum, row) => sum + row.srsWithdrawal, 0),
      totalSrsEstimatedTax: personRows.reduce((sum, row) => sum + row.srsEstimatedTax, 0),
      finalSrs: last.srsBalance,
      totalCustomIncome: personRows.reduce((sum, row) => sum + row.customIncome, 0)
    };
  }) as HouseholdProjection["people"];
  const retirementRows = rows.filter((row) => row.phase === "retirement");
  const firstShortfall = retirementRows.find((row) => row.shortfall > 0);
  const totalRetirementNeed = retirementRows.reduce((sum, row) => sum + row.householdSpending, 0);
  const totalShortfall = retirementRows.reduce((sum, row) => sum + row.shortfall, 0);
  const peak = rows.reduce((best, row) => row.totalTrackedResources > best.totalTrackedResources ? row : best, rows[0]);
  const startRow = rows.find((row) => row.yearIndex === startOffset) ?? rows[0];

  return {
    rows,
    people: personSummaries,
    summary: {
      status: firstShortfall ? "not-ready" : "ready",
      readinessPercent: totalRetirementNeed > 0 ? Math.min(100, ((totalRetirementNeed - totalShortfall) / totalRetirementNeed) * 100) : 100,
      firstShortfallYear: firstShortfall?.calendarYear ?? null,
      runwayYear: firstShortfall ? firstShortfall.calendarYear - 1 : rows.at(-1)!.calendarYear,
      totalRetirementNeed,
      totalFundedRetirementNeed: Math.max(0, totalRetirementNeed - totalShortfall),
      totalShortfall,
      finalTrackedResources: rows.at(-1)!.totalTrackedResources,
      peakTrackedResources: peak.totalTrackedResources,
      peakYear: peak.calendarYear,
      retirementStartYear: startRow.calendarYear,
      retirementStartAges: [startRow.people[0].age, startRow.people[1].age]
    }
  };
}
