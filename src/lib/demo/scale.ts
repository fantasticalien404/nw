// Demo mode: every money amount in a workbook is multiplied by one factor before valuation and analytics, so
// totals, charts and the benchmark stay consistent. Percentages, returns, names, categories and dates are untouched.
import type { CashflowWorkbook, NetWorthWorkbook } from "@/types/workbook";

/** Scales quantities (valued through prices) and reported cash/manual values. */
export function scaleNetWorthWorkbook(workbook: NetWorthWorkbook, multiplier: number): NetWorthWorkbook {
  if (multiplier === 1) return workbook;
  return {
    ...workbook,
    assets: workbook.assets.map((asset) => ({
      ...asset,
      reportingValues: new Map([...asset.reportingValues].map(([date, value]) => [date, value * multiplier])),
    })),
  };
}

export function scaleCashflowWorkbook(workbook: CashflowWorkbook, multiplier: number): CashflowWorkbook {
  if (multiplier === 1) return workbook;
  return {
    ...workbook,
    transactions: workbook.transactions.map((transaction) => ({ ...transaction, amount: transaction.amount * multiplier })),
  };
}
