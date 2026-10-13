import type { ConvertedCashflowTransaction } from "@/lib/market-data/cashflow";

export type CashflowCategory = {
  category: string;
  parentCategory: string;
  isEssential: boolean;
  isRecurring: boolean;
};

export type CashflowFilters = {
  from?: string;
  to?: string;
  rawCategory?: string;
  parentCategory?: string;
  expenseClassification?: "all" | "essential" | "discretionary" | "recurring" | "non-recurring";
  incomeSource?: string;
};

export type CashflowPeriod = {
  period: string;
  income: number | null;
  chartIncome: number | null;
  expenses: number | null;
  savings: number | null;
  savingsRate: number | null;
  incomeCategories: Record<string, number | null>;
  expenseCategories: Record<string, number | null>;
  categories: Record<string, number | null>;
};

export type ExpenseTransaction = {
  date: string;
  amount: number;
  category: string;
};

export type CashflowReport = {
  periods: CashflowPeriod[];
  incomeCategories: string[];
  expenseCategories: string[];
  parentCategories: string[];
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  unclassifiedExpenses: number;
  dailyMeanExpenses: number | null;
  essentialExpenses: number;
  recurringExpenses: number;
  discretionaryExpenses: number;
  salary: number;
  yearPeriods: Array<CashflowPeriod & { cumulativeSalary: number; cumulativeExpenses: number }>;
  expenseTransactions: ExpenseTransaction[];
};

