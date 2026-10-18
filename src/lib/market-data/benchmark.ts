import type { BenchmarkPrice } from "@/lib/analytics/benchmark";
import type { MarketData } from "./prices";

export const BENCHMARK_TICKERS = { stock: "ACWI", bond: "BND" } as const;

/** Daily total-return benchmark prices in `currency`, for dates where both the stock and bond price exist. */
export async function loadBenchmarkPrices(
  market: MarketData,
  start: string,
  end: string,
  currency: string,
): Promise<BenchmarkPrice[]> {
  const [stocks, bonds, fx] = await Promise.all([
    market.adjustedHistory(BENCHMARK_TICKERS.stock, start, end),
    market.adjustedHistory(BENCHMARK_TICKERS.bond, start, end),
    currency === "USD" ? Promise.resolve([]) : market.history(`USD${currency}=X`, start, end),
  ]);
  const bondsByDate = new Map(bonds.map((point) => [point.date, point.close]));
  const fxByDate = new Map(fx.map((point) => [point.date, point.close]));

  return stocks.flatMap((stock) => {
    const bond = bondsByDate.get(stock.date);
    const rate = currency === "USD" ? 1 : fxByDate.get(stock.date);
    return bond === undefined || rate === undefined ? [] : [{ date: stock.date, stock: stock.close * rate, bond: bond * rate }];
  });
}
