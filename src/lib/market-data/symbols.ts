import type { CashflowWorkbook, NetWorthWorkbook } from "@/types/workbook";
import { BENCHMARK_TICKERS } from "./benchmark";

/**
 * Every Yahoo symbol the dashboards look up: quantity tickers, the benchmark ETFs, and an FX pair from each currency
 * in the workbooks to each reporting currency.
 */
export function requiredMarketSymbols(netWorth: NetWorthWorkbook, cashflow: CashflowWorkbook) {
  const currencies = new Set([
    ...netWorth.currencies,
    ...netWorth.assets.map((asset) => asset.currency),
    ...cashflow.transactions.map((transaction) => transaction.currency),
  ]);
  const reportingCurrencies = new Set([...netWorth.currencies, ...cashflow.reportingCurrencies]);
  const fxSymbols = [...currencies].flatMap((from) =>
    [...reportingCurrencies].filter((to) => to !== from).map((to) => `${from}${to}=X`),
  );
  const tickers = netWorth.assets.filter((asset) => asset.datatype === "quantity").map((asset) => asset.asset);

  return [...new Set([...tickers, BENCHMARK_TICKERS.stock, BENCHMARK_TICKERS.bond, ...fxSymbols])].sort();
}
