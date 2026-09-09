import type { RetirementInputs } from "../types";

export const lifestyleBudgets = [
  { label: "Essentials-focused", single: 2500, couple: 4000, shares: [0.30, 0.16, 0.12, 0.16, 0.26] },
  { label: "Comfortable", single: 3500, couple: 6000, shares: [0.26, 0.14, 0.12, 0.16, 0.32] },
  { label: "More flexibility", single: 5500, couple: 8500, shares: [0.22, 0.12, 0.14, 0.14, 0.38] }
];
export const budgetCategories = ["Food & groceries", "Home running costs", "Transport", "Healthcare allowance", "Leisure, travel & personal spending"];

export function dependantSpendingForYear(profile: RetirementInputs["spendingProfile"], yearsFromNow: number, inflation: number) {
  return (profile?.dependants ?? []).filter(person => [person.currentAge, person.supportUntilAge, person.monthlyAmountToday].every(Number.isFinite)).reduce((sum, person) => person.currentAge + yearsFromNow < person.supportUntilAge
    ? sum + Math.max(0, person.monthlyAmountToday) * 12 * (1 + inflation / 100) ** yearsFromNow : sum, 0);
}
