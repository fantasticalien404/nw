import { nextDay, today } from "@/lib/dates";
import type { ValuedAsset, ValuedNetWorth } from "@/types/net-worth";
import type { AssetRow, NetWorthWorkbook } from "@/types/workbook";
import type { MarketData } from "./prices";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function quoteUrl(symbol: string) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}

/** Quantity assets are priced; cash and manual values are reported as-is. The last period is "current". */
async function valueInPeriod(
  market: MarketData,
  asset: AssetRow,
  period: string,
  isCurrent: boolean,
  latestReportingPeriod: string,
) {
  const reported = asset.reportingValues.get(isCurrent ? latestReportingPeriod : period) ?? null;
  if (reported === null) return null;
  if (asset.datatype !== "quantity") return reported;

  const price = isCurrent ? await market.latestPrice(asset.asset) : await market.price(asset.asset, period);
  return reported * price;
}

async function calculateYtdPerformance(market: MarketData, asset: AssetRow, currencies: string[], date: string) {
  if (asset.datatype !== "quantity") {
    return Object.fromEntries(currencies.map((currency) => [currency, null]));
  }

  const prices = await market.adjustedHistory(asset.asset, `${date.slice(0, 4)}-01-01`, nextDay(date));
  const first = prices[0];
  const last = prices[prices.length - 1];

  return Object.fromEntries(await Promise.all(currencies.map(async (currency) => {
    const initialValue = first.close * await market.fxRate(asset.currency, currency, first.date);
    const currentValue = last.close * await market.latestFxRate(asset.currency, currency);
    return [currency, initialValue === 0 ? null : (currentValue / initialValue - 1) * 100];
  })));
}

/** Values one asset for every period and report currency. Failed lookups become null plus a warning. */
async function valueAsset(
  market: MarketData,
  asset: AssetRow,
  currencies: string[],
  periods: string[],
  latestReportingPeriod: string,
  currentDate: string,
) {
  const warnings: string[] = [];
  const lastIndex = periods.length - 1;

  const values = await Promise.all(periods.map(async (period, index) => {
    try {
      return await valueInPeriod(market, asset, period, index === lastIndex, latestReportingPeriod);
    } catch (error) {
      warnings.push(errorMessage(error, `Unable to value ${asset.asset}.`));
      return null;
    }
  }));

  let ytdPerformance: ValuedAsset["ytdPerformance"];
  try {
    ytdPerformance = await calculateYtdPerformance(market, asset, currencies, currentDate);
  } catch (error) {
    warnings.push(errorMessage(error, `Unable to calculate YTD performance for ${asset.asset}.`));
    ytdPerformance = Object.fromEntries(currencies.map((currency) => [currency, null]));
  }

  const convertedValues = await Promise.all(currencies.map((currency) => Promise.all(periods.map(async (period, index) => {
    const value = values[index];
    if (value === null) return null;
    try {
      const rate = index === lastIndex
        ? await market.latestFxRate(asset.currency, currency)
        : await market.fxRate(asset.currency, currency, period);
      return value * rate;
    } catch (error) {
      warnings.push(errorMessage(error, `Unable to convert ${asset.currency} to ${currency}.`));
      return null;
    }
  }))));

  const isQuantity = asset.datatype === "quantity";
  const valued: ValuedAsset = {
    asset: asset.asset,
    currency: asset.currency,
    datatype: asset.datatype,
    instrumentName: isQuantity ? asset.displayName ?? asset.fullName : null,
    instrumentUrl: isQuantity ? quoteUrl(asset.asset) : null,
    values,
    convertedValues,
    ytdPerformance,
  };
  return { valued, warnings };
}

/**
 * Prices and converts every workbook asset using local market data. The final period is `currentDate`: it shows the
 * latest reported cash/manual values and the latest prices and FX rates. Reporting periods after the latest one with
 * values are still empty columns: they are left out so `currentDate` directly follows the last valued period.
 */
export async function valueNetWorth(
  market: MarketData,
  workbook: NetWorthWorkbook,
  currentDate = today(),
): Promise<ValuedNetWorth> {
  const latestIndex = workbook.reportingPeriods.findLastIndex((period) =>
    workbook.assets.some((asset) => asset.reportingValues.has(period)),
  );
  if (latestIndex < 0) {
    throw new Error("The assets tab must include at least one reporting-period value.");
  }

  const latestReportingPeriod = workbook.reportingPeriods[latestIndex];
  const periods = [...workbook.reportingPeriods.slice(0, latestIndex + 1), currentDate];
  const results = await Promise.all(workbook.assets.map((asset) =>
    valueAsset(market, asset, workbook.currencies, periods, latestReportingPeriod, currentDate),
  ));

  return {
    currencies: workbook.currencies,
    periods,
    assets: results.map(({ valued }) => valued),
    warnings: results.flatMap(({ warnings }) => warnings),
  };
}

type PriceChange = { currency: string; value: number } | null;

/**
 * Per report currency and period: the summed price change of quantity assets over the period, times the holdings at
 * the start of the period, converted at the start-of-period FX rate. Null when any price or rate is missing.
 */
export async function loadFinancialPriceIncreases(
  market: MarketData,
  workbook: NetWorthWorkbook,
  periods: string[],
): Promise<Array<Array<number | null>>> {
  const financialAssets = workbook.assets.filter((asset) => asset.datatype === "quantity");

  // Each asset's change in its own currency, per period; the first period has no predecessor.
  const periodChanges: Array<Promise<PriceChange[]> | null> = periods.map((period, index) => {
    if (index === 0) return null;
    const previousPeriod = periods[index - 1];
    const currentIsLatest = index === periods.length - 1;

    return Promise.all(financialAssets.map(async (asset): Promise<PriceChange> => {
      const holdings = asset.reportingValues.get(previousPeriod) ?? 0;
      if (holdings === 0) return { currency: asset.currency, value: 0 };

      try {
        const [previousPrice, currentPrice] = await Promise.all([
          market.price(asset.asset, previousPeriod),
          currentIsLatest ? market.latestPrice(asset.asset) : market.price(asset.asset, period),
        ]);
        return { currency: asset.currency, value: (currentPrice - previousPrice) * holdings };
      } catch {
        return null;
      }
    }));
  });

  return Promise.all(workbook.currencies.map((currency) => Promise.all(periods.map(async (_period, index) => {
    const changes = periodChanges[index];
    if (changes === null) return null;

    const assetChanges = await changes;
    if (assetChanges.some((change) => change === null)) return null;

    const convertedChanges = await Promise.all(assetChanges.map(async (change) => {
      if (!change || change.value === 0) return 0;
      try {
        return change.value * await market.fxRate(change.currency, currency, periods[index - 1]);
      } catch {
        return null;
      }
    }));
    if (convertedChanges.some((change) => change === null)) return null;
    return convertedChanges.reduce<number>((total, change) => total + (change ?? 0), 0);
  }))));
}
