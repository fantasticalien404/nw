import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { downloadYahooPrices } from "./yahoo";

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
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

function mergePrices(localPrices: MarketPrice[], downloadedPrices: MarketPrice[]) {
  const pricesByDate = new Map(localPrices.map((price) => [price.date, price]));
  for (const price of downloadedPrices) pricesByDate.set(price.date, price);
  return [...pricesByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

async function pricesThrough(symbol: string, end: string) {
  const localPrices = await loadPrices(symbol);
  const latestLocalDate = localPrices.at(-1)?.date;
  if (!latestLocalDate || end <= nextDay(latestLocalDate)) return localPrices;

  try {
    return mergePrices(localPrices, await downloadYahooPrices(symbol, nextDay(latestLocalDate), end));
  } catch {
    return localPrices;
  }
}

export async function getPriceHistory(symbol: string, start: string, end: string) {
  return pricesInRange(await pricesThrough(symbol, end), start, end).map(({ date, close }) => ({ date, close }));
}

export async function getAdjustedPriceHistory(symbol: string, start: string, end: string) {
  const prices = pricesInRange(await pricesThrough(symbol, end), start, end).flatMap(({ date, adjustedClose }) => (
    adjustedClose === null ? [] : [{ date, close: adjustedClose }]
  ));
  if (prices.length === 0) {
    throw new Error(`Local market data has no adjusted prices for ${symbol}.`);
  }
  return prices;
}

export async function getPrice(symbol: string, date: string) {
  const prices = await pricesThrough(symbol, nextDay(today()));
  const price = prices.find((entry) => entry.date >= date)?.close ?? prices.at(-1)?.close;
  if (price === undefined) {
    throw new Error(`Local market data has no price for ${symbol} on or after ${date}.`);
  }
  return price;
}

export async function getLatestPrice(symbol: string) {
  const price = (await pricesThrough(symbol, nextDay(today()))).at(-1)?.close;
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
