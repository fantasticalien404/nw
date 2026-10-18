import type { CashflowTransaction, ConvertedCashflowTransaction } from "@/types/workbook";
import type { MarketData } from "./prices";

/** Converts every transaction to `targetCurrency` at the historical FX rate of its own date. */
export async function convertCashflowTransactions(
  market: MarketData,
  transactions: CashflowTransaction[],
  targetCurrency: string,
): Promise<ConvertedCashflowTransaction[]> {
  return Promise.all(
    transactions.map(async ({ currency, ...transaction }) => {
      if (currency === targetCurrency) return transaction;
      return { ...transaction, amount: transaction.amount * await market.fxRate(currency, targetCurrency, transaction.date) };
    }),
  );
}
