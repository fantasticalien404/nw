import { BenchmarkComparison } from "@/components/net-worth/benchmark-comparison";
import { NetWorthPortfolio } from "@/components/net-worth/net-worth-portfolio";
import type { BenchmarkInput } from "@/lib/analytics/benchmark";
import { buildNetWorthReport } from "@/lib/analytics/net-worth";
import { loadBenchmarkPrices } from "@/lib/market-data/benchmark";
import { convertCashflowTransactions } from "@/lib/market-data/cashflow";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { loadNetWorthWorkbook } from "@/lib/sheets/net-worth";
import { connection } from "next/server";

export const instant = false;

function benchmarkContributionDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(1);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatMoney(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

async function loadReport() {
  try {
    const report = await buildNetWorthReport(await loadNetWorthWorkbook());
    const benchmarkInputs: BenchmarkInput[] = report.currencies.map((currency, index) => ({
      currency,
      portfolio: report.periods.map((date, periodIndex) => ({ date, value: report.financialTotals[index]?.[periodIndex] ?? null })),
      cashflows: [],
      prices: [],
    }));

    try {
      const workbook = await loadCashflowWorkbook();
      const asOfDate = report.periods.at(-1)!;
      const transactionsThroughToday = workbook.transactions.filter((transaction) => transaction.date <= asOfDate);
      await Promise.all(benchmarkInputs.map(async (input) => {
        const transactions = await convertCashflowTransactions(transactionsThroughToday, input.currency);
        input.cashflows = transactions.flatMap((transaction) => {
          if (transaction.type === "contribution") {
            return [{ date: benchmarkContributionDate(transaction.date), amount: transaction.amount }];
          }
          if (transaction.type === "income" && transaction.category?.toLowerCase() === "withdrawal") {
            return [{ date: transaction.date, amount: -transaction.amount }];
          }
          return [];
        });
        input.prices = await loadBenchmarkPrices(report.periods[0], addDays(report.periods.at(-1)!, 1), input.currency);
      }));
    } catch {
      report.warnings.push("Benchmark comparison data could not be loaded.");
    }

    return { report, benchmarkInputs, error: null };
  } catch (error) {
    return {
      report: null,
      benchmarkInputs: null,
      error: error instanceof Error ? error.message : "The net-worth data could not be loaded.",
    };
  }
}

export default async function NetWorthPage() {
  await connection();
  const { report, benchmarkInputs, error } = await loadReport();

  if (error || !report) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Net worth</h1>
        <p className="mt-4 border border-zinc-300 bg-zinc-50 p-4 text-zinc-800">{error}</p>
      </main>
    );
  }

  const currentNetWorth = report.totals[0]?.at(-1) ?? null;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-10 border-b border-zinc-300 pb-6">
        <p className="mb-2 text-sm text-zinc-600">Current net worth</p>
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          {formatMoney(currentNetWorth)} {report.currencies[0]}
        </h1>
      </header>

      <NetWorthPortfolio report={report} />

      {benchmarkInputs && <BenchmarkComparison inputs={benchmarkInputs} />}
    </main>
  );
}
