import ExcelJS from "exceljs";
import type { RetirementInputs, RetirementProjection } from "../types";
import type { HouseholdPlan } from "../household";
import type { HouseholdProjection } from "./householdProjection";
import { buildRetirementFundingRows } from "./fundingChart";

export type ExportData = { inputs: RetirementInputs; projection: RetirementProjection; household?: never; householdProjection?: never }
  | { household: HouseholdPlan; householdProjection: HouseholdProjection; inputs?: never; projection?: never };

function readable(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/cpf/gi, "CPF").replace(/srs/gi, "SRS").replace(/\b(oa|sa|ma|ra)\b/gi, text => text.toUpperCase()).replace(/^./, text => text.toUpperCase());
}

function flatEntries(value: object, prefix = ""): Array<{ field: string; value: string | number | boolean }> {
  return Object.entries(value).flatMap(([key, item]) => {
    const field = prefix ? `${prefix} / ${readable(key)}` : readable(key);
    if (item !== null && typeof item === "object") return flatEntries(item, field);
    return [{ field, value: item ?? "Not set" }];
  });
}

function addSheet(workbook: ExcelJS.Workbook, name: string, records: object[], note: string) {
  const sheet = workbook.addWorksheet(name);
  const keys = [...new Set(records.flatMap(record => Object.keys(record)))];
  if (!keys.length) keys.push("details");
  sheet.columns = keys.map(key => ({ key, width: key === "field" || key === "details" ? 52 : 25 }));
  sheet.addRow([name]);
  sheet.mergeCells(1, 1, 1, Math.max(2, keys.length));
  sheet.addRow([note]);
  sheet.mergeCells(2, 1, 2, Math.max(2, keys.length));
  sheet.getRow(2).height = 55;
  sheet.getRow(2).alignment = { wrapText: true, vertical: "middle" };
  sheet.addRow(keys.map(readable));
  for (const record of records) {
    const data = record as Record<string, unknown>;
    const row = sheet.addRow(keys.map(key => {
      const value = data[key];
      return value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value;
    }));
    row.eachCell((cell, index) => {
      const key = keys[index - 1];
      if (typeof cell.value === "number") cell.numFmt = /^(age|yearIndex|calendarYear|year)$/.test(key) ? "0" : "#,##0.00;[Red](#,##0.00)";
      cell.alignment = { vertical: "top", wrapText: true };
    });
  }
  for (const index of [1, 3]) {
    const row = sheet.getRow(index);
    row.height = index === 1 ? 30 : 42;
    row.eachCell(cell => { cell.font = { name: "Calibri", bold: true, color: { argb: "FFFFFFFF" }, size: index === 1 ? 16 : 11 }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF285D70" } }; cell.alignment = { wrapText: true, vertical: "middle" }; });
  }
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 3 }];
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, sheet.rowCount), column: keys.length } };
  sheet.properties.defaultRowHeight = 24;
  return sheet;
}

export function buildProjectionWorkbook(data: ExportData, created = new Date()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RetirementReadiness";
  workbook.created = created;
  const summary = data.projection?.summary ?? data.householdProjection!.summary;
  addSheet(workbook, "Summary", flatEntries(summary), "Calculated snapshot, not a recalculating spreadsheet. Currency: SGD. Summary totals span the projection unless an age/year or monthly amount is specified. Readiness percent is a percentage, not a probability.");
  addSheet(workbook, "Inputs and Assumptions", [
    { field: "Exported at (UTC)", value: created.toISOString() },
    { field: "Export format version", value: "2026-09-rates-and-mix-v1" },
    { field: "Value basis", value: "Future (nominal) SGD, regardless of chart display toggle" },
    { field: "Timing", value: "Annual model: monthly contributions are multiplied by 12 and receive a full year's growth. Pre-retirement total return includes reinvested income; retirement capital growth and paid income are separate." },
    { field: "Rate units", value: "Rates are annual percentage points: 5 means 5%, not 500%. Amounts in SGD; fields containing Monthly or Annual specify frequency." },
    { field: "Insurance cash accounting", value: "Insurance Cash Premium is the modelled cash requirement. Insurance Cash Expense is only the additional deduction after budget inclusion choices, plus any unpaid MediSave portion. Allowance mode excludes unestimated private IP cash premiums; include those in your budget." },
    ...flatEntries(data.inputs ?? data.household!)
  ], "Complete inputs, including inactive settings. Inclusion toggles determine which inputs affect this projection. Mixtures are estimates with stable allocation, not separately simulated holdings.");
  if (data.projection) {
    const rows = data.projection.rows;
    addSheet(workbook, "Annual Projection", rows, "Flows are annual SGD. Opening balances are start-of-year; ending balances and CPF/SRS balances are end-of-year. Year index 0 is the first modelled year. CPF MA and LIFE reserves are tracked resources, not spendable cash.");
    addSheet(workbook, "Spending Funding", buildRetirementFundingRows(rows), "Annual future SGD, matching the funding chart. CPF = eligible OA/SA drawdown. Funding sources plus shortfall equal spending. Surplus income is separate and is not added to spending funding. SRS gross, net and tax are information columns, not additional funding sources. Tax is reserved in the same modelled year.");
    addSheet(workbook, "CPF Details", rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => /^(age|yearIndex|cpf|medisave|selectedCpf)/.test(key)))), "CPF balances and LIFE reserve are end-of-year; contributions, housing usage, medical premiums and drawdowns are annual SGD. The selected retirement sum is a target, not an extra balance. Interest is embedded in balances; separate interest amounts are not exposed by this model.");
    addSheet(workbook, "Income and Events", rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => /^(age|yearIndex|srs|oneTime|lumpSum|custom|passive|cpfLifeIncome|activeIncome|other|totalIncomeTax|dependant)/.test(key)))), "Annual future SGD. SRS balance is the end-of-year balance. SRS net withdrawals and transfer-to-cash describe related movements and must not be counted as two income streams. Event and income inputs are in Inputs and Assumptions.");
  } else {
    const projection = data.householdProjection!;
    addSheet(workbook, "Annual Household", projection.rows.map(({ people: _people, ...row }) => row), "Annual household flows and year-end balances in future SGD. Shared cash and investments are counted once. Total tracked resources include restricted CPF balances.");
    for (const index of [0, 1] as const) {
      addSheet(workbook, `Person ${index + 1} CPF and Income`, projection.rows.map(row => ({ calendarYear: row.calendarYear, ...row.people[index] })), `${data.household!.people[index].label}: CPF and SRS balances are end-of-year; income, contributions, deductions and withdrawals are annual SGD. Shared assets are shown in Annual Household.`);
    }
  }
  return workbook;
}

export async function downloadProjectionWorkbook(data: ExportData) {
  const bytes = await buildProjectionWorkbook(data).xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `RetirementReadiness-${data.household ? "Household-" : ""}${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
