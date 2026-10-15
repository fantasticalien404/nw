import { CashflowDashboard } from "@/components/cashflow/cashflow-dashboard";
import { buildCashflowReport } from "@/lib/analytics/cashflow";
import { convertCashflowTransactions } from "@/lib/market-data/cashflow";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { connection } from "next/server";

export const instant = false;

async function loadReport() {
  try {
    const workbook = await loadCashflowWorkbook();
    const reports = await Promise.all(workbook.reportingCurrencies.map(async (currency) => {
      const transactions = await convertCashflowTransactions(workbook.transactions, currency);
      return [currency, buildCashflowReport(transactions, workbook.categories)] as const;
    }));
    return {
      currency: workbook.reportingCurrencies[0],
      reports: Object.fromEntries(reports),
      error: null,
    };
  } catch (error) {
    return {
      currency: null,
      reports: null,
      error: error instanceof Error ? error.message : "The cashflow data could not be loaded.",
    };
  }
}

export default async function CashflowPage() {
  await connection();
  const { currency, reports, error } = await loadReport();

  if (error || !reports || !currency) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Cashflow</h1>
        <p className="mt-3 border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-800">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="mb-2 pb-2">
        <h1 className="text-3xl font-semibold tracking-tight text-black">Cashflow</h1>
      </header>
      <CashflowDashboard report={reports[currency]} reports={reports} currency={currency} />
    </main>
  );
}
