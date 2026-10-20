import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNetWorthGrowthSeries, buildNetWorthReport, netWorthYearColumns, type NetWorthReport } from "@/lib/analytics/net-worth";
import type { ValuedAsset, ValuedNetWorth } from "@/types/net-worth";

function asset(overrides: Partial<ValuedAsset> & Pick<ValuedAsset, "asset" | "datatype" | "convertedValues">): ValuedAsset {
  return {
    currency: "USD",
    instrumentName: null,
    instrumentUrl: null,
    values: [],
    ytdPerformance: {},
    ...overrides,
  };
}

const valued: ValuedNetWorth = {
  currencies: ["CHF", "EUR"],
  periods: ["2026-01-31", "2026-02-28", "2026-03-15"],
  assets: [
    asset({ asset: "VT", datatype: "quantity", convertedValues: [[100, 200, null], [90, 180, null]], instrumentName: "World" }),
    asset({ asset: "Cash", datatype: "cash", convertedValues: [[50, null, 70], [45, null, 63]] }),
    asset({ asset: "House", datatype: "value", convertedValues: [[null, null, null], [null, null, null]] }),
  ],
  warnings: ["missing price", "missing price", "missing fx"],
};

describe("buildNetWorthReport", () => {
  const report = buildNetWorthReport(valued);

  it("sums each currency's converted values per period, for all assets and per asset type", () => {
    assert.deepEqual(report.totals, [[150, 200, 70], [135, 180, 63]]);
    assert.deepEqual(report.financialTotals, [[100, 200, null], [90, 180, null]]);
    assert.deepEqual(report.cashTotals, [[50, null, 70], [45, null, 63]]);
  });

  it("leaves a total null when no asset has a value, rather than zero", () => {
    assert.deepEqual(report.otherTotals, [[null, null, null], [null, null, null]]);
  });

  it("measures period-over-period change of the first currency's total", () => {
    assert.deepEqual(report.absoluteChanges, [null, 50, -130]);
    assert.deepEqual(report.percentageChanges, [null, (50 / 150) * 100, -65]);
  });

  it("has no percentage change from a zero or missing previous total", () => {
    const zero = buildNetWorthReport({
      currencies: ["CHF"],
      periods: ["a", "b", "c", "d"],
      assets: [asset({ asset: "X", datatype: "cash", convertedValues: [[0, 10, null, 5]] })],
      warnings: [],
    });
    assert.deepEqual(zero.absoluteChanges, [null, 10, null, null]);
    assert.deepEqual(zero.percentageChanges, [null, null, null, null]);
  });

  it("passes rows through without the conversion matrix, and de-duplicates warnings", () => {
    assert.deepEqual(report.rows[0], {
      asset: "VT",
      currency: "USD",
      datatype: "quantity",
      instrumentName: "World",
      instrumentUrl: null,
      values: [],
      ytdPerformance: {},
    });
    assert.deepEqual(report.warnings, ["missing price", "missing fx"]);
    assert.deepEqual(report.currencies, ["CHF", "EUR"]);
    assert.deepEqual(report.periods, valued.periods);
  });

  it("handles a workbook without assets", () => {
    const empty = buildNetWorthReport({ currencies: ["CHF"], periods: ["a"], assets: [], warnings: [] });
    assert.deepEqual(empty.totals, [[null]]);
  });
});

describe("netWorthYearColumns", () => {
  const periods = ["2025-11-30", "2025-12-31", "2026-01-31", "2026-03-31", "2026-05-20"];

  it("always spans January to December and leaves months without a report period empty", () => {
    const columns = netWorthYearColumns({ periods }, "2026").filter((column) => !column.isCurrent);
    assert.equal(columns.length, 12);
    assert.deepEqual(columns.map((column) => column.date.slice(0, 7)), [
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
      "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
    ]);
    assert.deepEqual(columns.map((column) => column.index), [2, null, 3, null, null, null, null, null, null, null, null, null]);
  });

  it("appends the current period only for the year it falls in, without taking over its month", () => {
    const current = netWorthYearColumns({ periods }, "2026").at(-1);
    assert.deepEqual(current, { key: "current", date: "2026-05-20", index: 4, isCurrent: true });

    const past = netWorthYearColumns({ periods }, "2025");
    assert.equal(past.length, 12);
    assert.ok(past.every((column) => !column.isCurrent));
    assert.deepEqual(past.map((column) => column.index), [null, null, null, null, null, null, null, null, null, null, 0, 1]);
  });

  it("keeps twelve month columns for a year without any report period", () => {
    const columns = netWorthYearColumns({ periods }, "2024");
    assert.equal(columns.length, 12);
    assert.ok(columns.every((column) => column.index === null));
  });

  it("gives every column a unique key, even when the current date is the first of a month", () => {
    const columns = netWorthYearColumns({ periods: ["2026-01-31", "2026-05-01"] }, "2026");
    assert.equal(new Set(columns.map((column) => column.key)).size, columns.length);
  });
});

describe("buildNetWorthGrowthSeries", () => {
  const growthReport: NetWorthReport = {
    ...buildNetWorthReport(valued),
    currencies: ["CHF"],
    periods: ["2026-01-31", "2026-02-28", "2026-03-31"],
    totals: [[1_000, 1_500, 1_300]],
  };
  const transactions = [
    { date: "2026-02-10", type: "income" as const, amount: 100, category: "salary" },
    { date: "2026-02-12", type: "contribution" as const, amount: 500, category: null },
    { date: "2026-02-15", type: "income" as const, amount: 50, category: "withdrawal" },
    { date: "2026-02-28", type: "income" as const, amount: 7, category: "Salary" },
    { date: "2026-03-01", type: "expense" as const, amount: 20, category: "salary" },
  ];
  const points = buildNetWorthGrowthSeries(growthReport, transactions, [[null, 125, -40]], 0);

  it("takes the price increases as given", () => {
    assert.deepEqual(points.map((point) => point.financialIncrease), [null, 125, -40]);
  });

  it("sums only salary income dated after the previous period through the period itself", () => {
    assert.deepEqual(points.map((point) => point.salary), [null, 107, 0]);
  });

  it("reports the actual change in net worth, with the first period as the baseline", () => {
    assert.deepEqual(points.map((point) => point.totalNetWorth), [1_000, 1_500, 1_300]);
    assert.deepEqual(points.map((point) => point.totalIncrease), [null, 500, -200]);
  });

  it("has no total increase when a total is missing", () => {
    const gap = buildNetWorthGrowthSeries({ ...growthReport, totals: [[1_000, null, 1_300]] }, [], [[null, null, null]], 0);
    assert.deepEqual(gap.map((point) => point.totalIncrease), [null, null, null]);
  });
});
