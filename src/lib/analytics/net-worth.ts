import {
  getYahooFxRate,
  getYahooLatestFxRate,
  getYahooLatestPrice,
  getYahooPrice,
} from "@/lib/market-data/yahoo";
import type { AssetRow, NetWorthWorkbook } from "@/lib/sheets/net-worth";

export type NetWorthRow = {
  asset: string;
  currency: string;
  datatype: AssetRow["datatype"];
  values: Array<number | null>;
};

export type NetWorthReport = {
  currencies: string[];
  periods: string[];
  rows: NetWorthRow[];
  totals: Array<Array<number | null>>;
  absoluteChanges: Array<number | null>;
  warnings: string[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function latestValue(asset: AssetRow, latestReportingPeriod: string) {
  return asset.reportingValues.get(latestReportingPeriod) ?? null;
}

async function convert(value: number, from: string, to: string, date: string, currentPeriod: boolean) {
  const rate = currentPeriod
    ? await getYahooLatestFxRate(from, to)
    : await getYahooFxRate(from, to, date);
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
    ? await getYahooLatestPrice(asset.asset)
    : await getYahooPrice(asset.asset, period);
  return reportedValue * price;
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

      return { asset: asset.asset, currency: asset.currency, datatype: asset.datatype, values };
    }),
  );
  const totals = await Promise.all(
    workbook.currencies.map(async (currency) =>
      Promise.all(
        periods.map(async (period, periodIndex) => {
          const values = await Promise.all(
            rows.map(async (row) => {
              const value = row.values[periodIndex];
              if (value === null) {
                return null;
              }

              try {
                return await convert(
                  value,
                  row.currency,
                  currency,
                  period,
                  periodIndex === periods.length - 1,
                );
              } catch (error) {
                warnings.push(error instanceof Error ? error.message : `Unable to convert ${row.currency} to ${currency}.`);
                return null;
              }
            }),
          );
          const availableValues = values.filter((value): value is number => value !== null);
          return availableValues.length > 0
            ? availableValues.reduce((total, value) => total + value, 0)
            : null;
        }),
      ),
    ),
  );
  const primaryTotals = totals[0] ?? [];
  const absoluteChanges = primaryTotals.map((value, index) => {
    const previous = primaryTotals[index - 1];
    return index === 0 || value === null || previous === null ? null : value - previous;
  });

  return {
    currencies: workbook.currencies,
    periods,
    rows,
    totals,
    absoluteChanges,
    warnings: [...new Set(warnings)],
  };
}
