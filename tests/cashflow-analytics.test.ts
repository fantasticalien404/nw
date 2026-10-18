import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCashflowReport,
  buildExpenseMovingAverage,
  expensesExcluding,
  isSalary,
  isWithdrawal,
  periodsInRange,
} from "@/lib/analytics/cashflow";
import type { CashflowCategory, ConvertedCashflowTransaction } from "@/types/workbook";

const categories: CashflowCategory[] = [
  { category: "Salary", parentCategory: "Income", isEssential: false, isRecurring: true },
  { category: "Allowance", parentCategory: "Income", isEssential: false, isRecurring: false },
  { category: "Rent", parentCategory: "Housing", isEssential: true, isRecurring: true },
  { category: "Doctor", parentCategory: "Health", isEssential: true, isRecurring: false },
  { category: "Food", parentCategory: "Food", isEssential: false, isRecurring: true },
  { category: "Dining", parentCategory: "Food", isEssential: false, isRecurring: false },
];
const transactions: ConvertedCashflowTransaction[] = [
  { date: "2026-01-05", type: "contribution", amount: 9_999, category: null },
  { date: "2026-01-10", type: "income", amount: 3_000, category: "salary" },
  { date: "2026-01-15", type: "income", amount: 200, category: "Allowance" },
  { date: "2026-01-20", type: "expense", amount: 1_000, category: "Rent" },
  { date: "2026-01-21", type: "expense", amount: 300, category: "Doctor" },
  { date: "2026-01-22", type: "expense", amount: 200, category: "Food" },
  { date: "2026-02-01", type: "expense", amount: 100, category: "Dining" },
  { date: "2026-04-02", type: "expense", amount: 50, category: null },
];
const report = buildCashflowReport(transactions, categories);

