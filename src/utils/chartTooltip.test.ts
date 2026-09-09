import { describe, expect, it } from "vitest";
import { meaningfulChartItems } from "./chartTooltip";

describe("chart tooltip filtering", () => {
  it("hides zero and rounded-to-zero sources", () => {
    const visible = meaningfulChartItems([
      { name: "CPF LIFE", value: 24_000 },
      { name: "Cash", value: 0 },
      { name: "Tiny rounding remainder", value: 0.49 },
      { name: "Refund", value: -500 }
    ]);
    expect(visible.map((item) => item.name)).toEqual(["CPF LIFE", "Refund"]);
  });
});
