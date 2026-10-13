import { CashflowDashboard } from "@/components/cashflow/cashflow-dashboard";
import { buildCashflowReport } from "@/lib/analytics/cashflow";
import { convertCashflowTransactions } from "@/lib/market-data/cashflow";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { connection } from "next/server";

export const instant = false;

async function loadReport() {
  try {
    const workbook = await loadCashflowWorkbook();
    const currency = workbook.reportingCurrencies[0];
    const transactions = await convertCashflowTransactions(workbook.transactions, currency);
    return {
      currency,
      report: buildCashflowReport(transactions, workbook.categories),
      error: null,
    };
  } catch (error) {
    return {
      currency: null,
      report: null,
      error: error instanceof Error ? error.message : "The cashflow data could not be loaded.",
    };
  }
}

export default async function CashflowPage() {
  await connection();
  const { currency, report, error } = await loadReport();

  if (error || !report || !currency) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Cashflow</h1>
        <p className="mt-4 border border-zinc-300 bg-zinc-50 p-4 text-zinc-800">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-10 border-b border-zinc-300 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-black">Cashflow</h1>
      </header>
      <CashflowDashboard report={report} currency={currency} />
    </main>
  );
}
