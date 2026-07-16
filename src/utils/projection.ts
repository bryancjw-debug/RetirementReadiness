import type {
  CpfLifePlan,
  CpfPrRateType,
  CpfPrYear,
  CpfResidencyStatus,
  CpfWorkStatus,
  RetirementInputs,
  RetirementProjection,
  RetirementSumChoice,
  RetirementSummary,
  RetirementYear
} from "../types";

const CURRENT_POLICY_YEAR = 2026;
const CPF_ANNUAL_CAP_2026 = 37_740;

const clampNonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

const percentToRate = (value: number) => (Number.isFinite(value) ? value / 100 : 0);

export const defaultInputs: RetirementInputs = {
  currentAge: 58,
  retirementAge: 65,
  endAge: 100,
  currentCashSavings: 50_000,
  currentInvestments: 100_000,
  cashSavingsContribution: 500,
  investmentContribution: 1_000,
  contributionFrequency: "monthly",
  annualContributionIncreaseRate: 2,
  cashInterestRate: 1,
  preRetirementInvestmentReturnRate: 5,
  retirementReturnRate: 3.5,
  passiveIncomeYieldRate: 4,
  includeLumpSum: false,
  lumpSumAmount: 0,
  lumpSumAge: 65,
  includeCpf: true,
  cpfWorkStatus: "Not contributing",
  cpfResidency: "Singapore Citizen",
  cpfPrYear: "Third Year Or Later",
  cpfPrRateType: "Full Employer And Employee",
  grossMonthlyIncome: 0,
  incomeGrowthRate: 0,
  selfEmployedAnnualMedisaveOverride: 0,
  cpfOa: 0,
  cpfSa: 0,
  cpfMa: 0,
  cpfRa: 0,
  cpfLifeStartAge: 65,
  cpfRetirementSum: "Full",
  cpfLifePlan: "Standard",
  cpfLifeMonthlyOverride: 0,
  retirementSpendingAnnual: 36_000,
  retirementSpendingInflationRate: 2.5,
  retirementIncomeMethod: "passive",
  fixedWithdrawalAnnual: 60_000,
  dynamicWithdrawalRate: 4
};

export function frsForYear(year: number) {
  const known: Record<number, number> = { 2025: 213_000, 2026: 220_400, 2027: 228_200 };
  if (known[year]) return known[year];
  if (year < 2025) return Math.round((213_000 / 1.035 ** (2025 - year)) / 100) * 100;
  return Math.round((228_200 * 1.035 ** (year - 2027)) / 100) * 100;
}

export function retirementSumsForYear(year: number) {
  const frs = frsForYear(year);
  return { brs: Math.round(frs / 2 / 100) * 100, frs, ers: frs * 2 };
}

export function bhsForYear(year: number) {
  const known: Record<number, number> = {
    2016: 49_800,
    2017: 52_000,
    2018: 54_500,
    2019: 57_200,
    2020: 60_000,
    2021: 63_000,
    2022: 66_000,
    2023: 68_500,
    2024: 71_500,
    2025: 75_500,
    2026: 79_000
  };
  if (known[year]) return known[year];
  if (year < 2016) return 49_800;
  return Math.round((79_000 * 1.046 ** (year - 2026)) / 100) * 100;
}

function projectionYear(inputs: RetirementInputs, age: number) {
  return CURRENT_POLICY_YEAR + Math.max(0, age - inputs.currentAge);
}

function cpfTargetForChoice(choice: RetirementSumChoice, year: number) {
  const sums = retirementSumsForYear(year);
  if (choice === "Basic") return sums.brs;
  if (choice === "Enhanced") return sums.ers;
  return sums.frs;
}

type CpfContributionRate = { total: number; employee: number };
type CpfAllocation = { oa: number; sa: number; ma: number };
type CpfContribution = {
  oa: number;
  sa: number;
  ma: number;
  ra: number;
  total: number;
  employee: number;
  employer: number;
};

function cpfAgeBand(age: number) {
  if (age <= 55) return "55";
  if (age <= 60) return "60";
  if (age <= 65) return "65";
  if (age <= 70) return "70";
  return "over70";
}

