import type { ConvertedCashflowTransaction } from "@/lib/market-data/cashflow";

export type CashflowPeriod = {
  period: string;
  income: number | null;
  expenses: number | null;
  savings: number | null;
  savingsRate: number | null;
  categories: Record<string, number | null>;
};

type CashflowPeriodData = {
  period: string;
  income: number;
  expenses: number;
  categories: Record<string, number>;
  hasTransactions: boolean;
};

export type CashflowReport = {
  periods: CashflowPeriod[];
  parentCategories: string[];
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  unclassifiedExpenses: number;
  yearPeriods: Array<CashflowPeriod & { cumulativeIncome: number; cumulativeExpenses: number }>;
};

function monthOf(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function monthsBetween(start: string, end: string) {
  const periods: string[] = [];
  const current = new Date(`${start}T00:00:00Z`);
  const final = new Date(`${end}T00:00:00Z`);

  while (current <= final) {
    periods.push(current.toISOString().slice(0, 10));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return periods;
}

function previousMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

export function buildCashflowReport(
  transactions: ConvertedCashflowTransaction[],
  categoryParents: Map<string, string>,
): CashflowReport {
  const parentCategories = [...new Set(categoryParents.values())].sort();
  const cutoff = previousMonth();
  const reportTransactions = transactions.filter((transaction) => monthOf(transaction.date) <= cutoff);
  const latestPeriod = reportTransactions.map((transaction) => monthOf(transaction.date)).sort().at(-1);
  if (!latestPeriod) {
    throw new Error("The cashflow tab must include at least one transaction before the current month.");
  }

  const reportYear = latestPeriod.slice(0, 4);
  const firstPeriod = `${reportYear}-01-01`;
  const lastPeriod = `${reportYear}-12-01`;
  const periods = new Map<string, CashflowPeriodData>(
    monthsBetween(firstPeriod, lastPeriod).map((period) => [period, { 
      period,
      income: 0,
      expenses: 0,
      categories: Object.fromEntries(parentCategories.map((category) => [category, 0])),
      hasTransactions: false,
    }]),
  );
  let unclassifiedExpenses = 0;

  for (const transaction of reportTransactions) {
    if (transaction.type === "contribution") {
      continue;
    }

    const period = periods.get(monthOf(transaction.date));
    if (!period) {
      continue;
    }
    period.hasTransactions = true;
    if (transaction.type === "income") {
      period.income += transaction.amount;
      continue;
    }

    period.expenses += transaction.amount;
    const parent = transaction.category ? categoryParents.get(transaction.category) : undefined;
    if (parent) {
      period.categories[parent] += transaction.amount;
    } else {
      unclassifiedExpenses += transaction.amount;
    }
  }

  const rows: CashflowPeriod[] = [...periods.values()].map((period) => {
    if (!period.hasTransactions) {
      return {
        period: period.period,
        income: null,
        expenses: null,
        savings: null,
        savingsRate: null,
        categories: Object.fromEntries(parentCategories.map((category) => [category, null])),
      };
    }

    return {
      period: period.period,
      income: period.income,
      expenses: period.expenses,
      savings: period.income - period.expenses,
      savingsRate: period.income === 0 ? null : (period.income - period.expenses) / period.income,
      categories: period.categories,
    };
  });
  const currentYear = rows.at(-1)!.period.slice(0, 4);
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;
  const yearPeriods = rows
    .filter((period) => period.period.startsWith(currentYear))
    .map((period) => {
      cumulativeIncome += period.income ?? 0;
      cumulativeExpenses += period.expenses ?? 0;
      return { ...period, cumulativeIncome, cumulativeExpenses };
    });

  return {
    periods: rows,
    parentCategories,
    totalIncome: rows.reduce((total, period) => total + (period.income ?? 0), 0),
    totalExpenses: rows.reduce((total, period) => total + (period.expenses ?? 0), 0),
    totalSavings: rows.reduce((total, period) => total + (period.savings ?? 0), 0),
    unclassifiedExpenses,
    yearPeriods,
  };
}