export type ExpenseHistogramPeriod = {
  period: string;
  categories: Record<string, number>;
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

function isSelectedExpense(
  transaction: ConvertedCashflowTransaction,
  definition: CashflowCategory | undefined,
  filters: CashflowFilters,
) {
  if (filters.rawCategory && transaction.category !== filters.rawCategory) return false;
  if (filters.parentCategory && definition?.parentCategory !== filters.parentCategory) return false;
  if (filters.expenseClassification === "essential" && !definition?.isEssential) return false;
  if (filters.expenseClassification === "discretionary" && definition?.isEssential) return false;
  if (filters.expenseClassification === "recurring" && !definition?.isRecurring) return false;
  return filters.expenseClassification !== "non-recurring" || !definition?.isRecurring;
}

function daysBetween(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export function buildCashflowReport(
  transactions: ConvertedCashflowTransaction[],
  categories: CashflowCategory[],
  filters: CashflowFilters = {},
): CashflowReport {
  const categoriesByName = new Map(categories.map((category) => [category.category, category]));
  const included = transactions.filter((transaction) => {
    if (transaction.type === "contribution") return false;
    if (filters.from && transaction.date < filters.from) return false;
    if (filters.to && transaction.date > filters.to) return false;
    if (transaction.type === "income") return !filters.incomeSource || transaction.category === filters.incomeSource;
    return isSelectedExpense(transaction, transaction.category ? categoriesByName.get(transaction.category) : undefined, filters);
  });
  const incomeCategories = [...new Set(included.filter((item) => item.type === "income" && item.category).map((item) => item.category!))].sort();
  const expenseCategories = [...new Set(included.filter((item) => item.type === "expense" && item.category).map((item) => item.category!))].sort();
  const parentCategories = [...new Set(expenseCategories.map((category) => categoriesByName.get(category)?.parentCategory).filter((value): value is string => Boolean(value)))].sort();
  const firstDate = included.map((transaction) => transaction.date).sort()[0];
  const lastDate = included.map((transaction) => transaction.date).sort().at(-1);
  if (!firstDate || !lastDate) {
    return {
      periods: [], incomeCategories, expenseCategories, parentCategories, totalIncome: 0, totalExpenses: 0, totalSavings: 0,
      unclassifiedExpenses: 0, dailyMeanExpenses: null, essentialExpenses: 0, recurringExpenses: 0, discretionaryExpenses: 0,
      salary: 0, yearPeriods: [], expenseTransactions: [],
    };
  }

  const rangeStart = filters.from ?? firstDate;
  const rangeEnd = filters.to ?? lastDate;
  const periodMap = new Map(monthsBetween(monthOf(rangeStart), monthOf(rangeEnd)).map((period) => [period, {
    period, income: 0, chartIncome: 0, expenses: 0, hasTransactions: false,
    incomeCategories: Object.fromEntries(incomeCategories.map((category) => [category, 0])) as Record<string, number>,
    expenseCategories: Object.fromEntries(expenseCategories.map((category) => [category, 0])) as Record<string, number>,
    categories: Object.fromEntries(parentCategories.map((category) => [category, 0])) as Record<string, number>,
  }]));
  let unclassifiedExpenses = 0;
  let essentialExpenses = 0;
  let recurringExpenses = 0;
  let unionEssentialOrRecurring = 0;
  let salary = 0;
  const expenseTransactions: ExpenseTransaction[] = [];

  for (const transaction of included) {
    const period = periodMap.get(monthOf(transaction.date));
    if (!period) continue;
    period.hasTransactions = true;
    if (transaction.type === "income") {
      period.income += transaction.amount;
      if (transaction.category) period.incomeCategories[transaction.category] += transaction.amount;
      if (transaction.category?.toLowerCase() === "salary") {
        period.chartIncome += transaction.amount;
        salary += transaction.amount;
      }
      continue;
    }
    period.expenses += transaction.amount;
    const definition = transaction.category ? categoriesByName.get(transaction.category) : undefined;
    if (transaction.category) period.expenseCategories[transaction.category] += transaction.amount;
    if (definition) period.categories[definition.parentCategory] += transaction.amount;
    else unclassifiedExpenses += transaction.amount;
    if (definition?.isEssential) essentialExpenses += transaction.amount;
    if (definition?.isRecurring) recurringExpenses += transaction.amount;
    if (definition?.isEssential || definition?.isRecurring) unionEssentialOrRecurring += transaction.amount;
    if (transaction.category) expenseTransactions.push({ date: transaction.date, amount: transaction.amount, category: transaction.category });
  }

  const periods = [...periodMap.values()].map((period): CashflowPeriod => period.hasTransactions ? {
    ...period,
    savings: period.income - period.expenses,
    savingsRate: period.income === 0 ? null : (period.income - period.expenses) / period.income,
  } : {
    period: period.period, income: null, chartIncome: null, expenses: null, savings: null, savingsRate: null,
    incomeCategories: Object.fromEntries(incomeCategories.map((category) => [category, null])),
    expenseCategories: Object.fromEntries(expenseCategories.map((category) => [category, null])),
    categories: Object.fromEntries(parentCategories.map((category) => [category, null])),
  });
  const totalIncome = periods.reduce((total, period) => total + (period.income ?? 0), 0);
  const totalExpenses = periods.reduce((total, period) => total + (period.expenses ?? 0), 0);
  let cumulativeSalary = 0;
  let cumulativeExpenses = 0;
  const yearPeriods = periods.map((period) => {
    cumulativeSalary += period.chartIncome ?? 0;
    cumulativeExpenses += period.expenses ?? 0;
    return { ...period, cumulativeSalary, cumulativeExpenses };
  });

  return {
    periods, incomeCategories, expenseCategories, parentCategories, totalIncome, totalExpenses,
    totalSavings: totalIncome - totalExpenses, unclassifiedExpenses,
    dailyMeanExpenses: totalExpenses === 0 ? null : totalExpenses / daysBetween(rangeStart, rangeEnd),
    essentialExpenses, recurringExpenses, discretionaryExpenses: totalExpenses - unionEssentialOrRecurring, salary,
    yearPeriods, expenseTransactions,
  };
}

export function buildExpenseHistogram(expenses: ExpenseTransaction[], granularity: "month" | "quarter" | "year") {
  const periods = new Map<string, ExpenseHistogramPeriod>();
  for (const expense of expenses) {
    const date = new Date(`${expense.date}T00:00:00Z`);
    const period = granularity === "year" ? expense.date.slice(0, 4) : granularity === "quarter"
      ? `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth() / 3) + 1}` : expense.date.slice(0, 7);
    const item = periods.get(period) ?? { period, categories: {} };
    item.categories[expense.category] = (item.categories[expense.category] ?? 0) + expense.amount;
    periods.set(period, item);
  }
  return [...periods.values()];
}

export function buildExpenseMovingAverage(expenses: ExpenseTransaction[], windowSize: number) {
  const categories = [...new Set(expenses.map((expense) => expense.category))].sort();
  const months = monthsBetween(monthOf(expenses.map((expense) => expense.date).sort()[0] ?? ""), monthOf(expenses.map((expense) => expense.date).sort().at(-1) ?? ""));
  if (!months.length || !months[0].slice(0, 4)) return [];
  const totals = new Map(months.map((month) => [month, Object.fromEntries(categories.map((category) => [category, 0]))]));
  for (const expense of expenses) totals.get(monthOf(expense.date))![expense.category] += expense.amount;
  return months.map((period, index) => ({
    period,
    categories: Object.fromEntries(categories.map((category) => {
      const start = Math.max(0, index - windowSize + 1);
      const values = months.slice(start, index + 1).map((month) => totals.get(month)![category]);
      return [category, values.reduce((sum, value) => sum + value, 0) / values.length];
    })),
  }));
}