export function cpfAllocationRates(age: number, year = CURRENT_POLICY_YEAR): CpfAllocation {
  if (age <= 35) return { oa: 0.6217, sa: 0.1621, ma: 0.2162 };
  if (age <= 45) return { oa: 0.5677, sa: 0.1891, ma: 0.2432 };
  if (age <= 50) return { oa: 0.5136, sa: 0.2162, ma: 0.2702 };
  if (age <= 55) return { oa: 0.4055, sa: 0.3108, ma: 0.2837 };
  if (year >= 2027 && age <= 60) return { oa: 0.3382, sa: 0.3661, ma: 0.2957 };
  if (year >= 2027 && age <= 65) return { oa: 0.1347, sa: 0.4615, ma: 0.4038 };
  if (age <= 60) return { oa: 0.353, sa: 0.3382, ma: 0.3088 };
  if (age <= 65) return { oa: 0.14, sa: 0.44, ma: 0.42 };
  if (age <= 70) return { oa: 0.0607, sa: 0.303, ma: 0.6363 };
  return { oa: 0.08, sa: 0.08, ma: 0.84 };
}

function cpfContributionRates(
  residency: CpfResidencyStatus,
  prYear: CpfPrYear,
  prRateType: CpfPrRateType,
  age: number,
  year = CURRENT_POLICY_YEAR
): CpfContributionRate {
  const band = cpfAgeBand(age);
  const full: Record<string, CpfContributionRate> = year >= 2027
    ? {
        "55": { total: 0.37, employee: 0.2 },
        "60": { total: 0.355, employee: 0.19 },
        "65": { total: 0.26, employee: 0.13 },
        "70": { total: 0.165, employee: 0.075 },
        over70: { total: 0.125, employee: 0.05 }
      }
    : {
        "55": { total: 0.37, employee: 0.2 },
        "60": { total: 0.34, employee: 0.18 },
        "65": { total: 0.25, employee: 0.125 },
        "70": { total: 0.165, employee: 0.075 },
        over70: { total: 0.125, employee: 0.05 }
      };

  if (residency !== "Permanent Resident" || prYear === "Third Year Or Later" || prRateType === "Full Employer And Employee") {
    return full[band];
  }

  if (prRateType === "Graduated Employer And Employee") {
    if (prYear === "First Year") {
      if (band === "55" || band === "60") return { total: 0.09, employee: 0.05 };
      return { total: 0.085, employee: 0.05 };
    }
    if (band === "55") return { total: 0.24, employee: 0.15 };
    if (band === "60") return { total: 0.185, employee: 0.125 };
    if (band === "65") return { total: 0.11, employee: 0.075 };
    return { total: 0.085, employee: 0.05 };
  }

  if (prYear === "First Year") {
    if (band === "55") return { total: 0.22, employee: 0.05 };
    if (band === "60") return { total: year >= 2027 ? 0.215 : 0.21, employee: 0.05 };
    if (band === "65") return { total: year >= 2027 ? 0.18 : 0.175, employee: 0.05 };
    if (band === "70") return { total: 0.14, employee: 0.05 };
    return { total: 0.125, employee: 0.05 };
  }

  if (band === "55") return { total: 0.32, employee: 0.15 };
  if (band === "60") return { total: year >= 2027 ? 0.29 : 0.285, employee: 0.125 };
  if (band === "65") return { total: year >= 2027 ? 0.205 : 0.2, employee: 0.075 };
  if (band === "70") return { total: 0.14, employee: 0.05 };
  return { total: 0.125, employee: 0.05 };
}

function monthlyCpfAmount(monthlyWage: number, rate: CpfContributionRate) {
  if (monthlyWage <= 50) return { total: 0, employee: 0 };
  const employerRate = Math.max(0, rate.total - rate.employee);
  if (monthlyWage <= 500) return { total: monthlyWage * employerRate, employee: 0 };
  if (monthlyWage <= 750) {
    const employee = rate.employee * 3 * (monthlyWage - 500);
    return { total: monthlyWage * employerRate + employee, employee };
  }
  return { total: monthlyWage * rate.total, employee: monthlyWage * rate.employee };
}

function selfEmployedMedisaveRate(age: number, annualIncome: number) {
  if (annualIncome <= 6_000) return 0;
  const maxRate = age < 35 ? 0.08 : age < 45 ? 0.09 : age < 50 ? 0.10 : 0.105;
  const lowRate = maxRate / 2;
  if (annualIncome <= 12_000) return lowRate;
  if (annualIncome <= 18_000) {
    const t = (annualIncome - 12_000) / 6_000;
    return lowRate + (maxRate - lowRate) * t;
  }
  return maxRate;
}

