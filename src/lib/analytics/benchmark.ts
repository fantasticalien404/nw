import { daysBetween, monthStart, monthsBetween } from "@/lib/dates";
import type { ConvertedCashflowTransaction } from "@/types/workbook";
import { isWithdrawal } from "./cashflow";

export type BenchmarkId = "balanced" | "stocks";
export type RebalancePeriod = "monthly" | "quarterly" | "yearly";

export type BenchmarkPrice = {
  date: string;
  stock: number;
  bond: number;
};

export type PortfolioCashflow = {
  date: string;
  amount: number;
};

export type BenchmarkInput = {
  currency: string;
  portfolio: Array<{ date: string; value: number | null }>;
  cashflows: PortfolioCashflow[];
  prices: BenchmarkPrice[];
};

export type PerformanceMetrics = {
  irr: number | null;
  growth: number | null;
  sharpeRatio: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  bestMonth: number | null;
  worstMonth: number | null;
};

export type BenchmarkComparison = {
  points: Array<{ date: string; portfolio: number | null; benchmark: number | null }>;
  portfolioMetrics: PerformanceMetrics;
  benchmarkMetrics: PerformanceMetrics;
};

const weights: Record<BenchmarkId, { stock: number; bond: number }> = {
  balanced: { stock: 0.6, bond: 0.4 },
  stocks: { stock: 1, bond: 0 },
};

type Observation = { date: string; value: number };

/**
 * External portfolio cash flows from cashflow transactions: contributions flow in at the start of the following
 * month (positive); investment withdrawals flow out on their own date (negative). Flows after `holdingsDate`, the
 * latest period with reported holdings, are left out: the portfolio's values do not contain them yet.
 */
export function benchmarkCashflows(transactions: ConvertedCashflowTransaction[], holdingsDate: string): PortfolioCashflow[] {
  const flows = transactions.flatMap((transaction) => {
    if (transaction.type === "contribution") {
      return [{ date: monthStart(transaction.date, 1), amount: transaction.amount }];
    }
    if (transaction.type === "income" && isWithdrawal(transaction)) {
      return [{ date: transaction.date, amount: -transaction.amount }];
    }
    return [];
  });
  return flows.filter((flow) => flow.date <= holdingsDate);
}

/** A rebalance is due once `period` calendar months have passed since the last one. */
function rebalanceDue(lastDate: string, date: string, period: RebalancePeriod) {
  const interval = period === "monthly" ? 1 : period === "quarterly" ? 3 : 12;
  return monthsBetween(lastDate, date) >= interval;
}

/**
 * Annualised money-weighted return (XIRR): the rate that discounts the start value, every external flow and the end
 * value to zero. Solved by bisection; null when the flows have no sign change or no root is found.
 */
function calculateIrr(series: Observation[], flows: PortfolioCashflow[]) {
  const first = series[0];
  const last = series.at(-1)!;
  const cashflows = [
    { date: first.date, amount: -first.value },
    ...flows
      .filter((flow) => flow.date > first.date && flow.date <= last.date)
      .map((flow) => ({ date: flow.date, amount: -flow.amount })),
    { date: last.date, amount: last.value },
  ];
  if (!cashflows.some((cashflow) => cashflow.amount < 0) || !cashflows.some((cashflow) => cashflow.amount > 0)) return null;

  const baseDate = new Date(`${first.date}T00:00:00Z`).getTime();
  const netPresentValue = (rate: number) => cashflows.reduce((total, cashflow) => {
    const years = (new Date(`${cashflow.date}T00:00:00Z`).getTime() - baseDate) / 31_557_600_000;
    return total + cashflow.amount / (1 + rate) ** years;
  }, 0);
  let lower = -0.9999;
  let upper = 10;
  let lowerValue = netPresentValue(lower);
  let upperValue = netPresentValue(upper);
  while (lowerValue * upperValue > 0 && upper < 1_000_000) {
    upper *= 2;
    upperValue = netPresentValue(upper);
  }
  if (lowerValue * upperValue > 0) return null;
  for (let index = 0; index < 100; index += 1) {
    const middle = (lower + upper) / 2;
    const middleValue = netPresentValue(middle);
    if (Math.abs(middleValue) < 0.000001) return middle;
    if (lowerValue * middleValue <= 0) {
      upper = middle;
    } else {
      lower = middle;
      lowerValue = middleValue;
    }
  }
  return (lower + upper) / 2;
}

/**
 * Modified Dietz return of every interval between consecutive observations: the gain after removing external flows,
 * over the start value plus each flow weighted by the share of the interval it was invested.
 */
