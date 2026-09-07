export interface InvestmentMixItem {
  label: string;
  amount: number;
  returnRate: number;
  incomeYield: number;
}

export function calculateInvestmentMix(items: InvestmentMixItem[]) {
  if (!items.length || items.some(item => !Number.isFinite(item.amount) || item.amount < 0 ||
    !Number.isFinite(item.returnRate) || item.returnRate <= -100 || item.returnRate > 100 ||
    !Number.isFinite(item.incomeYield) || item.incomeYield < 0 || item.incomeYield > 100)) return null;
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) return null;
  const totalReturn = items.reduce((sum, item) => sum + item.amount / total * item.returnRate, 0);
  const incomeYield = items.reduce((sum, item) => sum + item.amount / total * item.incomeYield, 0);
  return { total, totalReturn, incomeYield, capitalGrowth: totalReturn - incomeYield };
}
