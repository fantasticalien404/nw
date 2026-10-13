import { getAdjustedPriceHistory, getPriceHistory } from "@/lib/market-data/prices";
import type { BenchmarkPrice } from "@/lib/analytics/benchmark";

const STOCK_TICKER = "ACWI";
const BOND_TICKER = "BND";

export async function loadBenchmarkPrices(start: string, end: string, currency: string): Promise<BenchmarkPrice[]> {
  const [stocks, bonds, fx] = await Promise.all([
    getAdjustedPriceHistory(STOCK_TICKER, start, end),
    getAdjustedPriceHistory(BOND_TICKER, start, end),
    currency === "USD" ? Promise.resolve([]) : getPriceHistory(`USD${currency}=X`, start, end),
  ]);
  const bondsByDate = new Map(bonds.map((point) => [point.date, point.close]));
  const fxByDate = new Map(fx.map((point) => [point.date, point.close]));

  return stocks.flatMap((stock) => {
    const bond = bondsByDate.get(stock.date);
    const rate = currency === "USD" ? 1 : fxByDate.get(stock.date);
    return bond === undefined || rate === undefined ? [] : [{ date: stock.date, stock: stock.close * rate, bond: bond * rate }];
  });
}