function periodReturns(series: Observation[], flows: PortfolioCashflow[]) {
  return series.slice(1).flatMap((end, index) => {
    const start = series[index];
    const span = daysBetween(start.date, end.date);
    const inPeriod = flows.filter((flow) => flow.date > start.date && flow.date <= end.date);
    const netFlow = inPeriod.reduce((total, flow) => total + flow.amount, 0);
    const weightedFlow = inPeriod.reduce((total, flow) => total + flow.amount * daysBetween(flow.date, end.date) / span, 0);
    const base = start.value + weightedFlow;
    return base > 0 ? [(end.value - start.value - netFlow) / base] : [];
  });
}

/** Growth, risk and drawdown metrics from interval returns. Observations are monthly, so risk is annualised with √12. */
function performanceMetrics(series: Observation[], flows: PortfolioCashflow[]): PerformanceMetrics {
  const returns = series.length < 2 ? [] : periodReturns(series, flows);
  if (returns.length === 0) {
    return { irr: null, growth: null, sharpeRatio: null, volatility: null, maxDrawdown: null, bestMonth: null, worstMonth: null };
  }

  let index = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const periodReturn of returns) {
    index *= 1 + periodReturn;
    peak = Math.max(peak, index);
    maxDrawdown = Math.min(maxDrawdown, index / peak - 1);
  }
  const average = returns.reduce((total, value) => total + value, 0) / returns.length;
  const variance = returns.length > 1
    ? returns.reduce((total, value) => total + (value - average) ** 2, 0) / (returns.length - 1)
    : 0;
  const monthlyVolatility = Math.sqrt(variance);

  return {
    irr: calculateIrr(series, flows),
    growth: index - 1,
    sharpeRatio: monthlyVolatility > 0 ? (average / monthlyVolatility) * Math.sqrt(12) : null,
    volatility: returns.length > 1 ? monthlyVolatility * Math.sqrt(12) : null,
    maxDrawdown,
    bestMonth: Math.max(...returns),
    worstMonth: Math.min(...returns),
  };
}

/** The first price on or after `date`, so weekend and holiday flows use the next trading day. */
function priceOnOrAfter(prices: BenchmarkPrice[], date: string) {
  return prices.find((price) => price.date >= date) ?? prices.at(-1)!;
}

/**
 * Replays the portfolio's external flows into the benchmark, starting from the first snapshot's value, and returns the
 * benchmark's value at every snapshot date. Flows on a snapshot date count in that snapshot.
 */
function simulateBenchmark(
  snapshots: Observation[],
  flows: PortfolioCashflow[],
  prices: BenchmarkPrice[],
  benchmark: BenchmarkId,
  rebalancePeriod: RebalancePeriod,
): Observation[] {
  const start = snapshots[0];
  const end = snapshots.at(-1)!;
  const target = weights[benchmark];
  const events = [
    ...flows
      .filter((flow) => flow.date > start.date && flow.date <= end.date)
      .map((flow) => ({ date: flow.date, flow: flow.amount, snapshot: false })),
    ...snapshots.slice(1).map(({ date }) => ({ date, flow: 0, snapshot: true })),
  ].sort((a, b) => a.date.localeCompare(b.date) || Number(a.snapshot) - Number(b.snapshot));

  const first = priceOnOrAfter(prices, start.date);
  let stockUnits = start.value * target.stock / first.stock;
  let bondUnits = start.value * target.bond / first.bond;
  let lastRebalance = start.date;
  const values: Observation[] = [{ date: start.date, value: start.value }];

  for (const event of events) {
    const price = priceOnOrAfter(prices, event.date);
    if (rebalanceDue(lastRebalance, event.date, rebalancePeriod)) {
      const value = stockUnits * price.stock + bondUnits * price.bond + event.flow;
      stockUnits = value * target.stock / price.stock;
      bondUnits = value * target.bond / price.bond;
      lastRebalance = event.date;
    } else {
      stockUnits += event.flow * target.stock / price.stock;
      bondUnits += event.flow * target.bond / price.bond;
    }
    if (event.snapshot) values.push({ date: event.date, value: stockUnits * price.stock + bondUnits * price.bond });
  }

  return values;
}

export function buildBenchmarkComparison(
  input: BenchmarkInput,
  benchmark: BenchmarkId,
  rebalancePeriod: RebalancePeriod,
): BenchmarkComparison {
  const portfolio = input.portfolio.flatMap(({ date, value }) => value === null ? [] : [{ date, value }]);
  const simulated = portfolio.length > 0 && input.prices.length > 0
    ? simulateBenchmark(portfolio, input.cashflows, input.prices, benchmark, rebalancePeriod)
    : [];
  const benchmarkByDate = new Map(simulated.map(({ date, value }) => [date, value]));

  return {
    points: input.portfolio.map(({ date, value }) => ({
      date,
      portfolio: value,
      benchmark: value === null ? null : benchmarkByDate.get(date) ?? null,
    })),
    portfolioMetrics: performanceMetrics(portfolio, input.cashflows),
    benchmarkMetrics: performanceMetrics(simulated, input.cashflows),
  };
}
