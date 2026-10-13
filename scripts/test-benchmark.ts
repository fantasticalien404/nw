import assert from "node:assert/strict";
import { buildBenchmarkComparison, type BenchmarkPrice } from "@/lib/analytics/benchmark";

function tradingDays(start: string, end: string, holidays: string[] = []) {
  const days: string[] = [];
  for (let date = new Date(`${start}T00:00:00Z`); date <= new Date(`${end}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) {
    const iso = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && !holidays.includes(iso)) days.push(iso);
  }
  return days;
}

function close(actual: number | null, expected: number, epsilon = 1e-9) {
  assert.ok(actual !== null && Math.abs(actual - expected) < epsilon, `${actual} vs ${expected}`);
}

function prices(start: string, end: string, increment = 0): BenchmarkPrice[] {
  return tradingDays(start, end, ["2025-01-01"]).map((date, index) => ({
    date,
    stock: 100 + index * increment,
    bond: 100 + index * increment,
  }));
}

const flatPrices = prices("2025-01-01", "2025-04-01");
const flatInput = {
  currency: "USD",
  portfolio: [
    { date: "2025-01-01", value: 100_000 },
    { date: "2025-02-01", value: 110_000 },
    { date: "2025-03-01", value: 110_000 },
    { date: "2025-04-01", value: 110_000 },
  ],
  cashflows: [{ date: "2025-02-01", amount: 10_000 }],
  prices: flatPrices,
};
const flatComparison = buildBenchmarkComparison(flatInput, "stocks", "monthly");
assert.deepEqual(flatComparison.points.map((point) => point.benchmark), [100_000, 110_000, 110_000, 110_000]);
close(flatComparison.portfolioMetrics.growth, 0);
close(flatComparison.benchmarkMetrics.growth, 0);

const risingPrices = prices("2025-01-01", "2025-04-01", 1);
const withdrawalInput = {
  currency: "USD",
  portfolio: [
    { date: "2025-01-01", value: 100_000 },
    { date: "2025-02-01", value: 100_000 },
    { date: "2025-03-01", value: 100_000 },
    { date: "2025-04-01", value: 100_000 },
  ],
  cashflows: [{ date: "2025-03-10", amount: -30_000 }],
  prices: risingPrices,
};
const withdrawalComparison = buildBenchmarkComparison(withdrawalInput, "stocks", "monthly");
close(withdrawalComparison.benchmarkMetrics.maxDrawdown, 0);

const snapshotWithdrawal = {
  ...withdrawalInput,
  cashflows: [{ date: "2025-03-01", amount: -30_000 }],
};
const snapshotComparison = buildBenchmarkComparison(snapshotWithdrawal, "stocks", "monthly");
const startPrice = risingPrices.find((price) => price.date >= "2025-01-01")!.stock;
const endPrice = risingPrices.find((price) => price.date >= "2025-04-01")!.stock;
close(snapshotComparison.benchmarkMetrics.growth, endPrice / startPrice - 1);

const benchmarkPortfolio = snapshotComparison.points.map((point) => ({ date: point.date, value: point.benchmark }));
const consistencyComparison = buildBenchmarkComparison(
  { ...snapshotWithdrawal, portfolio: benchmarkPortfolio },
  "stocks",
  "monthly",
);
for (const key of ["irr", "growth", "sharpeRatio", "volatility", "maxDrawdown", "bestMonth", "worstMonth"] as const) {
  const portfolioMetric = consistencyComparison.portfolioMetrics[key];
  const benchmarkMetric = consistencyComparison.benchmarkMetrics[key];
  if (portfolioMetric === null || benchmarkMetric === null) {
    assert.equal(portfolioMetric, benchmarkMetric);
  } else {
    close(portfolioMetric, benchmarkMetric, 1e-6);
  }
}

console.log("benchmark tests passed");
