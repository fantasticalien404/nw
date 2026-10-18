import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCashflowReport, type ExpenseTransaction } from "@/lib/analytics/cashflow";
import { eachDay } from "@/lib/dates";
import {
  buildCumulative,
  buildInsightPeriods,
  countSelectedDays,
  groupByMonth,
  movingAverageWindow,
  selectExpenses,
  splitLargestGroups,
  sumAmounts,
  sumByGroup,
  type ExpenseSelection,
} from "@/lib/analytics/cashflow-insights";
import { categoryColors, otherGroupsColor } from "@/components/cashflow/category-colors";
import type { CashflowCategory } from "@/types/workbook";

function expense(date: string, amount: number, category: string, parentCategory: string, isEssential = false, isRecurring = false): ExpenseTransaction {
  return { date, amount, category, parentCategory, isEssential, isRecurring };
}

const expenses = [
  expense("2025-02-05", 10, "Dining", "Food"),
  expense("2026-01-10", 100, "Rent", "Housing", true, true),
  expense("2026-01-20", 50, "Dining", "Food"),
  expense("2026-02-10", 100, "Rent", "Housing", true, true),
  expense("2026-02-15", 30, "Doctor", "Health", true, false),
  expense("2026-03-05", 20, "Dining", "Food"),
];
const everything: ExpenseSelection = {
  start: "2026-01-01",
  end: "2026-03-31",
  month: "all",
  categories: new Set(),
  parents: new Set(),
  classification: "all",
};
const select = (overrides: Partial<ExpenseSelection>) => selectExpenses(expenses, { ...everything, ...overrides });

describe("selectExpenses", () => {
  it("keeps expenses inside the date range, inclusive", () => {
    assert.equal(select({}).length, 5);
    assert.equal(select({ end: "2026-02-10" }).length, 3);
    assert.equal(select({ start: "2026-01-20", end: "2026-01-20" }).length, 1);
  });

  it("returns nothing for a reversed range", () => {
    assert.deepEqual(select({ start: "2026-03-01", end: "2026-01-01" }), []);
  });

  it("filters by calendar month across years", () => {
    assert.deepEqual(select({ start: "2025-01-01", month: "02" }).map((item) => item.date), ["2025-02-05", "2026-02-10", "2026-02-15"]);
  });

  it("treats an empty category selection as no filter and a non-empty one as a restriction", () => {
    assert.equal(select({ categories: new Set(["Rent"]) }).length, 2);
    assert.equal(select({ parents: new Set(["Food"]) }).length, 2);
    assert.equal(select({ categories: new Set(["Rent"]), parents: new Set(["Food"]) }).length, 0);
  });

  it("filters by classification", () => {
    assert.equal(select({ classification: "essential" }).length, 3);
    assert.equal(select({ classification: "discretionary" }).length, 2);
    assert.equal(select({ classification: "recurring" }).length, 2);
    assert.equal(select({ classification: "non-recurring" }).length, 3);
  });
});

describe("expense totals", () => {
  it("sums amounts, optionally for a subset", () => {
    assert.equal(sumAmounts(expenses), 310);
    assert.equal(sumAmounts(expenses, (item) => item.isEssential), 230);
    assert.equal(sumAmounts([]), 0);
  });

  it("groups by category or parent category", () => {
    assert.deepEqual([...sumByGroup(select({}), "category")], [["Rent", 200], ["Dining", 70], ["Doctor", 30]]);
    assert.deepEqual(Object.fromEntries(sumByGroup(select({}), "parent")), { Housing: 200, Food: 70, Health: 30 });
  });

  it("groups by the first day of the month", () => {
    const months = groupByMonth(select({}));
    assert.deepEqual([...months.keys()], ["2026-01-01", "2026-02-01", "2026-03-01"]);
    assert.equal(months.get("2026-01-01")?.length, 2);
  });
});

