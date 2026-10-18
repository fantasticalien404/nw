import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { benchmarkCashflows, buildBenchmarkComparison, type BenchmarkPrice } from "@/lib/analytics/benchmark";

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

const snapshots = (values: Array<[string, number | null]>) => values.map(([date, value]) => ({ date, value }));

describe("buildBenchmarkComparison", () => {
  const flatInput = {
    currency: "USD",
    portfolio: snapshots([["2025-01-01", 100_000], ["2025-02-01", 110_000], ["2025-03-01", 110_000], ["2025-04-01", 110_000]]),
    cashflows: [{ date: "2025-02-01", amount: 10_000 }],
    prices: prices("2025-01-01", "2025-04-01"),
  };

  it("invests a contribution in the benchmark on its date", () => {
    const comparison = buildBenchmarkComparison(flatInput, "stocks", "monthly");
    assert.deepEqual(comparison.points.map((point) => point.benchmark), [100_000, 110_000, 110_000, 110_000]);
    close(comparison.portfolioMetrics.growth, 0);
    close(comparison.benchmarkMetrics.growth, 0);
  });

  it("buys at the price on the contribution's own date, not the start or end price", () => {
    // 100 in at 100 = 1 unit. 100 more on Feb 1 at 200 = 0.5 unit. At 400 on Mar 1 that is 1.5 × 400 = 600
    // (buying at the start price would give 800, at the end price 500).
    const input = {
      currency: "USD",
      portfolio: snapshots([["2025-01-01", 100], ["2025-03-01", 600]]),
      cashflows: [{ date: "2025-02-01", amount: 100 }],
      prices: [
        { date: "2025-01-01", stock: 100, bond: 100 },
        { date: "2025-02-01", stock: 200, bond: 200 },
        { date: "2025-03-01", stock: 400, bond: 400 },
      ],
    };
    close(buildBenchmarkComparison(input, "stocks", "yearly").points[1].benchmark, 600);
    close(buildBenchmarkComparison({ ...input, cashflows: [{ date: "2025-02-02", amount: 100 }] }, "stocks", "yearly").points[1].benchmark, 100 * 4 + 100 / 400 * 400, 1e-9);
  });

  it("is not distorted by a withdrawal on a non-snapshot date", () => {
    const risingPrices = prices("2025-01-01", "2025-04-01", 1);
    const withdrawal = {
      currency: "USD",
      portfolio: snapshots([["2025-01-01", 100_000], ["2025-02-01", 100_000], ["2025-03-01", 100_000], ["2025-04-01", 100_000]]),
      cashflows: [{ date: "2025-03-10", amount: -30_000 }],
      prices: risingPrices,
    };
    close(buildBenchmarkComparison(withdrawal, "stocks", "monthly").benchmarkMetrics.maxDrawdown, 0);

    const onSnapshot = buildBenchmarkComparison({ ...withdrawal, cashflows: [{ date: "2025-03-01", amount: -30_000 }] }, "stocks", "monthly");
    const startPrice = risingPrices.find((price) => price.date >= "2025-01-01")!.stock;
    const endPrice = risingPrices.find((price) => price.date >= "2025-04-01")!.stock;
    close(onSnapshot.benchmarkMetrics.growth, endPrice / startPrice - 1);

    // Feeding the benchmark back in as the portfolio must reproduce every metric.
    const benchmarkAsPortfolio = buildBenchmarkComparison(
      { ...withdrawal, cashflows: [{ date: "2025-03-01", amount: -30_000 }], portfolio: onSnapshot.points.map((point) => ({ date: point.date, value: point.benchmark })) },
      "stocks",
      "monthly",
    );
    for (const key of ["irr", "growth", "sharpeRatio", "volatility", "maxDrawdown", "bestMonth", "worstMonth"] as const) {
      const portfolioMetric = benchmarkAsPortfolio.portfolioMetrics[key];
      const benchmarkMetric = benchmarkAsPortfolio.benchmarkMetrics[key];
      if (portfolioMetric === null || benchmarkMetric === null) assert.equal(portfolioMetric, benchmarkMetric);
      else close(portfolioMetric, benchmarkMetric, 1e-6);
    }
  });

  it("weights a 60/40 benchmark by asset and a stocks benchmark entirely in stocks", () => {
    const input = {
      currency: "USD",
      portfolio: snapshots([["2025-01-01", 100], ["2025-02-01", 100]]),
      cashflows: [],
      prices: [{ date: "2025-01-01", stock: 100, bond: 100 }, { date: "2025-02-01", stock: 110, bond: 100 }],
    };
    close(buildBenchmarkComparison(input, "balanced", "monthly").points[1].benchmark, 100 * (0.6 * 1.1 + 0.4));
    close(buildBenchmarkComparison(input, "stocks", "monthly").points[1].benchmark, 110);
  });

  it("rebalances at the chosen interval", () => {
    // Stocks double in month 1 and fall back in month 2. A 60/40 portfolio is worth 160 at the peak; rebalancing
    // there (monthly) resets it to 0.48 stock + 0.64 bond units, which ends at 112. Never rebalancing ends at 100.
    const input = {
      currency: "USD",
      portfolio: snapshots([["2025-01-01", 100], ["2025-02-01", 100], ["2025-03-01", 100]]),
      cashflows: [],
      prices: [
        { date: "2025-01-01", stock: 100, bond: 100 },
        { date: "2025-02-01", stock: 200, bond: 100 },
        { date: "2025-03-01", stock: 100, bond: 100 },
      ],
    };
    const finalValue = (period: "monthly" | "quarterly" | "yearly") => buildBenchmarkComparison(input, "balanced", period).points[2].benchmark;
    close(finalValue("monthly"), 112);
    close(finalValue("quarterly"), 100);
    close(finalValue("yearly"), 100);
  });

  it("reports an annualised money-weighted return", () => {
    const input = { currency: "USD", portfolio: snapshots([["2025-01-01", 100], ["2026-01-01", 110]]), cashflows: [], prices: prices("2025-01-01", "2026-01-01") };
    const { portfolioMetrics } = buildBenchmarkComparison(input, "stocks", "monthly");
    close(portfolioMetrics.irr, 0.1, 1e-3);
    close(portfolioMetrics.growth, 0.1);
  });

  it("skips missing portfolio snapshots but keeps them in the points", () => {
    const input = { ...flatInput, portfolio: snapshots([["2025-01-01", 100_000], ["2025-02-01", null], ["2025-03-01", 110_000]]) };
    const comparison = buildBenchmarkComparison(input, "stocks", "monthly");
    assert.deepEqual(comparison.points.map((point) => point.portfolio), [100_000, null, 110_000]);
    assert.equal(comparison.points[1].benchmark, null);
    assert.notEqual(comparison.points[2].benchmark, null);
  });

  it("has no benchmark or metrics without portfolio values or prices", () => {
    const empty = buildBenchmarkComparison({ ...flatInput, portfolio: [] }, "stocks", "monthly");
    assert.deepEqual(empty.points, []);
    assert.deepEqual(Object.values(empty.portfolioMetrics), Array(7).fill(null));

    const noPrices = buildBenchmarkComparison({ ...flatInput, prices: [] }, "stocks", "monthly");
    assert.deepEqual(noPrices.points.map((point) => point.benchmark), [null, null, null, null]);
    assert.deepEqual(Object.values(noPrices.benchmarkMetrics), Array(7).fill(null));
  });
});

