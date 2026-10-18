import type { BenchmarkInput } from "@/lib/analytics/benchmark";
import type { NetWorthGrowthPoint, NetWorthReport, NetWorthRow } from "@/lib/analytics/net-worth";
import { today } from "@/lib/dates";

/** Synthetic net-worth report: three reporting periods plus the current date, in CHF and EUR. */
export function netWorthFixture() {
  const periods = ["2025-12-31", "2026-01-31", "2026-02-28", today()];
  const row = (overrides: Partial<NetWorthRow> & Pick<NetWorthRow, "asset" | "datatype" | "values">): NetWorthRow => ({
    currency: "USD",
    instrumentName: null,
    instrumentUrl: null,
    ytdPerformance: { CHF: null, EUR: null },
    ...overrides,
  });
  const rows = [
    row({ asset: "VT", datatype: "quantity", values: [1_000, 1_100, 1_200, 1_300], instrumentName: "Vanguard World", instrumentUrl: "https://finance.yahoo.com/quote/VT", ytdPerformance: { CHF: 8.44, EUR: -2.1 } }),
    row({ asset: "GDE", datatype: "quantity", values: [500, 520, null, null], instrumentName: "WisdomTree", instrumentUrl: "https://finance.yahoo.com/quote/GDE", ytdPerformance: { CHF: 0, EUR: null } }),
    row({ asset: "Savings", datatype: "cash", values: [2_000, 2_000, 2_100, 2_100], currency: "CHF" }),
    row({ asset: "House", datatype: "value", values: [null, null, 90_000, 90_000], currency: "EUR" }),
  ];
  const report: NetWorthReport = {
    currencies: ["CHF", "EUR"],
    periods,
    rows,
    totals: [[3_500, 3_620, 93_300, 93_400], [3_300, 3_400, 87_000, 87_100]],
    financialTotals: [[1_500, 1_620, 1_200, 1_300], [1_400, 1_500, 1_100, 1_200]],
    cashTotals: [[2_000, 2_000, 2_100, 2_100], [1_900, 1_900, 2_000, 2_000]],
    otherTotals: [[null, null, 90_000, 90_000], [null, null, 84_000, 84_000]],
    absoluteChanges: [null, 120, 89_680, 100],
    percentageChanges: [null, 3.4, 2_477.1, 0.1],
    warnings: [],
  };
  const benchmarkInputs: BenchmarkInput[] = report.currencies.map((currency, index) => ({
    currency,
    portfolio: periods.map((date, i) => ({ date, value: report.financialTotals[index][i] })),
    cashflows: [{ date: "2026-01-15", amount: 500 }],
    prices: [{ date: "2025-12-31", stock: 100, bond: 100 }, { date: "2026-02-27", stock: 110, bond: 101 }],
  }));
  const growthSeries: NetWorthGrowthPoint[][] = report.currencies.map((_, index) => periods.map((period, i) => ({
    period,
    totalNetWorth: report.totals[index][i],
    financialIncrease: i === 0 ? null : 100,
    salary: i === 0 ? null : 5_000,
    totalIncrease: i === 0 ? null : (report.totals[index][i] ?? 0) - (report.totals[index][i - 1] ?? 0),
  })));
  return { report, benchmarkInputs, growthSeries };
}
