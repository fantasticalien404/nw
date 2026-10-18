// Refreshes the local price store in data/market-data from Yahoo Finance. Run with `npm run download:market-data`.
// This is the only code that calls the market-data provider for the stored files.
import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { addDays, today } from "@/lib/dates";
import { marketDataDirectory, priceFilePath } from "@/lib/market-data/prices";
import { requiredMarketSymbols } from "@/lib/market-data/symbols";
import { downloadYahooPrices } from "@/lib/market-data/yahoo";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { loadNetWorthWorkbook } from "@/lib/sheets/net-worth";

loadEnvConfig(process.cwd());

async function main() {
  const [netWorth, cashflow] = await Promise.all([loadNetWorthWorkbook(), loadCashflowWorkbook()]);
  const [start] = [...netWorth.reportingPeriods, ...cashflow.transactions.map((transaction) => transaction.date)].sort();
  if (!start) {
    throw new Error("The workbook has no dates to price.");
  }

  const symbols = requiredMarketSymbols(netWorth, cashflow);
  const end = addDays(today(), 1);

  await mkdir(marketDataDirectory(), { recursive: true });
  for (const symbol of symbols) {
    const prices = await downloadYahooPrices(symbol, start, end);
    await writeFile(priceFilePath(symbol), `${JSON.stringify({ symbol, downloadedAt: new Date().toISOString(), prices }, null, 2)}\n`);
    // Stay polite to the provider.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.info(`Updated ${symbols.length} local market-data files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Market-data download failed.");
  process.exitCode = 1;
});
