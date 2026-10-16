import assert from "node:assert/strict";
import { buildNetWorthGrowthSeries, type NetWorthReport } from "@/lib/analytics/net-worth";

const report: NetWorthReport = {
  currencies: ["CHF"],
  periods: ["2026-01-31", "2026-02-28", "2026-03-31"],
  rows: [],
  totals: [[1_000, 1_500, 1_300]],
  financialTotals: [[800, 1_200, 1_000]],
  cashTotals: [],
  otherTotals: [],
  absoluteChanges: [],
  percentageChanges: [],
  warnings: [],
};
const transactions = [
  { date: "2026-02-10", type: "income" as const, amount: 100, category: "salary" },
  { date: "2026-02-12", type: "contribution" as const, amount: 500, category: null },
  { date: "2026-02-15", type: "income" as const, amount: 50, category: "withdrawal" },
];
const priceIncreases = [[null, 125, -40]];
const points = buildNetWorthGrowthSeries(report, transactions, priceIncreases, 0);

assert.deepEqual(points.map((point) => point.financialIncrease), [null, 125, -40]);
assert.deepEqual(points.map((point) => point.totalIncrease), [null, 500, -200]);
assert.deepEqual(points.map((point) => point.salary), [null, 100, 0]);

console.log("net-worth growth tests passed");