export function activeIncomeAnnual(inputs: RetirementInputs, age: number) {
  if (!inputs.includeCpf || inputs.cpfWorkStatus === "Not contributing" || age >= inputs.retirementAge) return 0;
  const yearsFromStart = Math.max(0, age - inputs.currentAge);
  return clampNonNegative(inputs.grossMonthlyIncome) * 12 * Math.pow(1 + percentToRate(inputs.incomeGrowthRate), yearsFromStart);
}

export function cpfContributionForYear(inputs: RetirementInputs, age: number): CpfContribution {
  const annualIncome = activeIncomeAnnual(inputs, age);
  if (!annualIncome) return { oa: 0, sa: 0, ma: 0, ra: 0, total: 0, employee: 0, employer: 0 };

  if (inputs.cpfWorkStatus === "Self-employed") {
    const estimated = annualIncome * selfEmployedMedisaveRate(age, annualIncome);
    const ma = Math.min(
      clampNonNegative(inputs.selfEmployedAnnualMedisaveOverride) || estimated,
      CPF_ANNUAL_CAP_2026
    );
    return { oa: 0, sa: 0, ma, ra: 0, total: ma, employee: ma, employer: 0 };
  }

  const year = projectionYear(inputs, age);
  const rate = cpfContributionRates(inputs.cpfResidency, inputs.cpfPrYear, inputs.cpfPrRateType, age, year);
  const allocation = cpfAllocationRates(age, year);
  const cpfWage = Math.min(8000, Math.max(0, annualIncome / 12)) * 12;
  const monthly = monthlyCpfAmount(cpfWage / 12, rate);
  const total = Math.min(monthly.total * 12, CPF_ANNUAL_CAP_2026);
  const employee = Math.min(monthly.employee * 12, total);
  const ma = total * allocation.ma;
  const retirementAllocation = total * allocation.sa;
  const oa = Math.max(0, total - ma - retirementAllocation);
  return age >= 55
    ? { oa, sa: 0, ma, ra: retirementAllocation, total, employee, employer: Math.max(0, total - employee) }
    : { oa, sa: retirementAllocation, ma, ra: 0, total, employee, employer: Math.max(0, total - employee) };
}