describe("countSelectedDays", () => {
  it("counts days in the range, optionally only those of one calendar month", () => {
    assert.equal(countSelectedDays("2026-01-01", "2026-03-31", "all"), 90);
    assert.equal(countSelectedDays("2026-01-01", "2026-03-31", "02"), 28);
    assert.equal(countSelectedDays("2025-01-01", "2026-12-31", "02"), 28 + 28);
    assert.equal(countSelectedDays("2026-03-01", "2026-01-01", "all"), 0);
  });

  it("is zero for malformed dates, which date inputs produce while a year is being typed", () => {
    assert.equal(countSelectedDays("2023-01-01", "20260-03-01", "all"), 0);
    assert.equal(countSelectedDays("2023-01-01", "20260-03-01", "02"), 0);
    assert.equal(countSelectedDays("", "2026-03-01", "all"), 0);
  });

  it("matches counting the days one by one, for partial months at both ends and across leap years", () => {
    const ranges = [["2024-01-15", "2024-03-10"], ["2023-12-31", "2024-03-01"], ["2026-02-28", "2026-02-28"], ["2025-01-01", "2028-12-31"], ["2026-03-05", "2026-03-04"]];
    for (const [start, end] of ranges) {
      for (const month of ["all", ...Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"))]) {
        const expected = eachDay(start, end).filter((day) => month === "all" || day.slice(5, 7) === month).length;
        assert.equal(countSelectedDays(start, end, month), expected, `${start}..${end} month ${month}`);
      }
    }
  });

  it("is fast for the years a date input passes through while typing", () => {
    const started = performance.now();
    countSelectedDays("0002-01-01", "2026-10-18", "all");
    countSelectedDays("0002-01-01", "2026-10-18", "02");
    assert.ok(performance.now() - started < 200);
  });
});

describe("insight periods", () => {
  const categories: CashflowCategory[] = [
    { category: "Rent", parentCategory: "Housing", isEssential: true, isRecurring: true },
    { category: "Dining", parentCategory: "Food", isEssential: false, isRecurring: false },
    { category: "Doctor", parentCategory: "Health", isEssential: true, isRecurring: false },
    { category: "Salary", parentCategory: "Income", isEssential: false, isRecurring: true },
  ];
  const report = buildCashflowReport([
    ...["2026-01-25", "2026-02-25", "2026-03-25"].map((date) => ({ date, type: "income" as const, amount: 1_000, category: "Salary" })),
    ...expenses.filter((item) => item.date >= "2026-01-01").map((item) => ({ date: item.date, type: "expense" as const, amount: item.amount, category: item.category })),
  ], categories);
  const periodsFor = (reportingDate: string, selected = select({})) => buildInsightPeriods(report, reportingDate, groupByMonth(selected));

  it("splits each month's selected expenses and measures the savings rate against them", () => {
    const [january] = periodsFor("2026-03-20");
    assert.deepEqual(january, {
      period: "2026-01-01",
      income: 1_000,
      salary: 1_000,
      expenses: 150,
      essentialExpenses: 100,
      discretionaryExpenses: 50,
      recurringExpenses: 100,
      nonRecurringExpenses: 50,
      savingsRate: 0.85,
    });
  });

  it("stops at the reporting month and skips months without selected expenses", () => {
    assert.deepEqual(periodsFor("2026-02-20").map((period) => period.period), ["2026-01-01", "2026-02-01"]);
    assert.deepEqual(periodsFor("2026-03-20", select({ start: "2026-02-01" })).map((period) => period.period), ["2026-02-01", "2026-03-01"]);
  });

  it("accumulates salary and expenses across the periods", () => {
    const cumulative = buildCumulative(periodsFor("2026-03-20"));
    assert.deepEqual(cumulative.map((point) => point.cumulativeSalary), [1_000, 2_000, 3_000]);
    assert.deepEqual(cumulative.map((point) => point.cumulativeExpenses), [150, 280, 300]);
    assert.deepEqual(buildCumulative([]), []);
  });
});

describe("movingAverageWindow", () => {
  it("covers the trailing window ending at the cutoff", () => {
    const window = movingAverageWindow(expenses, 30, "2026-03-31");
    assert.equal(window.start, "2026-03-02");
    assert.equal(window.days, 30);
    assert.deepEqual(window.expenses.map((item) => item.date), ["2026-03-05"]);
  });

  it("starts no earlier than the first expense", () => {
    const window = movingAverageWindow(expenses, 1_000_000, "2026-03-31");
    assert.equal(window.start, "2025-02-05");
    assert.equal(window.expenses.length, 6);
  });

  it("is empty when every expense is after the cutoff", () => {
    const window = movingAverageWindow(expenses, 30, "2025-01-05");
    assert.equal(window.days, 0);
    assert.deepEqual(window.expenses, []);
  });
});

describe("splitLargestGroups", () => {
  const totals = new Map([["Dining", 70], ["Rent", 200], ["Doctor", 30], ["Gifts", 0], ["Books", 30]]);

  it("ranks groups by descending total, drops empty ones and breaks ties alphabetically", () => {
    assert.deepEqual(splitLargestGroups(totals, 10), { shown: ["Rent", "Dining", "Books", "Doctor"], merged: [] });
  });

  it("merges every group beyond the limit, so the totals still add up", () => {
    const { shown, merged } = splitLargestGroups(totals, 2);
    assert.deepEqual(shown, ["Rent", "Dining"]);
    assert.deepEqual(merged, ["Books", "Doctor"]);
    const sum = (names: string[]) => names.reduce((total, name) => total + totals.get(name)!, 0);
    assert.equal(sum(shown) + sum(merged), 330);
  });

  it("keeps a single extra group as its own series instead of merging it alone", () => {
    assert.deepEqual(splitLargestGroups(totals, 3), { shown: ["Rent", "Dining", "Books", "Doctor"], merged: [] });
  });

  it("is empty without expenses", () => {
    assert.deepEqual(splitLargestGroups(new Map(), 3), { shown: [], merged: [] });
  });
});

describe("category chart colours", () => {
  it("gives every series colour of a full palette a distinct value, apart from the grey of merged groups", () => {
    assert.equal(new Set([...categoryColors, otherGroupsColor]).size, categoryColors.length + 1);
  });
});
