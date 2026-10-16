import assert from "node:assert/strict";
import { buildHallOfFame } from "@/lib/analytics/hall-of-fame";
import type { NetWorthReport } from "@/lib/analytics/net-worth";

const report: NetWorthReport = {
  currencies: ["CHF", "EUR"],
  periods: ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-01", "2026-04-16"],
  rows: [],
  totals: [[100, 200, 150, 160, 170], [90, 180, 140, 150, 160]],
  financialTotals: [],
  cashTotals: [],
  otherTotals: [],
  absoluteChanges: [],
  percentageChanges: [],
  warnings: [],
};
const chfTransactions = [
  { date: "2026-01-10", type: "income" as const, amount: 1_000, category: "Other" },
  { date: "2026-01-12", type: "income" as const, amount: 800, category: "salary" },
  { date: "2026-01-14", type: "expense" as const, amount: 200, category: "Rent" },
  { date: "2026-02-10", type: "income" as const, amount: 500, category: "Salary" },
  { date: "2026-02-14", type: "expense" as const, amount: 700, category: "Rent" },
  { date: "2026-04-10", type: "income" as const, amount: 300, category: "Salary" },
  { date: "2026-04-10", type: "contribution" as const, amount: 5_000, category: null },
  { date: "2026-04-12", type: "income" as const, amount: 350, category: "Salary" },
  { date: "2026-04-12", type: "expense" as const, amount: 100, category: "Food" },
];
const eurTransactions = chfTransactions.map((transaction) => ({ ...transaction, amount: transaction.amount / 2 }));
const metrics = buildHallOfFame(report, { CHF: chfTransactions, EUR: eurTransactions }, "2026-04-16");

assert.equal(metrics.length, 12);
assert.deepEqual(metrics[0]?.topTen[0], { month: "2026-01", value: 1_800 });
assert.deepEqual(metrics[4]?.topTen[0], { month: "2026-02", value: 100 });
assert.deepEqual(metrics[6]?.topTen[0], { month: "2026-03", value: -50 });
assert.deepEqual(metrics[8]?.topTen[0], { month: "2026-02", value: 700 });
assert.deepEqual(metrics[9]?.topTen[0], { month: "2026-03", value: 0 });
assert.equal(metrics[4]?.currentValue, 20);
assert.equal(metrics[10]?.currentValue, 550);
assert.equal(metrics[11]?.currentValue, 550 / 650);
assert.equal(metrics[11]?.currentIsRanked, true);
assert.equal(metrics[0]?.currentMonth, "2026-04");

console.log("hall-of-fame tests passed");
