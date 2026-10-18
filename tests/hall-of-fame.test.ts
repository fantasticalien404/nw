import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
const byId = (id: string) => metrics.find((metric) => metric.id === id)!;

describe("buildHallOfFame", () => {
  it("defines the twelve rankings in display order", () => {
    assert.deepEqual(metrics.map((metric) => metric.id), [
      "income-chf",
      "income-eur",
      "salary-chf",
      "salary-eur",
      "net-worth-delta-chf",
      "net-worth-delta-eur",
      "worst-net-worth-delta-chf",
      "worst-net-worth-delta-eur",
      "expenses-chf",
      "lowest-expenses-chf",
      "savings-chf",
      "savings-rate",
    ]);
  });

  it("ranks income including withdrawals but excluding contributions, per currency", () => {
    assert.deepEqual(byId("income-chf").topTen[0], { month: "2026-01", value: 1_800 });
    assert.deepEqual(byId("income-eur").topTen[0], { month: "2026-01", value: 900 });
    assert.equal(byId("income-chf").currentValue, 650);
  });

  it("ranks salary only, case-insensitively", () => {
    assert.deepEqual(byId("salary-chf").topTen.slice(0, 3), [
      { month: "2026-01", value: 800 },
      { month: "2026-04", value: 650 },
      { month: "2026-02", value: 500 },
    ]);
  });

  it("ranks the change in net worth between consecutive reported months, using each month's latest reading", () => {
    assert.deepEqual(byId("net-worth-delta-chf").topTen, [
      { month: "2026-02", value: 100 },
      { month: "2026-04", value: 20 },
      { month: "2026-03", value: -50 },
    ]);
    assert.deepEqual(byId("worst-net-worth-delta-chf").topTen[0], { month: "2026-03", value: -50 });
    assert.equal(byId("net-worth-delta-chf").currentValue, 20);
  });

  it("ranks highest and lowest expenses, including months without any", () => {
    assert.deepEqual(byId("expenses-chf").topTen[0], { month: "2026-02", value: 700 });
    assert.deepEqual(byId("lowest-expenses-chf").topTen[0], { month: "2026-03", value: 0 });
  });

  it("ranks savings and the savings rate, leaving out months without income", () => {
    assert.equal(byId("savings-chf").currentValue, 550);
    assert.equal(byId("savings-rate").currentValue, 550 / 650);
    assert.equal(byId("savings-rate").currentIsRanked, true);
    assert.deepEqual(byId("savings-rate").topTen.map((entry) => entry.month), ["2026-01", "2026-04", "2026-02"]);
  });

  it("reports the current month alongside the ranking", () => {
    assert.equal(metrics[0].currentMonth, "2026-04");
    assert.ok(metrics.every((metric) => metric.topTen.length <= 10));
  });
});
