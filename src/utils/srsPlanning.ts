import type { RetirementInputs, SrsWithdrawalStrategy } from "../types";

export function taxOnIncome(amount: number, resident: boolean) {
  let remaining = Math.max(0, amount), total = 0;
  if (!resident) return remaining * 0.24;
  const brackets = [[20000,0],[10000,.02],[10000,.035],[40000,.07],[40000,.115],[40000,.15],[40000,.18],[40000,.19],[40000,.195],[40000,.20],[180000,.22],[500000,.23],[Infinity,.24]];
  for (const [width, rate] of brackets) { const used = Math.min(remaining,width); total += used * rate; remaining -= used; if (remaining <= 0) break; }
  return total;
}

export function otherTaxableIncomeForAge(inputs: RetirementInputs, age: number) {
  const value = inputs.otherTaxableIncome;
  if (!value || age < inputs.retirementAge || age < value.startAge || age > value.endAge) return 0;
  return Math.max(0,value.annualAmount) * (1 + Math.max(-99, value.growthRate || 0) / 100) ** Math.max(0,age - inputs.currentAge);
}

export function retirementTaxForYear(inputs: RetirementInputs, age: number, srsWithdrawal: number) {
  const otherIncome = otherTaxableIncomeForAge(inputs, age);
  const resident = inputs.retirementTaxResidency ? inputs.retirementTaxResidency === "Resident" : inputs.srsResidency !== "Foreigner";
  const otherTax = taxOnIncome(otherIncome, resident);
  const totalTax = taxOnIncome(otherIncome + srsWithdrawal / 2, resident);
  return { otherIncome, otherTax, totalTax, srsTax: Math.max(0,totalTax-otherTax) };
}

export function srsContributionForAge(inputs: RetirementInputs, age: number) {
  const cap = inputs.srsResidency === "Foreigner" ? 35700 : 15300;
  return inputs.includeSrs && age >= (inputs.srsContributionStartAge ?? inputs.currentAge)
    && age <= inputs.srsContributionEndAge && age < inputs.srsFirstWithdrawalAge
    ? Math.min(cap,Math.max(0,inputs.srsAnnualContribution)) : 0;
}

// Smooth total taxable income across the remaining window, accounting for SRS
// growth. This is a comparison heuristic, not a globally optimal tax strategy.
export function srsWithdrawalForAge(inputs: RetirementInputs, age: number, balance: number, openingWindowBalance: number, strategy = inputs.srsWithdrawalStrategy) {
  const index = age - inputs.srsFirstWithdrawalAge;
  if (!inputs.includeSrs || index < 0 || index >= 10) return 0;
  if (index === 9) return balance;
  if (strategy === "Even Over Ten Years") return Math.min(balance,openingWindowBalance / 10);
  const years = 10-index, growth = 1 + Math.max(0,inputs.srsReturnRate) / 100;
  const other = Array.from({length:years},(_,i)=>otherTaxableIncomeForAge(inputs,age+i));
  let low = 0, high = Math.max(...other) + balance * Math.max(1,growth ** years);
  for(let n=0;n<70;n++) {
    const target = (low+high)/2;
    const presentValue = other.reduce((sum,income,i)=>sum + Math.max(i===0 ? 1 : 0,2*(target-income))/growth**i,0);
    if(presentValue>balance) high=target; else low=target;
  }
  return Math.min(balance,Math.max(1,2*((low+high)/2-other[0])));
}

export function compareSrsStrategies(inputs: RetirementInputs) {
  const compare = (strategy: SrsWithdrawalStrategy) => {
    let balance = Math.max(0,inputs.srsCurrentBalance), base=0, totalTax=0, gross=0, atRetirement=0;
    const rows=[];
    const start = Math.max(inputs.currentAge,inputs.srsFirstWithdrawalAge);
    const end = start+9;
    for(let age=inputs.currentAge;age<=end;age++) {
      if(age===inputs.retirementAge) atRetirement=balance;
      balance += srsContributionForAge(inputs,age);
      balance *= 1+Math.max(0,inputs.srsReturnRate)/100;
      if(age===start) base=balance;
      const withdrawal=srsWithdrawalForAge(inputs,age,balance,base,strategy);
      balance-=withdrawal;
      const tax=retirementTaxForYear(inputs,age,withdrawal);
      if(age>=start) {totalTax+=tax.srsTax;gross+=withdrawal;rows.push({age,withdrawal,tax:tax.srsTax,net:withdrawal-tax.srsTax,balance});}
    }
    return {strategy,atRetirement,atWithdrawal:base,totalTax,gross,net:gross-totalTax,rows};
  };
  const smooth=compare("Tax Aware"), even=compare("Even Over Ten Years");
  return {smooth,even,recommended:smooth.totalTax<=even.totalTax ? smooth.strategy:even.strategy};
}