describe("benchmarkCashflows", () => {
  // Late enough to include every flow, unless a test sets its own holdings date.
  const ALL = "2099-12-31";
  const transaction = (date: string, type: "income" | "expense" | "contribution", amount: number, category: string | null = null) => ({ date, type, amount, category });

  it("invests contributions at the start of the following month", () => {
    assert.deepEqual(
      benchmarkCashflows([transaction("2026-03-31", "contribution", 500), transaction("2026-12-15", "contribution", 200), transaction("2026-05-01", "contribution", 100)], ALL),
      [{ date: "2026-04-01", amount: 500 }, { date: "2027-01-01", amount: 200 }, { date: "2026-06-01", amount: 100 }],
    );
  });

  it("removes withdrawals on their own date, whatever the category case", () => {
    assert.deepEqual(
      benchmarkCashflows([transaction("2026-02-10", "income", 300, "withdrawal"), transaction("2026-02-11", "income", 50, "Withdrawal")], ALL),
      [{ date: "2026-02-10", amount: -300 }, { date: "2026-02-11", amount: -50 }],
    );
  });

  it("ignores ordinary income and expenses", () => {
    assert.deepEqual(
      benchmarkCashflows([transaction("2026-02-10", "income", 3_000, "Salary"), transaction("2026-02-11", "expense", 40, "withdrawal"), transaction("2026-02-12", "expense", 40)], ALL),
      [],
    );
  });

  it("leaves out flows after the latest reported holdings, which the portfolio does not contain yet", () => {
    const transactions = [
      transaction("2026-08-20", "contribution", 500),
      transaction("2026-09-20", "contribution", 700),
      transaction("2026-09-25", "income", 200, "withdrawal"),
      transaction("2026-10-05", "income", 100, "withdrawal"),
    ];
    // Holdings are reported at Sep 1: the Aug contribution is invested that day, the Sep and Oct flows come later.
    assert.deepEqual(benchmarkCashflows(transactions, "2026-09-01"), [{ date: "2026-09-01", amount: 500 }]);
    // A flow on the holdings date itself is part of that period's holdings.
    assert.deepEqual(benchmarkCashflows(transactions, "2026-10-01"), [
      { date: "2026-09-01", amount: 500 },
      { date: "2026-10-01", amount: 700 },
      { date: "2026-09-25", amount: -200 },
    ]);
  });
});
