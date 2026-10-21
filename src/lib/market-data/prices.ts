import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MarketPrice } from "@/types/market-data";

type PriceFile = {
  symbol: string;
  downloadedAt: string;
  prices: MarketPrice[];
};

export function marketDataDirectory() {
  return join(process.cwd(), "data", "market-data");
}

export function priceFilePath(symbol: string) {
  return join(marketDataDirectory(), `${encodeURIComponent(symbol)}.json`);
}

async function loadPriceSeries(symbol: string): Promise<MarketPrice[]> {
  let contents: string;
  try {
    contents = await readFile(priceFilePath(symbol), "utf8");
  } catch {
    throw new Error(`Download market data for ${symbol} with npm run download:market-data.`);
  }

  let data: PriceFile;
  try {
    data = JSON.parse(contents) as PriceFile;
  } catch {
    throw new Error(`The local market-data file for ${symbol} is invalid.`);
  }

  if (data.symbol !== symbol || !Array.isArray(data.prices)) {
    throw new Error(`The local market-data file for ${symbol} is invalid.`);
  }

  return data.prices;
}

function inRange(prices: MarketPrice[], start: string, end: string) {
  return prices.filter((price) => price.date >= start && price.date < end);
}

/**
 * Price and FX lookups for one request. Each symbol is read once; every later lookup is
 * answered from memory. Create one per page render and pass it to the loaders.
 */
export function createMarketData() {
  const seriesBySymbol = new Map<string, Promise<MarketPrice[]>>();

  function series(symbol: string) {
    let prices = seriesBySymbol.get(symbol);
    if (!prices) {
      prices = loadPriceSeries(symbol);
      seriesBySymbol.set(symbol, prices);
    }
    return prices;
  }

  /** Close on the first trading day on or after `date`, or the latest close when `date` is past the data. */
  async function price(symbol: string, date: string) {
    const prices = await series(symbol);
    const close = prices.find((entry) => entry.date >= date)?.close ?? prices.at(-1)?.close;
    if (close === undefined) {
      throw new Error(`Local market data has no price for ${symbol} on or after ${date}.`);
    }
    return close;
  }

  async function latestPrice(symbol: string) {
    const close = (await series(symbol)).at(-1)?.close;
    if (close === undefined) {
      throw new Error(`Local market data has no latest price for ${symbol}.`);
    }
    return close;
  }

  return {
    price,
    latestPrice,
    /** Daily raw closes for `[start, end)`. */
    async history(symbol: string, start: string, end: string) {
      return inRange(await series(symbol), start, end).map(({ date, close }) => ({ date, close }));
    },
    /** Daily dividend-adjusted closes for `[start, end)`; throws when none are available. */
    async adjustedHistory(symbol: string, start: string, end: string) {
      const prices = inRange(await series(symbol), start, end).flatMap(({ date, adjustedClose }) => (
        adjustedClose === null ? [] : [{ date, close: adjustedClose }]
      ));
      if (prices.length === 0) {
        throw new Error(`Local market data has no adjusted prices for ${symbol}.`);
      }
      return prices;
    },
    async fxRate(fromCurrency: string, toCurrency: string, date: string) {
      return fromCurrency === toCurrency ? 1 : price(`${fromCurrency}${toCurrency}=X`, date);
    },
    async latestFxRate(fromCurrency: string, toCurrency: string) {
      return fromCurrency === toCurrency ? 1 : latestPrice(`${fromCurrency}${toCurrency}=X`);
    },
  };
}

export type MarketData = ReturnType<typeof createMarketData>;
