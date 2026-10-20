import { benchmarkCashflows, type BenchmarkInput } from "@/lib/analytics/benchmark";
import { buildHallOfFame, type HallOfFameMetric } from "@/lib/analytics/hall-of-fame";
import {
  buildNetWorthGrowthSeries,
  buildNetWorthReport,
  type NetWorthGrowthPoint,
  type NetWorthReport,
} from "@/lib/analytics/net-worth";
import { addDays } from "@/lib/dates";
import { loadBenchmarkPrices } from "@/lib/market-data/benchmark";
import { convertCashflowTransactions } from "@/lib/market-data/cashflow";
import { loadFinancialPriceIncreases, valueNetWorth } from "@/lib/market-data/net-worth";
import { createMarketData, type MarketData } from "@/lib/market-data/prices";
import { scaleCashflowWorkbook, scaleNetWorthWorkbook } from "@/lib/demo/scale";
import { loadCashflowWorkbook } from "@/lib/sheets/cashflow";
import { loadNetWorthWorkbook } from "@/lib/sheets/net-worth";
import type { CashflowWorkbook, ConvertedCashflowTransaction, NetWorthWorkbook } from "@/types/workbook";

// The hall of fame ranks months in these two currencies, whichever currencies the report uses.
const HALL_OF_FAME_CURRENCIES = ["CHF", "EUR"] as const;

export type NetWorthPageData =
  | {
    report: NetWorthReport;
    benchmarkInputs: BenchmarkInput[];
    /** Null (with a report warning) when cashflow data could not be loaded or converted. */
    growthSeries: NetWorthGrowthPoint[][] | null;
    hallOfFame: HallOfFameMetric[] | null;
    error: null;
  }
  | { report: null; benchmarkInputs: null; growthSeries: null; hallOfFame: null; error: string };

/** Where the page reads its workbooks from; tests replace these. */
export type NetWorthPageSources = {
  netWorth: () => Promise<NetWorthWorkbook>;
  cashflow: () => Promise<CashflowWorkbook>;
};

/** Cashflow transactions up to the report date, converted into every report currency. */
async function loadConvertedCashflow(market: MarketData, report: NetWorthReport, loadWorkbook: NetWorthPageSources["cashflow"]) {
  const asOfDate = report.periods[report.periods.length - 1];
  const { transactions: allTransactions } = await loadWorkbook();
  const transactions = allTransactions.filter((transaction) => transaction.date <= asOfDate);
  const converted = await Promise.all(report.currencies.map((currency) => convertCashflowTransactions(market, transactions, currency)));
  return { asOfDate, transactions, converted };
}

type Cashflow = Awaited<ReturnType<typeof loadConvertedCashflow>>;

async function buildHallOfFameSection(market: MarketData, report: NetWorthReport, hallOfFameReport: NetWorthReport, cashflow: Cashflow) {
  const transactionsByCurrency = Object.fromEntries(await Promise.all(HALL_OF_FAME_CURRENCIES.map(async (currency) => {
    const index = report.currencies.indexOf(currency);
    return [currency, index >= 0 ? cashflow.converted[index] : await convertCashflowTransactions(market, cashflow.transactions, currency)];
  }))) as Record<(typeof HALL_OF_FAME_CURRENCIES)[number], ConvertedCashflowTransaction[]>;
  return buildHallOfFame(hallOfFameReport, transactionsByCurrency, cashflow.asOfDate);
}

/** Fills each benchmark input with the portfolio's external cashflows and the benchmark prices. */
async function fillBenchmarkInputs(market: MarketData, report: NetWorthReport, benchmarkInputs: BenchmarkInput[], cashflow: Cashflow) {
  // The current period reuses the holdings of the period before it, so later flows are not in the portfolio yet.
  const holdingsDate = report.periods[report.periods.length - 2];
  await Promise.all(benchmarkInputs.map(async (input, index) => {
    input.cashflows = benchmarkCashflows(cashflow.converted[index], holdingsDate);
    input.prices = await loadBenchmarkPrices(market, report.periods[0], addDays(cashflow.asOfDate, 1), input.currency);
  }));
}

export const defaultNetWorthSources: NetWorthPageSources = { netWorth: loadNetWorthWorkbook, cashflow: loadCashflowWorkbook };

/** Loads the workbooks and local market data and builds everything the net-worth page renders. Amounts are scaled by `getMultiplier()` (1 = real values); it runs inside the `try` so a failure shows the page's error message instead of crashing it. */
export async function loadNetWorthPage(
  sources: NetWorthPageSources = defaultNetWorthSources,
  getMultiplier: () => number | Promise<number> = () => 1,
): Promise<NetWorthPageData> {
  try {
    const multiplier = await getMultiplier();
    const market = createMarketData();
    const workbook = scaleNetWorthWorkbook(await sources.netWorth(), multiplier);
    const report = buildNetWorthReport(await valueNetWorth(market, workbook));
    const financialPriceIncreases = await loadFinancialPriceIncreases(market, workbook, report.periods);
    // Reuse the report when it already has both hall-of-fame currencies; otherwise value and total again.
    const hallOfFameReport = HALL_OF_FAME_CURRENCIES.every((currency) => report.currencies.includes(currency))
      ? report
      : buildNetWorthReport(await valueNetWorth(market, { ...workbook, currencies: [...HALL_OF_FAME_CURRENCIES] }));
    // Benchmarks compare financial instruments only; their cashflows and prices are filled in below.
    const benchmarkInputs: BenchmarkInput[] = report.currencies.map((currency, index) => ({
      currency,
      portfolio: report.periods.map((date, periodIndex) => ({ date, value: report.financialTotals[index]?.[periodIndex] ?? null })),
      cashflows: [],
      prices: [],
    }));

    // Each step keeps what earlier steps produced if a later one fails: a missing benchmark price must not
    // hide the growth table or the rankings.
    let growthSeries: NetWorthGrowthPoint[][] | null = null;
    let hallOfFame: HallOfFameMetric[] | null = null;
    try {
      const cashflow = await loadConvertedCashflow(market, report, async () => scaleCashflowWorkbook(await sources.cashflow(), multiplier));
      growthSeries = cashflow.converted.map((transactions, index) =>
        buildNetWorthGrowthSeries(report, transactions, financialPriceIncreases, index),
      );
      hallOfFame = await buildHallOfFameSection(market, report, hallOfFameReport, cashflow);
      await fillBenchmarkInputs(market, report, benchmarkInputs, cashflow);
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
