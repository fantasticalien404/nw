import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { loadNetWorthWorkbook } from "@/lib/sheets/net-worth";
import { downloadYahooPrices } from "@/lib/market-data/yahoo";

loadEnvConfig(process.cwd());

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function priceFilePath(symbol: string) {
  return join(process.cwd(), "data", "market-data", `${encodeURIComponent(symbol)}.json`);
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
  const targets = new Set([...netWorth.currencies, ...cashflow.reportingCurrencies]);
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
    const prices = await downloadYahooPrices(symbol, start, end);
    await writeFile(priceFilePath(symbol), `${JSON.stringify({ symbol, downloadedAt: new Date().toISOString(), prices }, null, 2)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.info(`Updated ${symbols.length} local market-data files.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Market-data download failed.");
  process.exitCode = 1;
});