describe("buildCashflowReport", () => {
  it("lists sorted categories, excluding contributions", () => {
    assert.deepEqual(report.incomeCategories, ["Allowance", "salary"]);
    assert.deepEqual(report.expenseCategories, ["Dining", "Doctor", "Food", "Rent"]);
    assert.deepEqual(report.parentCategories, ["Food", "Health", "Housing"]);
  });

  it("builds one period per month from the first to the last transaction", () => {
    assert.deepEqual(report.periods.map((period) => period.period), ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("totals income, expenses, savings and savings rate per month", () => {
    const [january, february] = report.periods;
    assert.equal(january.income, 3_200);
    assert.equal(january.expenses, 1_500);
    assert.equal(january.savings, 1_700);
    assert.equal(january.savingsRate, 1_700 / 3_200);
    assert.equal(january.salary, 3_000);
    assert.deepEqual(january.incomeCategories, { Allowance: 200, salary: 3_000 });
    assert.deepEqual(january.expenseCategories, { Dining: 0, Doctor: 300, Food: 200, Rent: 1_000 });
    assert.deepEqual(january.categories, { Food: 200, Health: 300, Housing: 1_000 });
    assert.equal(february.savings, -100);
    assert.equal(february.savingsRate, null, "no income, no savings rate");
  });

  it("leaves months without transactions null, so tables show a dash and charts a gap", () => {
    const march = report.periods[2];
    assert.equal(march.income, null);
    assert.equal(march.expenses, null);
    assert.equal(march.savings, null);
    assert.deepEqual(march.incomeCategories, { Allowance: null, salary: null });
    assert.deepEqual(march.categories, { Food: null, Health: null, Housing: null });
  });

  it("counts expenses without a category as unclassified and keeps them out of category breakdowns", () => {
    assert.equal(report.unclassifiedExpenses, 50);
    assert.equal(report.periods[3].expenses, 50);
    assert.equal(report.expenseTransactions.length, 4);
  });

  it("describes each categorised expense with its parent and classification", () => {
    assert.deepEqual(report.expenseTransactions[0], {
      date: "2026-01-20",
      amount: 1_000,
      category: "Rent",
      parentCategory: "Housing",
      isEssential: true,
      isRecurring: true,
    });
    assert.deepEqual(report.expenseTransactions[3], {
      date: "2026-02-01",
      amount: 100,
      category: "Dining",
      parentCategory: "Food",
      isEssential: false,
      isRecurring: false,
    });
  });

  it("returns an empty report without transactions or with only contributions", () => {
    for (const input of [[], [transactions[0]]]) {
      assert.deepEqual(buildCashflowReport(input, categories), {
        periods: [],
        incomeCategories: [],
        expenseCategories: [],
        parentCategories: [],
        unclassifiedExpenses: 0,
        expenseTransactions: [],
      });
    }
  });
});

describe("periodsInRange", () => {
  it("fills months outside the data with all-null periods and reuses the report's own periods", () => {
    const periods = periodsInRange(report, "2025-12-15", "2026-02-10");
    assert.deepEqual(periods.map((period) => period.period), ["2025-12-01", "2026-01-01", "2026-02-01"]);
    assert.equal(periods[0].income, null);
    assert.deepEqual(periods[0].incomeCategories, { Allowance: null, salary: null });
    assert.equal(periods[1], report.periods[0]);
  });

  it("returns nothing for a missing or reversed range", () => {
    assert.deepEqual(periodsInRange(report, "", "2026-01-01"), []);
    assert.deepEqual(periodsInRange(report, "2026-02-01", "2026-01-01"), []);
    assert.deepEqual(periodsInRange(report, "2023-01-01", "20260-03-01"), [], "a date input holding a 5-digit year");
  });
});

describe("expensesExcluding", () => {
  it("subtracts the named categories case-insensitively and propagates missing data", () => {
    const [january, , march] = report.periods;
    assert.equal(expensesExcluding(january, ["rent"]), 500);
    assert.equal(expensesExcluding(january, ["RENT", "doctor"]), 200);
    assert.equal(expensesExcluding(january, []), 1_500);
    assert.equal(expensesExcluding(march, ["rent"]), null);
  });
});

describe("buildExpenseMovingAverage", () => {
  it("averages daily expenses per parent category over a trailing window", () => {
    const days = buildExpenseMovingAverage(report.expenseTransactions, 2, "2026-01-19", "2026-01-23");
    assert.deepEqual(days.map((day) => day.period), ["2026-01-19", "2026-01-20", "2026-01-21", "2026-01-22", "2026-01-23"]);
    assert.deepEqual(days[0].categories, { Food: 0, Health: 0, Housing: 0 });
    assert.deepEqual(days[1].categories, { Food: 0, Health: 0, Housing: 500 });
    assert.deepEqual(days[2].categories, { Food: 0, Health: 150, Housing: 500 });
    assert.deepEqual(days[3].categories, { Food: 100, Health: 150, Housing: 0 });
    assert.deepEqual(days[4].categories, { Food: 100, Health: 0, Housing: 0 });
  });

  it("averages over the days available when the window is longer than the range", () => {
    const days = buildExpenseMovingAverage(report.expenseTransactions, 1_000_000, "2026-01-01", "2026-02-28");
    assert.equal(days.length, 59);
    assert.equal(days.at(-1)?.categories.Housing, 1_000 / 59);
  });

  it("returns nothing without expenses or for a reversed range", () => {
    assert.deepEqual(buildExpenseMovingAverage([], 30, "2026-01-01", "2026-01-31"), []);
    assert.deepEqual(buildExpenseMovingAverage(report.expenseTransactions, 30, "2026-02-01", "2026-01-01"), []);
  });
});

describe("transaction kinds", () => {
  it("recognise salary and withdrawal categories case-insensitively", () => {
    assert.equal(isSalary({ category: "Salary" }), true);
    assert.equal(isSalary({ category: "SALARY" }), true);
    assert.equal(isSalary({ category: "Salary bonus" }), false);
    assert.equal(isSalary({ category: null }), false);
    assert.equal(isWithdrawal({ category: "Withdrawal" }), true);
    assert.equal(isWithdrawal({ category: "salary" }), false);
  });
});
