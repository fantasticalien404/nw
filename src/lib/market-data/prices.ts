import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type MarketPrice = {
  date: string;
  close: number;
  adjustedClose: number | null;
};

type PriceFile = {
  symbol: string;
  downloadedAt: string;
  prices: MarketPrice[];
};

function priceFilePath(symbol: string) {
  return join(process.cwd(), "data", "market-data", `${encodeURIComponent(symbol)}.json`);
}

async function loadPrices(symbol: string): Promise<MarketPrice[]> {
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

function pricesInRange(prices: MarketPrice[], start: string, end: string) {
  return prices.filter((price) => price.date >= start && price.date < end);
}

export async function getPriceHistory(symbol: string, start: string, end: string) {
  return pricesInRange(await loadPrices(symbol), start, end).map(({ date, close }) => ({ date, close }));
}

export async function getAdjustedPriceHistory(symbol: string, start: string, end: string) {
  const prices = pricesInRange(await loadPrices(symbol), start, end).flatMap(({ date, adjustedClose }) => (
    adjustedClose === null ? [] : [{ date, close: adjustedClose }]
  ));
  if (prices.length === 0) {
    throw new Error(`Local market data has no adjusted prices for ${symbol}.`);
  }
  return prices;
}

export async function getPrice(symbol: string, date: string) {
  const price = (await loadPrices(symbol)).find((entry) => entry.date >= date)?.close;
  if (price === undefined) {
    throw new Error(`Local market data has no price for ${symbol} on or after ${date}.`);
  }
  return price;
}

export async function getLatestPrice(symbol: string) {
  const price = (await loadPrices(symbol)).at(-1)?.close;
  if (price === undefined) {
    throw new Error(`Local market data has no latest price for ${symbol}.`);
  }
  return price;
}

export function getInstrumentUrl(symbol: string) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}

export async function getFxRate(fromCurrency: string, toCurrency: string, date: string) {
  if (fromCurrency === toCurrency) return 1;
  return getPrice(`${fromCurrency}${toCurrency}=X`, date);
}

export async function getLatestFxRate(fromCurrency: string, toCurrency: string) {
  if (fromCurrency === toCurrency) return 1;
  return getLatestPrice(`${fromCurrency}${toCurrency}=X`);
}
