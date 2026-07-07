import type {
  CpfLifePlan,
  RetirementInputs,
  RetirementProjection,
  RetirementSumChoice,
  RetirementSummary,
  RetirementYear
} from "../types";

const CURRENT_POLICY_YEAR = 2026;

const clampNonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

const percentToRate = (value: number) => (Number.isFinite(value) ? value / 100 : 0);

export const defaultInputs: RetirementInputs = {
  currentAge: 35,
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
  includeCpf: false,
  cpfOa: 0,
  cpfSa: 0,
  cpfMa: 0,
  cpfRa: 0,
  cpfLifeStartAge: 65,
  cpfRetirementSum: "Full",
  cpfLifePlan: "Standard",
  cpfLifeMonthlyOverride: 0,
  retirementSpendingAnnual: 60_000,
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

function projectionYear(inputs: RetirementInputs, age: number) {
  return CURRENT_POLICY_YEAR + Math.max(0, age - inputs.currentAge);
}

function cpfTargetForChoice(choice: RetirementSumChoice, year: number) {
  const sums = retirementSumsForYear(year);
  if (choice === "Basic") return sums.brs;
  if (choice === "Enhanced") return sums.ers;
  return sums.frs;
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
  age: number,
  raBalance = base
) {
  let monthly = inputs.cpfLifeMonthlyOverride > 0
    ? inputs.cpfLifeMonthlyOverride
    : cpfLifeMonthlyFromRaBase(base);

  if (inputs.cpfLifeMonthlyOverride <= 0 && inputs.cpfLifePlan === "Basic") {
    monthly *= 0.86;
    if (raBalance < 60_000) monthly *= 0.9 + (0.1 * Math.max(0, raBalance)) / 60_000;
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
  const annualBase = amount * (inputs.contributionFrequency === "monthly" ? 12 : 1);
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

    const selectedCpfRetirementSum = inputs.includeCpf
      ? cpfTargetForChoice(inputs.cpfRetirementSum, projectionYear(inputs, Math.max(age, 55)))
      : 0;
    const cpfLifeIncome = inputs.includeCpf && cpf.lifeStarted
      ? cpfLifeAnnual(inputs, cpf.lifeBase, inputs.cpfLifeStartAge, age, cpf.ra)
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
    const withdrawal = cashWithdrawal + investmentWithdrawal;
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
      passiveIncomeGenerated,
      cpfLifeIncome,
      spendingNeed,
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
  const totalWithdrawn = rows.reduce((sum, row) => sum + row.withdrawal, 0);
  const totalPassiveIncome = rows.reduce((sum, row) => sum + row.passiveIncomeGenerated, 0);
  const totalCpfLifeIncome = rows.reduce((sum, row) => sum + row.cpfLifeIncome, 0);
  const totalShortfall = rows.reduce((sum, row) => sum + row.shortfall, 0);
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
    runwayAge: firstShortfall ? Math.max(inputs.retirementAge, firstShortfall.age - 1) : inputs.endAge,
    finalBalance: finalRow.endingBalance,
    peakBalance: peakRow.endingBalance,
    peakBalanceAge: peakRow.age,
    firstShortfallAge: firstShortfall?.age ?? null,
    totalContributed,
    totalSavingsInterest,
    totalGrowth,
    totalWithdrawn,
    totalPassiveIncome,
    totalCpfLifeIncome,
    totalShortfall,
    incomeCoverageAtRetirement,
    cpfLifeMonthlyAtStart: (cpfLifeStartRow?.cpfLifeIncome ?? 0) / 12,
    cpfRetirementSumAt55: cpfTargetForChoice(inputs.cpfRetirementSum, projectionYear(inputs, 55))
  };

  return { rows, summary };
}
