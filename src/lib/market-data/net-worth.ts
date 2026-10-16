import type { NetWorthWorkbook } from "@/lib/sheets/net-worth";
import { getFxRate, getLatestPrice, getPrice } from "./prices";

type AssetPriceChange = {
  currency: string;
  value: number;
} | null;

export async function loadFinancialPriceIncreases(
  workbook: NetWorthWorkbook,
  periods: string[],
): Promise<Array<Array<number | null>>> {
  const financialAssets = workbook.assets.filter((asset) => asset.datatype === "quantity");
  const priceRequests = new Map<string, Promise<number>>();
  const fxRequests = new Map<string, Promise<number>>();

  function loadPrice(asset: string, date: string, latest: boolean) {
    const key = `${asset}:${date}:${latest}`;
    const request = priceRequests.get(key) ?? (latest ? getLatestPrice(asset) : getPrice(asset, date));
    priceRequests.set(key, request);
    return request;
  }

  function loadFxRate(from: string, to: string, date: string) {
    const key = `${from}:${to}:${date}`;
    const request = fxRequests.get(key) ?? getFxRate(from, to, date);
    fxRequests.set(key, request);
    return request;
  }

  const periodChanges: Array<Promise<AssetPriceChange[]> | null> = periods.map((period, index) => {
    if (index === 0) return null;
    const previousPeriod = periods[index - 1];
    const currentIsLatest = index === periods.length - 1;

    return Promise.all(financialAssets.map(async (asset): Promise<AssetPriceChange> => {
      const holdings = asset.reportingValues.get(previousPeriod) ?? 0;
      if (holdings === 0) return { currency: asset.currency, value: 0 };

      try {
        const [previousPrice, currentPrice] = await Promise.all([
          loadPrice(asset.asset, previousPeriod, false),
          loadPrice(asset.asset, period, currentIsLatest),
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
        return change.value * await loadFxRate(change.currency, currency, periods[index - 1]);
      } catch {
        return null;
      }
    }));
    if (convertedChanges.some((change) => change === null)) return null;
    return convertedChanges.reduce<number>((total, change) => total + (change ?? 0), 0);
  }))));
}
