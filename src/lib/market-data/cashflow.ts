import { getYahooFxRate } from "@/lib/market-data/yahoo";
import type { CashflowTransaction } from "@/lib/sheets/cashflow";

export type ConvertedCashflowTransaction = Omit<CashflowTransaction, "amount" | "currency"> & {
  amount: number;
};

export async function convertCashflowTransactions(
  transactions: CashflowTransaction[],
  targetCurrency: string,
): Promise<ConvertedCashflowTransaction[]> {
  const rates = new Map<string, Promise<number>>();

  return Promise.all(
    transactions.map(async (transaction) => {
      const { currency, ...converted } = transaction;
      if (currency === targetCurrency) {
        return converted;
      }

      const key = `${currency}:${transaction.date}`;
      const rate = rates.get(key) ?? getYahooFxRate(currency, targetCurrency, transaction.date);
      rates.set(key, rate);

      return { ...converted, amount: transaction.amount * await rate };
    }),
  );
}
