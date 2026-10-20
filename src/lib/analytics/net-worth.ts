import { monthStarts } from "@/lib/dates";
import type { ValuedNetWorth } from "@/types/net-worth";
import type { AssetDatatype, ConvertedCashflowTransaction } from "@/types/workbook";
import { isSalary } from "./cashflow";

export type NetWorthRow = {
  asset: string;
  currency: string;
  datatype: AssetDatatype;
  instrumentName: string | null;
  instrumentUrl: string | null;
  values: Array<number | null>;
  ytdPerformance: Record<string, number | null>;
};

/** Totals are indexed `[currency][period]` in `currencies` / `periods` order. */
export type NetWorthReport = {
  currencies: string[];
  periods: string[];
  rows: NetWorthRow[];
  totals: Array<Array<number | null>>;
  financialTotals: Array<Array<number | null>>;
  cashTotals: Array<Array<number | null>>;
  otherTotals: Array<Array<number | null>>;
  /** Period-over-period change of the first currency's total. */
  absoluteChanges: Array<number | null>;
  percentageChanges: Array<number | null>;
  warnings: string[];
};

/** One column of the summary table. */
export type NetWorthColumn = {
  /** Unique within a table. */
  key: string;
  /** First day of the month; the current column carries the current date. */
  date: string;
  /** Index into the report's periods; null for a month without a report period. */
  index: number | null;
  isCurrent: boolean;
};

/**
 * Columns of the summary table for `year`: always January to December, with an empty column for every month that
 * has no report period, followed by the current period when its date falls in `year`. The last report period is the
 * current one; it never fills a month column.
 */
export function netWorthYearColumns({ periods }: Pick<NetWorthReport, "periods">, year: string): NetWorthColumn[] {
  const currentIndex = periods.length - 1;
  const indexByMonth = new Map(periods.slice(0, currentIndex).map((period, index) => [period.slice(0, 7), index]));
  const columns = monthStarts(`${year}-01-01`, `${year}-12-31`).map((month): NetWorthColumn => ({
    key: month,
    date: month,
    index: indexByMonth.get(month.slice(0, 7)) ?? null,
    isCurrent: false,
  }));

  const current = periods[currentIndex];
  if (current?.startsWith(year)) columns.push({ key: "current", date: current, index: currentIndex, isCurrent: true });
  return columns;
}

export type NetWorthGrowthPoint = {
  period: string;
  totalNetWorth: number | null;
  financialIncrease: number | null;
  salary: number | null;
  totalIncrease: number | null;
};

export function buildNetWorthReport({ currencies, periods, assets, warnings }: ValuedNetWorth): NetWorthReport {
  // A total is null when no asset has a value for the period; missing values are skipped, not counted as zero.
  const totalsFor = (datatype?: AssetDatatype) => currencies.map((_currency, currencyIndex) =>
    periods.map((_period, periodIndex) => {
      const values = assets
        .filter((asset) => datatype === undefined || asset.datatype === datatype)
        .map((asset) => asset.convertedValues[currencyIndex][periodIndex])
        .filter((value): value is number => value !== null);
      return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
    }),
  );

  const totals = totalsFor();
  const primaryTotals = totals[0] ?? [];
  const absoluteChanges = primaryTotals.map((value, index) => {
    const previous = primaryTotals[index - 1];
    return index === 0 || value === null || previous === null ? null : value - previous;
  });
  const percentageChanges = primaryTotals.map((value, index) => {
    const previous = primaryTotals[index - 1];
    return index === 0 || value === null || previous === null || previous === 0
      ? null
      : ((value - previous) / previous) * 100;
  });

  return {
    currencies,
    periods,
    // Explicit fields: the conversion matrix is calculation input and must not reach the client.
    rows: assets.map(({ asset, currency, datatype, instrumentName, instrumentUrl, values, ytdPerformance }) => ({
      asset,
      currency,
      datatype,
      instrumentName,
      instrumentUrl,
      values,
      ytdPerformance,
    })),
    totals,
    financialTotals: totalsFor("quantity"),
    cashTotals: totalsFor("cash"),
    otherTotals: totalsFor("value"),
    absoluteChanges,
    percentageChanges,
    warnings: [...new Set(warnings)],
  };
}

/** Per period: actual net-worth change next to its two documented sources, salary income and price gains. */
export function buildNetWorthGrowthSeries(
  report: NetWorthReport,
  transactions: ConvertedCashflowTransaction[],
  financialPriceIncreases: Array<Array<number | null>>,
  currencyIndex: number,
): NetWorthGrowthPoint[] {
  const totalValues = report.totals[currencyIndex] ?? [];

  return report.periods.map((period, index) => {
    const totalNetWorth = totalValues[index] ?? null;
    if (index === 0) {
      return { period, totalNetWorth, financialIncrease: null, salary: null, totalIncrease: null };
    }

    const previousPeriod = report.periods[index - 1];
    const previousNetWorth = totalValues[index - 1] ?? null;
    const salary = transactions.reduce((total, transaction) =>
      transaction.type === "income" && isSalary(transaction) && transaction.date > previousPeriod && transaction.date <= period
        ? total + transaction.amount
        : total, 0);

    return {
      period,
      totalNetWorth,
      financialIncrease: financialPriceIncreases[currencyIndex]?.[index] ?? null,
      salary,
      totalIncrease: totalNetWorth === null || previousNetWorth === null ? null : totalNetWorth - previousNetWorth,
    };
  });
}
