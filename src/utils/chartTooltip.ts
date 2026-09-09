export function meaningfulChartItems<T extends { value?: unknown }>(items: T[] | undefined) {
  return (items ?? []).filter((item) => {
    const value = Number(item.value);
    return Number.isFinite(value) && Math.abs(value) >= 0.5;
  });
}
