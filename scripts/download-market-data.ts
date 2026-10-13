import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { loadNetWorthWorkbook } from "@/lib/sheets/net-worth";

loadEnvConfig(process.cwd());

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{ close?: Array<number | null> }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
  };
};

type DownloadedPrice = {
  date: string;
  close: number;
  adjustedClose: number | null;
};

function unixSeconds(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function priceFilePath(symbol: string) {
  return join(process.cwd(), "data", "market-data", `${encodeURIComponent(symbol)}.json`);
}

async function downloadPrices(symbol: string, start: string, end: string): Promise<DownloadedPrice[]> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("period1", String(unixSeconds(start)));
  url.searchParams.set("period2", String(unixSeconds(end)));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");
  url.searchParams.set("includeAdjustedClose", "true");

  const response = await fetch(url, { headers: { "User-Agent": "nw-market-data-downloader/1.0" } });
  if (!response.ok) {
    throw new Error(`Yahoo Finance did not return data for ${symbol} (${response.status}).`);
  }

  const result = ((await response.json()) as YahooChartResponse).chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const adjustedCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const prices = timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    if (typeof close !== "number") return [];
    const adjustedClose = adjustedCloses[index];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close,
      adjustedClose: typeof adjustedClose === "number" ? adjustedClose : null,
    }];
  });

  if (prices.length === 0) {
    throw new Error(`Yahoo Finance has no prices for ${symbol}.`);
  }
  return prices;
}

async function main() {
  const [netWorth, cashflow] = await Promise.all([loadNetWorthWorkbook(), loadCashflowWorkbook()]);
  const dates = [
    ...netWorth.reportingPeriods,
    ...cashflow.transactions.map((transaction) => transaction.date),
  ].sort();
  const start = dates[0];
  if (!start) {
    throw new Error("The workbook has no dates to price.");
  }

  const currencies = new Set([
    ...netWorth.currencies,
    ...netWorth.assets.map((asset) => asset.currency),
    ...cashflow.transactions.map((transaction) => transaction.currency),
  ]);
  const targets = new Set([...netWorth.currencies, cashflow.primaryCurrency]);
  const fxSymbols = [...currencies].flatMap((from) => [...targets]
    .filter((to) => to !== from)
    .map((to) => `${from}${to}=X`));
  const symbols = [...new Set([
    ...netWorth.assets.filter((asset) => asset.datatype === "quantity").map((asset) => asset.asset),
    "ACWI",
    "BND",
    ...fxSymbols,
  ])].sort();
  const end = addDays(new Date().toISOString().slice(0, 10), 1);

  await mkdir(join(process.cwd(), "data", "market-data"), { recursive: true });
  for (const symbol of symbols) {
    const prices = await downloadPrices(symbol, start, end);
    await writeFile(priceFilePath(symbol), `${JSON.stringify({ symbol, downloadedAt: new Date().toISOString(), prices }, null, 2)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.info(`Updated ${symbols.length} local market-data files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Market-data download failed.");
  process.exitCode = 1;
});
