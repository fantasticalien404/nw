import { NetWorthPortfolio } from "@/components/net-worth/net-worth-portfolio";
import type { BenchmarkInput } from "@/lib/analytics/benchmark";
import { buildHallOfFame, type HallOfFameMetric } from "@/lib/analytics/hall-of-fame";
import { buildNetWorthGrowthSeries, buildNetWorthReport, type NetWorthGrowthPoint } from "@/lib/analytics/net-worth";
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

async function loadReport() {
  try {
    const workbook = await loadNetWorthWorkbook();
    const report = await buildNetWorthReport(workbook);
    const hallOfFameCurrencies = ["CHF", "EUR"] as const;
    const hallOfFameNetWorthReport = hallOfFameCurrencies.every((currency) => report.currencies.includes(currency))
      ? report
      : await buildNetWorthReport({ ...workbook, currencies: [...hallOfFameCurrencies] });
    const benchmarkInputs: BenchmarkInput[] = report.currencies.map((currency, index) => ({
      currency,
      portfolio: report.periods.map((date, periodIndex) => ({ date, value: report.financialTotals[index]?.[periodIndex] ?? null })),
      cashflows: [],
      prices: [],
    }));
    let growthSeries: NetWorthGrowthPoint[][] | null = null;
    let hallOfFame: HallOfFameMetric[] | null = null;

    try {
      const cashflowWorkbook = await loadCashflowWorkbook();
      const asOfDate = report.periods.at(-1)!;
      const transactionsThroughToday = cashflowWorkbook.transactions.filter((transaction) => transaction.date <= asOfDate);
      const convertedTransactions = await Promise.all(report.currencies.map((currency) =>
        convertCashflowTransactions(transactionsThroughToday, currency),
      ));
      growthSeries = convertedTransactions.map((transactions, index) =>
        buildNetWorthGrowthSeries(report, transactions, index),
      );
      const transactionsByCurrency = Object.fromEntries(await Promise.all(hallOfFameCurrencies.map(async (currency) => {
        const existingIndex = report.currencies.indexOf(currency);
        const transactions = existingIndex >= 0
          ? convertedTransactions[existingIndex]
          : await convertCashflowTransactions(transactionsThroughToday, currency);
        return [currency, transactions];
      }))) as Record<(typeof hallOfFameCurrencies)[number], typeof convertedTransactions[number]>;
      hallOfFame = buildHallOfFame(hallOfFameNetWorthReport, transactionsByCurrency, asOfDate);

      await Promise.all(benchmarkInputs.map(async (input, index) => {
        const transactions = convertedTransactions[index];
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
      report.warnings.push("Cashflow or benchmark comparison data could not be loaded.");
    }

    return { report, benchmarkInputs, growthSeries, hallOfFame, error: null };
  } catch (error) {
    return {
      report: null,
      benchmarkInputs: null,
      growthSeries: null,
      hallOfFame: null,
      error: error instanceof Error ? error.message : "The net-worth data could not be loaded.",
    };
  }
}

export default async function NetWorthPage() {
  await connection();
  const { report, benchmarkInputs, growthSeries, hallOfFame, error } = await loadReport();

  if (error || !report) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Net worth</h1>
        <p className="mt-3 border border-zinc-300 bg-zinc-50 px-4 py-3 text-zinc-800">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <NetWorthPortfolio report={report} benchmarkInputs={benchmarkInputs} growthSeries={growthSeries} hallOfFame={hallOfFame} />
    </main>
  );
}