function cpfLifeMonthlyFromRaBase(ra: number) {
  const points = [
    [82_400, 490],
    [170_100, 950],
    [227_900, 1250],
    [330_100, 1780],
    [445_600, 2380],
    [650_100, 3440]
  ];
  if (ra <= 0) return 0;
  if (ra <= points[0][0]) return (ra / points[0][0]) * points[0][1];
  for (let index = 1; index < points.length; index += 1) {
    if (ra <= points[index][0]) {
      const a = points[index - 1];
      const b = points[index];
      const t = (ra - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  }
  return points.at(-1)![1];
}

function cpfLifeAnnual(
  inputs: RetirementInputs,
  base: number,
  startAge: number,
  age: number
) {
  let monthly = inputs.cpfLifeMonthlyOverride > 0
    ? inputs.cpfLifeMonthlyOverride
    : cpfLifeMonthlyFromRaBase(base);

  if (inputs.cpfLifeMonthlyOverride <= 0 && inputs.cpfLifePlan === "Basic") {
    monthly *= 0.86;
  }

  if (inputs.cpfLifePlan === "Escalating") {
    monthly *= (inputs.cpfLifeMonthlyOverride > 0 ? 1 : 0.78) * 1.02 ** Math.max(0, age - startAge);
  }

  return monthly * 12;
}

function cpfInterest(cpf: CpfState, age: number, lifeStarted: boolean, plan: CpfLifePlan) {
  let oa = cpf.oa * 0.025;
  let sa = cpf.sa * 0.04;
  let ma = cpf.ma * 0.04;
  let ra = lifeStarted && plan !== "Basic" ? 0 : cpf.ra * 0.04;
  const total = cpf.oa + cpf.sa + cpf.ma + cpf.ra;

  if (total > 0) {
    if (age < 55) {
      sa += Math.min(60_000, total) * 0.01;
    } else if (!lifeStarted || plan === "Basic") {
      ra += Math.min(30_000, total) * 0.02 + Math.min(30_000, Math.max(0, total - 30_000)) * 0.01;
    }
  }

  return { oa, sa, ma, ra };
}

type CpfState = {
  oa: number;
  sa: number;
  ma: number;
  ra: number;
  lifeReserve: number;
  lifeBase: number;
  raFormed: boolean;
  lifeStarted: boolean;
};

export function sanitizeInputs(inputs: RetirementInputs): RetirementInputs {
  const currentAge = Math.max(18, Math.floor(clampNonNegative(inputs.currentAge)));
  const retirementAge = Math.max(currentAge + 1, Math.floor(clampNonNegative(inputs.retirementAge)));
  const endAge = Math.max(retirementAge, Math.floor(clampNonNegative(inputs.endAge)));
  const lumpSumAge = Math.min(Math.max(currentAge, Math.floor(clampNonNegative(inputs.lumpSumAge))), endAge);
  const cpfLifeStartAge = Math.min(
    Math.max(65, Math.floor(clampNonNegative(inputs.cpfLifeStartAge))),
    endAge
  );

  return {
    ...inputs,
    currentAge,
    retirementAge,
    endAge,
    lumpSumAge,
    cpfLifeStartAge,
    currentCashSavings: clampNonNegative(inputs.currentCashSavings),
    currentInvestments: clampNonNegative(inputs.currentInvestments),
    cashSavingsContribution: clampNonNegative(inputs.cashSavingsContribution),
    investmentContribution: clampNonNegative(inputs.investmentContribution),
    contributionFrequency: "monthly",
    annualContributionIncreaseRate: Number.isFinite(inputs.annualContributionIncreaseRate)
      ? inputs.annualContributionIncreaseRate
      : 0,
    cashInterestRate: Number.isFinite(inputs.cashInterestRate) ? inputs.cashInterestRate : 0,
    preRetirementInvestmentReturnRate: Number.isFinite(inputs.preRetirementInvestmentReturnRate)
      ? inputs.preRetirementInvestmentReturnRate
      : 0,
    retirementReturnRate: Number.isFinite(inputs.retirementReturnRate) ? inputs.retirementReturnRate : 0,
    passiveIncomeYieldRate: Number.isFinite(inputs.passiveIncomeYieldRate) ? inputs.passiveIncomeYieldRate : 0,
    lumpSumAmount: clampNonNegative(inputs.lumpSumAmount),
    cpfWorkStatus: inputs.cpfWorkStatus ?? "Not contributing",
    cpfResidency: inputs.cpfResidency ?? "Singapore Citizen",
    cpfPrYear: inputs.cpfPrYear ?? "Third Year Or Later",
    cpfPrRateType: inputs.cpfPrRateType ?? "Full Employer And Employee",
    grossMonthlyIncome: clampNonNegative(inputs.grossMonthlyIncome),
    incomeGrowthRate: Number.isFinite(inputs.incomeGrowthRate) ? inputs.incomeGrowthRate : 0,
    selfEmployedAnnualMedisaveOverride: clampNonNegative(inputs.selfEmployedAnnualMedisaveOverride),
    cpfOa: clampNonNegative(inputs.cpfOa),
    cpfSa: clampNonNegative(inputs.cpfSa),
    cpfMa: clampNonNegative(inputs.cpfMa),
    cpfRa: clampNonNegative(inputs.cpfRa),
    cpfLifeMonthlyOverride: clampNonNegative(inputs.cpfLifeMonthlyOverride),
    retirementSpendingAnnual: clampNonNegative(inputs.retirementSpendingAnnual),
    retirementSpendingInflationRate: Number.isFinite(inputs.retirementSpendingInflationRate)
      ? inputs.retirementSpendingInflationRate
      : 0,
    fixedWithdrawalAnnual: clampNonNegative(inputs.fixedWithdrawalAnnual),
    dynamicWithdrawalRate: clampNonNegative(inputs.dynamicWithdrawalRate)
  };
}

function calculateAnnualContribution(inputs: RetirementInputs, age: number, amount: number): number {
  if (age >= inputs.retirementAge) return 0;
  const annualBase = amount * 12;
  const yearsFromStart = age - inputs.currentAge;
  return annualBase * Math.pow(1 + percentToRate(inputs.annualContributionIncreaseRate), yearsFromStart);
}

function calculateSpendingNeed(inputs: RetirementInputs, age: number): number {
  if (age < inputs.retirementAge) return 0;
  const yearsFromStart = age - inputs.currentAge;
  return inputs.retirementSpendingAnnual * Math.pow(1 + percentToRate(inputs.retirementSpendingInflationRate), yearsFromStart);
}

function calculateWithdrawal(
  inputs: RetirementInputs,
  openingBalance: number,
  income: number,
  spendingNeed: number,
  age: number
): number {
  if (spendingNeed <= 0) return 0;

  if (inputs.retirementIncomeMethod === "fixed") {
    const yearsFromStart = age - inputs.currentAge;
    return inputs.fixedWithdrawalAnnual * Math.pow(1 + percentToRate(inputs.retirementSpendingInflationRate), yearsFromStart);
  }

  if (inputs.retirementIncomeMethod === "dynamic") {
    return openingBalance * percentToRate(inputs.dynamicWithdrawalRate);
  }

  return Math.max(spendingNeed - income, 0);
}

function presentValueOfRetirementShortfalls(inputs: RetirementInputs, rows: RetirementYear[]) {
  const shortfallRows = rows.filter((row) => row.phase === "retirement" && row.shortfall > 0);
  if (!shortfallRows.length) return 0;

  const retirementRate = percentToRate(inputs.retirementReturnRate);
  return shortfallRows.reduce((sum, row) => {
    const yearsAfterRetirement = Math.max(0, row.age - inputs.retirementAge);
    return sum + row.shortfall / Math.pow(1 + retirementRate, yearsAfterRetirement);
  }, 0);
}

function additionalMonthlyRequiredAtRate(
  inputs: RetirementInputs,
  rows: RetirementYear[],
  annualAccumulationRate: number
) {
  const shortfallRows = rows.filter((row) => row.phase === "retirement" && row.shortfall > 0);
  if (!shortfallRows.length) return 0;

  const pvAtRetirement = presentValueOfRetirementShortfalls(inputs, rows);
  const monthlyRate = percentToRate(annualAccumulationRate) / 12;

  const monthsUntilRetirement = Math.max(0, (inputs.retirementAge - inputs.currentAge) * 12);
  if (monthsUntilRetirement <= 0) {
    const remainingMonths = Math.max(1, (inputs.endAge - inputs.currentAge + 1) * 12);
    return rows.reduce((sum, row) => sum + row.shortfall, 0) / remainingMonths;
  }

  if (monthlyRate === 0) return pvAtRetirement / monthsUntilRetirement;
  const accumulationFactor = Math.pow(1 + monthlyRate, monthsUntilRetirement) - 1;
  return (pvAtRetirement * monthlyRate) / accumulationFactor;
}

function additionalMonthlyRequired(inputs: RetirementInputs, rows: RetirementYear[]) {
  return additionalMonthlyRequiredAtRate(inputs, rows, inputs.preRetirementInvestmentReturnRate);
}

function monthlySpendingReductionRequired(inputs: RetirementInputs, rows: RetirementYear[]) {
  const totalShortfall = rows.reduce((sum, row) => sum + row.shortfall, 0);
  if (totalShortfall <= 0) return 0;

  const inflationRate = percentToRate(inputs.retirementSpendingInflationRate);
  const spendingFactor = rows.reduce((sum, row) => {
    if (row.phase !== "retirement" || row.spendingNeed <= 0) return sum;
    const yearsFromStart = Math.max(0, row.age - inputs.currentAge);
    return sum + 12 * Math.pow(1 + inflationRate, yearsFromStart);
  }, 0);

  return spendingFactor > 0 ? totalShortfall / spendingFactor : 0;
}

function formRaIfNeeded(inputs: RetirementInputs, cpf: CpfState, age: number) {
  if (!inputs.includeCpf || cpf.raFormed || age < 55) return 0;

  const target = cpfTargetForChoice(inputs.cpfRetirementSum, projectionYear(inputs, age));
  let needed = Math.max(target - cpf.ra, 0);
  const fromSa = Math.min(cpf.sa, needed);
  cpf.sa -= fromSa;
  cpf.ra += fromSa;
  needed -= fromSa;

  const fromOa = Math.min(cpf.oa, needed);
  cpf.oa -= fromOa;
  cpf.ra += fromOa;

  // CPF has closed SA for members aged 55 and above; remaining SA is treated as OA-like liquid CPF savings here.
  cpf.oa += cpf.sa;
  cpf.sa = 0;
  cpf.raFormed = true;

  return fromSa + fromOa;
}

function startCpfLifeIfNeeded(inputs: RetirementInputs, cpf: CpfState, age: number) {
  if (!inputs.includeCpf || cpf.lifeStarted || age < inputs.cpfLifeStartAge) return;
  cpf.lifeStarted = true;
  cpf.lifeBase = Math.max(cpf.ra, 0);
  cpf.lifeReserve = cpf.lifeBase;
  if (inputs.cpfLifePlan === "Basic") {
    cpf.ra *= 0.85;
    cpf.lifeReserve = cpf.ra;
  } else {
    cpf.ra = 0;
  }
}

function routeRetirementAllocation(inputs: RetirementInputs, cpf: CpfState, age: number, amount: number) {
  const value = clampNonNegative(amount);
  if (!value) return { toRa: 0, toOa: 0, toSa: 0 };

  if (cpf.lifeStarted) {
    cpf.oa += value;
    return { toRa: 0, toOa: value, toSa: 0 };
  }

  if (age < 55) {
    cpf.sa += value;
    return { toRa: 0, toOa: 0, toSa: value };
  }

  const target = cpfTargetForChoice(inputs.cpfRetirementSum, projectionYear(inputs, age));
  const toRa = Math.min(value, Math.max(0, target - cpf.ra));
  const toOa = value - toRa;
  cpf.ra += toRa;
  cpf.oa += toOa;
  return { toRa, toOa, toSa: 0 };
}

function applyMedisaveCap(inputs: RetirementInputs, cpf: CpfState, age: number) {
  const capYear = projectionYear(inputs, age >= 65 ? 65 : age);
  const cap = bhsForYear(capYear);
  if (cpf.ma <= cap) return 0;
  const overflow = cpf.ma - cap;
  cpf.ma = cap;
  routeRetirementAllocation(inputs, cpf, age, overflow);
  return overflow;
}

export function projectRetirement(rawInputs: RetirementInputs): RetirementProjection {
  const inputs = sanitizeInputs(rawInputs);
  const rows: RetirementYear[] = [];
  let cashBalance = inputs.currentCashSavings;
  let investmentBalance = inputs.currentInvestments;
  const cpf: CpfState = {
    oa: inputs.includeCpf ? inputs.cpfOa : 0,
    sa: inputs.includeCpf ? inputs.cpfSa : 0,
    ma: inputs.includeCpf ? inputs.cpfMa : 0,
    ra: inputs.includeCpf ? inputs.cpfRa : 0,
    lifeReserve: 0,
    lifeBase: 0,
    raFormed: false,
    lifeStarted: false
  };

  for (let age = inputs.currentAge; age <= inputs.endAge; age += 1) {
    const phase: RetirementYear["phase"] = age < inputs.retirementAge ? "build-up" : "retirement";
    formRaIfNeeded(inputs, cpf, age);
    startCpfLifeIfNeeded(inputs, cpf, age);
    const activeIncome = activeIncomeAnnual(inputs, age);
    const cpfContribution = inputs.includeCpf ? cpfContributionForYear(inputs, age) : { oa: 0, sa: 0, ma: 0, ra: 0, total: 0, employee: 0, employer: 0 };
    cpf.oa += cpfContribution.oa;
    cpf.ma += cpfContribution.ma;
    routeRetirementAllocation(inputs, cpf, age, cpfContribution.sa + cpfContribution.ra);
    const contributionMedisaveOverflow = inputs.includeCpf ? applyMedisaveCap(inputs, cpf, age) : 0;

    const selectedCpfRetirementSum = inputs.includeCpf
      ? cpfTargetForChoice(inputs.cpfRetirementSum, projectionYear(inputs, Math.max(age, 55)))
      : 0;
    const cpfLifeIncome = inputs.includeCpf && cpf.lifeStarted
      ? cpfLifeAnnual(inputs, cpf.lifeBase, inputs.cpfLifeStartAge, age)
      : 0;

    const openingCashSavings = Math.max(cashBalance, 0);
    const openingInvestments = Math.max(investmentBalance, 0);
    const investableOpeningBalance = openingCashSavings + openingInvestments;
    const cashContribution = calculateAnnualContribution(inputs, age, inputs.cashSavingsContribution);
    const investmentContribution = calculateAnnualContribution(inputs, age, inputs.investmentContribution);
    const lumpSum = inputs.includeLumpSum && age === inputs.lumpSumAge ? inputs.lumpSumAmount : 0;
    const cashBeforeGrowth = openingCashSavings + cashContribution;
    const investmentsBeforeGrowth = openingInvestments + investmentContribution + lumpSum;
    const savingsInterest = cashBeforeGrowth * percentToRate(inputs.cashInterestRate);
    const investmentReturnRate = phase === "build-up"
      ? inputs.preRetirementInvestmentReturnRate
      : inputs.retirementReturnRate;
    const investmentGrowth = investmentsBeforeGrowth * percentToRate(investmentReturnRate);
    const passiveIncomeGenerated = phase === "retirement"
      ? investmentsBeforeGrowth * percentToRate(inputs.passiveIncomeYieldRate)
      : 0;
    const retirementIncome = passiveIncomeGenerated + cpfLifeIncome;
    const spendingNeed = calculateSpendingNeed(inputs, age);
    const desiredWithdrawal = phase === "retirement"
      ? calculateWithdrawal(inputs, investableOpeningBalance, retirementIncome, spendingNeed, age)
      : 0;
    const cashAvailableForWithdrawal = cashBeforeGrowth + savingsInterest;
    const investmentsAvailableForWithdrawal = investmentsBeforeGrowth + investmentGrowth;
    const cashWithdrawal = Math.min(desiredWithdrawal, cashAvailableForWithdrawal);
    const investmentWithdrawal = Math.min(
      Math.max(desiredWithdrawal - cashWithdrawal, 0),
      investmentsAvailableForWithdrawal
    );
    const gapAfterCashAndInvestments = phase === "retirement"
      ? Math.max(spendingNeed - retirementIncome - cashWithdrawal - investmentWithdrawal, 0)
      : 0;
    const cpfSaDrawdown = inputs.includeCpf ? Math.min(cpf.sa, gapAfterCashAndInvestments) : 0;
    cpf.sa -= cpfSaDrawdown;
    const cpfOaDrawdown = inputs.includeCpf
      ? Math.min(cpf.oa, Math.max(gapAfterCashAndInvestments - cpfSaDrawdown, 0))
      : 0;
    cpf.oa -= cpfOaDrawdown;
    const cpfDrawdown = cpfSaDrawdown + cpfOaDrawdown;
    const withdrawal = cashWithdrawal + investmentWithdrawal + cpfDrawdown;
    const shortfall = phase === "retirement"
      ? Math.max(spendingNeed - retirementIncome - withdrawal, 0)
      : 0;
    const endingCashSavings = Math.max(cashAvailableForWithdrawal - cashWithdrawal, 0);
    const endingInvestments = Math.max(investmentsAvailableForWithdrawal - investmentWithdrawal, 0);

    if (inputs.includeCpf) {
      if (cpf.lifeStarted) {
        if (inputs.cpfLifePlan === "Basic") {
          cpf.ra = Math.max(0, cpf.ra - cpfLifeIncome);
          cpf.lifeReserve = cpf.ra;
        } else {
          cpf.lifeReserve = Math.max(0, cpf.lifeReserve - cpfLifeIncome);
        }
      }

      const interest = cpfInterest(cpf, age, cpf.lifeStarted, inputs.cpfLifePlan);
      cpf.oa += interest.oa;
      cpf.sa += interest.sa;
      cpf.ma += interest.ma;
      cpf.ra += interest.ra;
      applyMedisaveCap(inputs, cpf, age);
      if (inputs.cpfLifePlan === "Basic") cpf.lifeReserve = cpf.ra;
    }

    const cpfTotal = cpf.oa + cpf.sa + cpf.ma + cpf.ra;
    const endingBalance = endingCashSavings + endingInvestments + cpfTotal;

    rows.push({
      age,
      yearIndex: age - inputs.currentAge,
      phase,
      openingBalance: investableOpeningBalance + cpfTotal,
      openingCashSavings,
      openingInvestments,
      cashContribution,
      investmentContribution,
      lumpSum,
      savingsInterest,
      investmentGrowth,
      activeIncomeAnnual: activeIncome,
      cpfEmployeeContribution: cpfContribution.employee,
      cpfEmployerContribution: cpfContribution.employer,
      cpfTotalContribution: cpfContribution.total,
      cpfOaContribution: cpfContribution.oa,
      cpfSaContribution: cpfContribution.sa,
      cpfMaContribution: cpfContribution.ma,
      cpfRaContribution: cpfContribution.ra,
      medisaveOverflow: contributionMedisaveOverflow,
      passiveIncomeGenerated,
      cpfLifeIncome,
      spendingNeed,
      cashWithdrawal,
      investmentWithdrawal,
      cpfSaDrawdown,
      cpfOaDrawdown,
      cpfDrawdown,
      withdrawal,
      shortfall,
      endingCashSavings,
      endingInvestments,
      cpfOa: cpf.oa,
      cpfSa: cpf.sa,
      cpfMa: cpf.ma,
      cpfRa: cpf.ra,
      cpfLifeReserve: cpf.lifeReserve,
      cpfTotal,
      selectedCpfRetirementSum,
      endingBalance,
      funded: shortfall <= 0
    });

    cashBalance = endingCashSavings;
    investmentBalance = endingInvestments;
  }

  const finalRow = rows[rows.length - 1];
  const firstShortfall = rows.find((row) => row.phase === "retirement" && row.shortfall > 0);
  const peakRow = rows.reduce((best, row) => (row.endingBalance > best.endingBalance ? row : best), rows[0]);
  const totalContributed = rows.reduce((sum, row) => sum + row.cashContribution + row.investmentContribution + row.lumpSum, 0);
  const totalSavingsInterest = rows.reduce((sum, row) => sum + row.savingsInterest, 0);
  const totalGrowth = rows.reduce((sum, row) => sum + row.investmentGrowth, 0);
  const totalCpfContributions = rows.reduce((sum, row) => sum + row.cpfTotalContribution, 0);
  const totalWithdrawn = rows.reduce((sum, row) => sum + row.withdrawal, 0);
  const totalCpfDrawdown = rows.reduce((sum, row) => sum + row.cpfDrawdown, 0);
  const totalPassiveIncome = rows.reduce((sum, row) => sum + row.passiveIncomeGenerated, 0);
  const totalCpfLifeIncome = rows.reduce((sum, row) => sum + row.cpfLifeIncome, 0);
  const totalShortfall = rows.reduce((sum, row) => sum + row.shortfall, 0);
  const totalRetirementNeed = rows.reduce((sum, row) => sum + row.spendingNeed, 0);
  const totalFundedRetirementNeed = Math.max(0, totalRetirementNeed - totalShortfall);
  const readinessPercent = totalRetirementNeed > 0
    ? Math.min(100, (totalFundedRetirementNeed / totalRetirementNeed) * 100)
    : 100;
  const additionalMonthly = additionalMonthlyRequired(inputs, rows);
  const extraMonthlyCashSavingsRequired = additionalMonthlyRequiredAtRate(inputs, rows, inputs.cashInterestRate);
  const monthlySpendingReduction = monthlySpendingReductionRequired(inputs, rows);
  const retirementRow = rows.find((row) => row.age === inputs.retirementAge);
  const retirementIncomeAtStart = (retirementRow?.passiveIncomeGenerated ?? 0) + (retirementRow?.cpfLifeIncome ?? 0);
  const incomeCoverageAtRetirement = retirementRow && retirementRow.spendingNeed > 0
    ? Math.min(100, (retirementIncomeAtStart + retirementRow.withdrawal) / retirementRow.spendingNeed * 100)
    : 100;
  const cpfLifeStartRow = rows.find((row) => row.age === inputs.cpfLifeStartAge);

  const summary: RetirementSummary = {
    status: firstShortfall ? "not-ready" : "ready",
    headline: firstShortfall
      ? `Not ready yet: shortfall starts at age ${firstShortfall.age}`
      : `Ready through age ${inputs.endAge}`,
    readinessPercent,
    additionalMonthlyRequired: additionalMonthly,
    extraMonthlyCashSavingsRequired,
    extraMonthlyInvestmentRequired: additionalMonthly,
    monthlySpendingReductionRequired: monthlySpendingReduction,
    runwayAge: firstShortfall ? Math.max(inputs.retirementAge, firstShortfall.age - 1) : inputs.endAge,
    finalBalance: finalRow.endingBalance,
    peakBalance: peakRow.endingBalance,
    peakBalanceAge: peakRow.age,
    totalRetirementNeed,
    totalFundedRetirementNeed,
    firstShortfallAge: firstShortfall?.age ?? null,
    totalContributed,
    totalSavingsInterest,
    totalGrowth,
    totalCpfContributions,
    totalWithdrawn,
    totalCpfDrawdown,
    totalPassiveIncome,
    totalCpfLifeIncome,
    totalShortfall,
    incomeCoverageAtRetirement,
    cpfLifeMonthlyAtStart: (cpfLifeStartRow?.cpfLifeIncome ?? 0) / 12,
    cpfRetirementSumAt55: cpfTargetForChoice(inputs.cpfRetirementSum, projectionYear(inputs, 55))
  };

  return { rows, summary };
}
