import { buildCashflowReport, type CashflowReport } from "@/lib/analytics/cashflow";
import { convertCashflowTransactions } from "@/lib/market-data/cashflow";
import { createMarketData } from "@/lib/market-data/prices";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import type { CashflowWorkbook } from "@/types/workbook";

export type CashflowPageData =
  | { currency: string; reports: Record<string, CashflowReport>; error: null }
  | { currency: null; reports: null; error: string };

/** Loads the workbook and builds one cashflow report per reporting currency (`CURRENCY_1` is the default). */
export async function loadCashflowPage(loadWorkbook: () => Promise<CashflowWorkbook> = loadCashflowWorkbook): Promise<CashflowPageData> {
  try {
    const workbook = await loadWorkbook();
    const market = createMarketData();
    const reports = await Promise.all(workbook.reportingCurrencies.map(async (currency) => {
      const transactions = await convertCashflowTransactions(market, workbook.transactions, currency);
      return [currency, buildCashflowReport(transactions, workbook.categories)] as const;
    }));
    return { currency: workbook.reportingCurrencies[0], reports: Object.fromEntries(reports), error: null };
  } catch (error) {
    return {
      currency: null,
      reports: null,
      error: error instanceof Error ? error.message : "The cashflow data could not be loaded.",
    };
  }
}
