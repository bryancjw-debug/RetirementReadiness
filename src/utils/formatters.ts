export function formatCurrency(value: number, options: { compact?: boolean } = {}): string {
  const absValue = Math.abs(value);
  if (options.compact && absValue >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (options.compact && absValue >= 1_000) return `$${Math.round(value / 1_000)}K`;

  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 0 }).format(value);
}
