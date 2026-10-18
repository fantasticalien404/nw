import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCashflowWorkbook } from "@/lib/sheets/cashflow";

const CASHFLOW_HEADER = ["DATE", "TYPE", "NAME", "AMOUNT", "CURRENCY", "CATEGORY", "SUBCATEGORY", "NOTES"];
const CATEGORY_HEADER = ["CATEGORY", "PARENT_CATEGORY", "IS_ESSENTIAL", "IS_RECURRING"];
const JAN_15_2026 = 46_037;

function tabs(overrides: Partial<Parameters<typeof parseCashflowWorkbook>[0]> = {}) {
  return {
    cashflowRows: [
      CASHFLOW_HEADER,
      [JAN_15_2026, "Expense", "Landlord", 1000, "chf", "Rent", "", ""],
      [JAN_15_2026, "income", "Employer", 5000, "DOL", "Salary", "", ""],
      [JAN_15_2026, "contribution", "Broker", 300, "EUR"],
    ],
    categoryRows: [CATEGORY_HEADER, ["Rent", "Housing", true, true], ["Salary", "Income", "", ""]],
    constantRows: [["CURRENCY_1", "chf"], ["CURRENCY_2", "DOL"], ["CURRENCY_3", "CHF"], ["FIRE target", 1_500_000]],
    ...overrides,
  };
}

describe("parseCashflowWorkbook", () => {
  it("normalises types, currencies, dates, categories and flags", () => {
    const workbook = parseCashflowWorkbook(tabs());
    assert.deepEqual(workbook.transactions, [
      { date: "2026-01-15", type: "expense", amount: 1000, currency: "CHF", category: "Rent" },
      { date: "2026-01-15", type: "income", amount: 5000, currency: "USD", category: "Salary" },
      { date: "2026-01-15", type: "contribution", amount: 300, currency: "EUR", category: null },
    ]);
    assert.deepEqual(workbook.categories, [
      { category: "Rent", parentCategory: "Housing", isEssential: true, isRecurring: true },
      { category: "Salary", parentCategory: "Income", isEssential: false, isRecurring: false },
    ]);
  });

  it("reads CURRENCY_1..3 as unique valid codes, keeping DOL as USD and ignoring other constants", () => {
    assert.deepEqual(parseCashflowWorkbook(tabs()).reportingCurrencies, ["CHF", "USD"]);
    assert.deepEqual(
      parseCashflowWorkbook(tabs({ constantRows: [["CURRENCY_1", "EUR"], ["CURRENCY_2", "dollars"], ["CURRENCY_3", "GBP"]] })).reportingCurrencies,
      ["EUR", "GBP"],
    );
  });

  it("matches headers case-insensitively and accepts CITY as the legacy seventh header", () => {
    const header = ["date", "TYPE", "Name", "amount", "currency", "category", "CITY", "notes"];
    assert.equal(parseCashflowWorkbook(tabs({ cashflowRows: [header] })).transactions.length, 0);
  });

  it("rejects invalid headers", () => {
    assert.throws(() => parseCashflowWorkbook(tabs({ cashflowRows: [CASHFLOW_HEADER.slice(0, 7)] })), /cashflow tab has invalid headers/);
    assert.throws(() => parseCashflowWorkbook(tabs({ cashflowRows: [] })), /cashflow tab has invalid headers/);
    assert.throws(() => parseCashflowWorkbook(tabs({ categoryRows: [["CATEGORY", "PARENT"]] })), /categories tab has invalid headers/);
  });

  it("rejects incomplete, duplicate and non-boolean categories", () => {
    const withCategories = (...rows: unknown[][]) => tabs({ categoryRows: [CATEGORY_HEADER, ...rows] });
    assert.throws(() => parseCashflowWorkbook(withCategories(["Rent", ""])), /incomplete category/);
    assert.throws(() => parseCashflowWorkbook(withCategories(["Rent", "Housing"], ["Rent", "Other"])), /duplicate category: Rent/);
    assert.throws(() => parseCashflowWorkbook(withCategories(["Rent", "Housing", false])), /TRUE or blank/);
    assert.throws(() => parseCashflowWorkbook(withCategories(["Rent", "Housing", "", "yes"])), /TRUE or blank/);
  });

  it("reports the sheet row number of an invalid transaction", () => {
    const withRow = (row: unknown[]) => tabs({ cashflowRows: [CASHFLOW_HEADER, [JAN_15_2026, "expense", "ok", 1, "CHF"], row] });
    assert.throws(() => parseCashflowWorkbook(withRow([JAN_15_2026, "refund", "x", 1, "CHF"])), /invalid type on row 3/);
    assert.throws(() => parseCashflowWorkbook(withRow([JAN_15_2026, "expense", "x", -1, "CHF"])), /invalid transaction on row 3/);
    assert.throws(() => parseCashflowWorkbook(withRow([JAN_15_2026, "expense", "x", "abc", "CHF"])), /invalid transaction on row 3/);
    assert.throws(() => parseCashflowWorkbook(withRow([JAN_15_2026, "expense", "x", 1, "FRANC"])), /invalid transaction on row 3/);
    assert.throws(() => parseCashflowWorkbook(withRow([JAN_15_2026, "expense", "x", 1, "CHF", "Holiday"])), /unknown category on row 3: Holiday/);
    assert.throws(() => parseCashflowWorkbook(withRow(["soon", "expense", "x", 1, "CHF"])), /invalid date/);
  });

  it("requires CURRENCY_1", () => {
    assert.throws(() => parseCashflowWorkbook(tabs({ constantRows: [["FIRE target", 1_500_000]] })), /Set CURRENCY_1/);
  });
});
