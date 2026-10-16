import {
  getAdjustedPriceHistory,
  getFxRate,
  getInstrumentUrl,
  getLatestFxRate,
  getLatestPrice,
  getPrice,
} from "@/lib/market-data/prices";
import type { ConvertedCashflowTransaction } from "@/lib/market-data/cashflow";
import type { AssetRow, NetWorthWorkbook } from "@/lib/sheets/net-worth";

export type NetWorthRow = {
  asset: string;
  currency: string;
  datatype: AssetRow["datatype"];
  instrumentName: string | null;
  instrumentUrl: string | null;
  values: Array<number | null>;
  ytdPerformance: Record<string, number | null>;
};

export type NetWorthReport = {
  currencies: string[];
  periods: string[];
  rows: NetWorthRow[];
  totals: Array<Array<number | null>>;
  financialTotals: Array<Array<number | null>>;
  cashTotals: Array<Array<number | null>>;
  otherTotals: Array<Array<number | null>>;
  absoluteChanges: Array<number | null>;
  percentageChanges: Array<number | null>;
  warnings: string[];
};

export type NetWorthGrowthPoint = {
  period: string;
  totalNetWorth: number | null;
  financialIncrease: number | null;
  salary: number | null;
  totalIncrease: number | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ytdStart(date: string) {
  return `${date.slice(0, 4)}-01-01`;
}

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

async function calculateYtdPerformance(asset: AssetRow, currencies: string[], date: string) {
  if (asset.datatype !== "quantity") {
    return Object.fromEntries(currencies.map((currency) => [currency, null]));
  }

  const prices = await getAdjustedPriceHistory(asset.asset, ytdStart(date), nextDay(date));
  const first = prices[0];
  const last = prices.at(-1);
  if (!first || !last) {
    return Object.fromEntries(currencies.map((currency) => [currency, null]));
  }

  return Object.fromEntries(await Promise.all(currencies.map(async (currency) => {
    const initialFx = await getFxRate(asset.currency, currency, first.date);
    const currentFx = await getLatestFxRate(asset.currency, currency);
    const initialValue = first.close * initialFx;
    const currentValue = last.close * currentFx;
    return [currency, initialValue === 0 ? null : (currentValue / initialValue - 1) * 100];
  })));
}

function latestValue(asset: AssetRow, latestReportingPeriod: string) {
  return asset.reportingValues.get(latestReportingPeriod) ?? null;
}

async function convert(value: number, from: string, to: string, date: string, currentPeriod: boolean) {
  const rate = currentPeriod
    ? await getLatestFxRate(from, to)
    : await getFxRate(from, to, date);
  return value * rate;
}

async function valueAsset(
  asset: AssetRow,
  period: string,
  currentPeriod: boolean,
  latestReportingPeriod: string,
) {
  const reportedValue = currentPeriod
    ? latestValue(asset, latestReportingPeriod)
    : asset.reportingValues.get(period) ?? null;
  if (reportedValue === null) {
    return null;
  }

  if (asset.datatype !== "quantity") {
    return reportedValue;
  }

  const price = currentPeriod
    ? await getLatestPrice(asset.asset)
    : await getPrice(asset.asset, period);
  return reportedValue * price;
}

async function calculateTotals(rows: NetWorthRow[], currencies: string[], periods: string[], warnings: string[]) {
  return Promise.all(
    currencies.map(async (currency) =>
      Promise.all(
        periods.map(async (period, periodIndex) => {
          const values = await Promise.all(rows.map(async (row) => {
            const value = row.values[periodIndex];
            if (value === null) return null;
            try {
              return await convert(value, row.currency, currency, period, periodIndex === periods.length - 1);
            } catch (error) {
              warnings.push(error instanceof Error ? error.message : `Unable to convert ${row.currency} to ${currency}.`);
              return null;
            }
          }));
          const availableValues = values.filter((value): value is number => value !== null);
          return availableValues.length > 0 ? availableValues.reduce((total, value) => total + value, 0) : null;
        }),
      ),
    ),
  );
}

export async function buildNetWorthReport(workbook: NetWorthWorkbook): Promise<NetWorthReport> {
  const currentPeriod = today();
  const latestReportingPeriod = [...workbook.reportingPeriods]
    .reverse()
    .find((period) => workbook.assets.some((asset) => asset.reportingValues.has(period)));

  if (!latestReportingPeriod) {
    throw new Error("The assets tab must include at least one reporting-period value.");
  }

  const periods = [...workbook.reportingPeriods, currentPeriod];
  const warnings: string[] = [];
  const rows = await Promise.all(
    workbook.assets.map(async (asset) => {
      const values = await Promise.all(
        periods.map(async (period, index) => {
          try {
            return await valueAsset(asset, period, index === periods.length - 1, latestReportingPeriod);
          } catch (error) {
            warnings.push(error instanceof Error ? error.message : `Unable to value ${asset.asset}.`);
            return null;
          }
        }),
      );

      let instrumentName: string | null = null;
      let instrumentUrl: string | null = null;
      let ytdPerformance: Record<string, number | null>;

      if (asset.datatype === "quantity") {
        instrumentName = asset.displayName ?? asset.fullName;
        instrumentUrl = getInstrumentUrl(asset.asset);
      }

      try {
        ytdPerformance = await calculateYtdPerformance(asset, workbook.currencies, currentPeriod);
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : `Unable to calculate YTD performance for ${asset.asset}.`);
        ytdPerformance = Object.fromEntries(workbook.currencies.map((currency) => [currency, null]));
      }

      return {
        asset: asset.asset,
        currency: asset.currency,
        datatype: asset.datatype,
        instrumentName,
        instrumentUrl,
        values,
        ytdPerformance,
      };
    }),
  );
  const totals = await calculateTotals(rows, workbook.currencies, periods, warnings);
  const financialTotals = await calculateTotals(rows.filter((row) => row.datatype === "quantity"), workbook.currencies, periods, warnings);
  const cashTotals = await calculateTotals(rows.filter((row) => row.datatype === "cash"), workbook.currencies, periods, warnings);
  const otherTotals = await calculateTotals(rows.filter((row) => row.datatype === "value"), workbook.currencies, periods, warnings);
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
    currencies: workbook.currencies,
    periods,
    rows,
    totals,
    financialTotals,
    cashTotals,
    otherTotals,
    absoluteChanges,
    percentageChanges,
    warnings: [...new Set(warnings)],
  };
}

function benchmarkContributionDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}

export function buildNetWorthGrowthSeries(
  report: NetWorthReport,
  transactions: ConvertedCashflowTransaction[],
  currencyIndex: number,
): NetWorthGrowthPoint[] {
  const totalValues = report.totals[currencyIndex] ?? [];
  const financialValues = report.financialTotals[currencyIndex] ?? [];

  return report.periods.map((period, index) => {
    if (index === 0) {
      return {
        period,
        totalNetWorth: totalValues[index] ?? null,
        financialIncrease: null,
        salary: null,
        totalIncrease: null,
      };
    }

    const previousPeriod = report.periods[index - 1];
    const totalNetWorth = totalValues[index] ?? null;
    const previousNetWorth = totalValues[index - 1] ?? null;
    const financialValue = financialValues[index] ?? null;
    const previousFinancialValue = financialValues[index - 1] ?? null;
    const externalFlows = transactions.reduce((total, transaction) => {
      const flowDate = transaction.type === "contribution"
        ? benchmarkContributionDate(transaction.date)
        : transaction.date;
      if (flowDate <= previousPeriod || flowDate > period) return total;
      if (transaction.type === "contribution") return total + transaction.amount;
      if (transaction.type === "income" && transaction.category?.toLowerCase() === "withdrawal") {
        return total - transaction.amount;
      }
      return total;
    }, 0);
    const salary = transactions.reduce((total, transaction) =>
      transaction.type === "income"
        && transaction.category?.toLowerCase() === "salary"
        && transaction.date > previousPeriod
        && transaction.date <= period
        ? total + transaction.amount
        : total, 0);

    return {
      period,
      totalNetWorth,
      financialIncrease: financialValue === null || previousFinancialValue === null
        ? null
        : financialValue - previousFinancialValue - externalFlows,
      salary,
      totalIncrease: totalNetWorth === null || previousNetWorth === null
        ? null
        : totalNetWorth - previousNetWorth,
    };
  });
}
