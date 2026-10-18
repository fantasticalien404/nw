import assert from "node:assert/strict";
import { buildCashflowReport, buildExpenseHistogram, buildExpenseMovingAverage } from "@/lib/analytics/cashflow";

const categories = [
  { category: "Salary", parentCategory: "Income", isEssential: false, isRecurring: true },
  { category: "Allowance", parentCategory: "Income", isEssential: false, isRecurring: false },
  { category: "Rent", parentCategory: "Housing", isEssential: true, isRecurring: true },
  { category: "Doctor", parentCategory: "Health", isEssential: true, isRecurring: false },
  { category: "Food", parentCategory: "Food", isEssential: false, isRecurring: true },
  { category: "Dining", parentCategory: "Food", isEssential: false, isRecurring: false },
];
const transactions = [
  { date: "2026-01-10", type: "income" as const, amount: 3_000, category: "Salary" },
  { date: "2026-01-15", type: "income" as const, amount: 200, category: "Allowance" },
  { date: "2026-01-20", type: "expense" as const, amount: 1_000, category: "Rent" },
  { date: "2026-01-21", type: "expense" as const, amount: 300, category: "Doctor" },
  { date: "2026-01-22", type: "expense" as const, amount: 200, category: "Food" },
  { date: "2026-02-01", type: "expense" as const, amount: 100, category: "Dining" },
];

const report = buildCashflowReport(transactions, categories, { from: "2026-01-01", to: "2026-02-28" });
assert.deepEqual(report.incomeCategories, ["Allowance", "Salary"]);
assert.deepEqual(report.expenseCategories, ["Dining", "Doctor", "Food", "Rent"]);
assert.equal(report.totalExpenses, 1_600);
assert.equal(report.dailyMeanExpenses, 1_600 / 59);
assert.equal(report.essentialExpenses, 1_300);
assert.equal(report.recurringExpenses, 1_200);
assert.equal(report.discretionaryExpenses, 300);
assert.equal(report.salary, 3_000);
assert.equal(report.yearPeriods[1]?.cumulativeSalary, 3_000);
assert.equal(report.yearPeriods[1]?.cumulativeExpenses, 1_600);
assert.equal(buildCashflowReport(transactions, categories, { rawCategory: "Rent" }).totalExpenses, 1_000);
assert.equal(buildCashflowReport(transactions, categories, { expenseClassification: "essential" }).totalExpenses, 1_300);
assert.equal(buildCashflowReport(transactions, categories, { incomeSource: "Salary" }).totalIncome, 3_000);
const histogram = buildExpenseHistogram(report.expenseTransactions, "quarter");
assert.equal(histogram[0]?.categories.Rent, 1_000);
const moving = buildExpenseMovingAverage(report.expenseTransactions, 2, report.rangeStart, report.rangeEnd);
assert.equal(moving[20]?.categories.Housing, 500);
assert.equal(moving[20]?.categories.Health, 150);
const longMovingAverage = buildExpenseMovingAverage(
  report.expenseTransactions,
  1_000_000,
  report.rangeStart,
  report.rangeEnd,
);
assert.equal(longMovingAverage[longMovingAverage.length - 1]?.categories.Housing, 1_000 / 59);

console.log("cashflow analytics tests passed");
