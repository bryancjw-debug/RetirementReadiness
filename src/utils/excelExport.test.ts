import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildProjectionWorkbook } from "./excelExport";
import { defaultInputs, projectRetirement } from "./projection";
import { createDefaultHouseholdPlan } from "../household";
import { projectHousehold } from "./householdProjection";

describe("Excel projection snapshot", () => {
  it("roundtrips numbers, freezes headers and reconciles funding to the model", async () => {
    const projection = projectRetirement(defaultInputs);
    const workbook = buildProjectionWorkbook({ inputs: defaultInputs, projection });
    const saved = await workbook.xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(saved);
    expect(reopened.worksheets).toHaveLength(6);
    const annual = reopened.getWorksheet("Annual Projection")!;
    const headers = annual.getRow(3).values as string[];
    expect(annual.getRow(4).getCell(headers.indexOf("Ending Investments")).value).toBeCloseTo(projection.rows[0].endingInvestments);
    expect(annual.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    const funding = reopened.getWorksheet("Spending Funding")!;
    const names = funding.getRow(3).values as string[];
    for (let index = 4; index <= funding.rowCount; index++) {
      const row = funding.getRow(index);
      const value = (name: string) => Number(row.getCell(names.indexOf(name)).value);
      expect(["CPF Life", "Dividends", "Custom Income", "SRS", "Cash", "Investments", "CPF", "Shortfall"].reduce((sum, name) => sum + value(name), 0)).toBeCloseTo(value("Spending"), 5);
    }
  });
  it("exports household resources once and separates each person's CPF", () => {
    const household = createDefaultHouseholdPlan();
    const workbook = buildProjectionWorkbook({ household, householdProjection: projectHousehold(household) });
    expect(workbook.getWorksheet("Annual Household")).toBeDefined();
    expect(workbook.getWorksheet("Person 1 CPF and Income")).toBeDefined();
    expect(workbook.getWorksheet("Person 2 CPF and Income")).toBeDefined();
  });
});
