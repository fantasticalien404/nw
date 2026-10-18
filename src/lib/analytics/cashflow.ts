import { eachDay, monthStart, monthStarts } from "@/lib/dates";
import type { CashflowCategory, ConvertedCashflowTransaction } from "@/types/workbook";

export type CashflowPeriod = {
  /** First day of the month. */
  period: string;
  /** Null for months without any transaction. */
  income: number | null;
  expenses: number | null;
  savings: number | null;
  savingsRate: number | null;
  salary: number | null;
  incomeCategories: Record<string, number | null>;
  expenseCategories: Record<string, number | null>;
  /** Expenses by parent category. */
  categories: Record<string, number | null>;
};

export type ExpenseTransaction = {
  date: string;
  amount: number;
  category: string;
  parentCategory: string;
  isEssential: boolean;
  isRecurring: boolean;
};

export type CashflowReport = {
  /** Every month from the first to the last transaction. */
  periods: CashflowPeriod[];
  incomeCategories: string[];
  expenseCategories: string[];
  parentCategories: string[];
  /** Expenses without a category. */
  unclassifiedExpenses: number;
  /** Categorised expenses only, for the insight filters. */
  expenseTransactions: ExpenseTransaction[];
};

/** Income categorised as salary (case-insensitive). */
export function isSalary(transaction: Pick<ConvertedCashflowTransaction, "category">) {
  return transaction.category?.toLowerCase() === "salary";
}

/** Income categorised as an investment withdrawal: income for reports, an outflow for performance. */
export function isWithdrawal(transaction: Pick<ConvertedCashflowTransaction, "category">) {
  return transaction.category?.toLowerCase() === "withdrawal";
}

function sortedUnique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function zeros(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<string, number>;
}

function nulls(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, null])) as Record<string, null>;
}

/** A month without data: every value is null so tables show "—" and charts leave a gap. */
function emptyPeriod(
  period: string,
  { incomeCategories, expenseCategories, parentCategories }: Pick<CashflowReport, "incomeCategories" | "expenseCategories" | "parentCategories">,
): CashflowPeriod {
  return {
    period,
    income: null,
    expenses: null,
    savings: null,
    savingsRate: null,
    salary: null,
    incomeCategories: nulls(incomeCategories),
    expenseCategories: nulls(expenseCategories),
    categories: nulls(parentCategories),
  };
}

/** Monthly income, expense and savings report. Contributions are portfolio transfers and are excluded. */
export function buildCashflowReport(
  transactions: ConvertedCashflowTransaction[],
  categories: CashflowCategory[],
): CashflowReport {
  const categoriesByName = new Map(categories.map((category) => [category.category, category]));
  const included = transactions.filter((transaction) => transaction.type !== "contribution");
  const incomeCategories = sortedUnique(included.filter((item) => item.type === "income").map((item) => item.category));
  const expenseCategories = sortedUnique(included.filter((item) => item.type === "expense").map((item) => item.category));
  const parentCategories = sortedUnique(expenseCategories.map((category) => categoriesByName.get(category)?.parentCategory));
  const dates = included.map((transaction) => transaction.date).sort();
  if (dates.length === 0) {
    return { periods: [], incomeCategories, expenseCategories, parentCategories, unclassifiedExpenses: 0, expenseTransactions: [] };
  }

  const months = new Map(monthStarts(dates[0], dates[dates.length - 1]).map((month) => [month, {
    hasTransactions: false,
    income: 0,
    expenses: 0,
    salary: 0,
    incomeCategories: zeros(incomeCategories),
    expenseCategories: zeros(expenseCategories),
    categories: zeros(parentCategories),
  }]));
  let unclassifiedExpenses = 0;
  const expenseTransactions: ExpenseTransaction[] = [];

  for (const transaction of included) {
    // The month range spans every included transaction, so the bucket always exists.
    const month = months.get(monthStart(transaction.date))!;
    month.hasTransactions = true;

    if (transaction.type === "income") {
      month.income += transaction.amount;
      if (transaction.category) month.incomeCategories[transaction.category] += transaction.amount;
      if (isSalary(transaction)) month.salary += transaction.amount;
      continue;
    }

    month.expenses += transaction.amount;
    const definition = transaction.category ? categoriesByName.get(transaction.category) : undefined;
    if (transaction.category) month.expenseCategories[transaction.category] += transaction.amount;
    if (definition) month.categories[definition.parentCategory] += transaction.amount;
    else unclassifiedExpenses += transaction.amount;

    if (transaction.category) {
      expenseTransactions.push({
        date: transaction.date,
        amount: transaction.amount,
        category: transaction.category,
        parentCategory: definition?.parentCategory ?? "Unclassified",
        isEssential: definition?.isEssential ?? false,
        isRecurring: definition?.isRecurring ?? false,
      });
    }
  }

  const periods = [...months].map(([period, month]): CashflowPeriod => month.hasTransactions
    ? {
      period,
      income: month.income,
      expenses: month.expenses,
      savings: month.income - month.expenses,
      savingsRate: month.income === 0 ? null : (month.income - month.expenses) / month.income,
      salary: month.salary,
      incomeCategories: month.incomeCategories,
      expenseCategories: month.expenseCategories,
      categories: month.categories,
    }
    : emptyPeriod(period, { incomeCategories, expenseCategories, parentCategories }));

  return { periods, incomeCategories, expenseCategories, parentCategories, unclassifiedExpenses, expenseTransactions };
}

/** One period per month from `start` through `end`: the report's data, or an all-null period where it has none. */
export function periodsInRange(report: CashflowReport, start: string, end: string): CashflowPeriod[] {
  if (!start || !end || start > end) return [];

  const periodsByMonth = new Map(report.periods.map((period) => [period.period, period]));
  return monthStarts(start, end).map((month) => periodsByMonth.get(month) ?? emptyPeriod(month, report));
}

/** A period's expenses minus the named expense categories (case-insensitive); null when the period has no data. */
export function expensesExcluding(period: CashflowPeriod, excludedCategories: string[]) {
  if (period.expenses === null) return null;

  const excluded = new Set(excludedCategories.map((category) => category.toLowerCase()));
  const excludedExpenses = Object.entries(period.expenseCategories).reduce(
    (total, [category, amount]) => total + (excluded.has(category.toLowerCase()) ? (amount ?? 0) : 0),
    0,
  );
  return period.expenses - excludedExpenses;
}

/**
 * Daily expenses per parent category, averaged over a trailing window of `windowSize` days.
 * The first days of the range average over the days available so far.
 */
export function buildExpenseMovingAverage(
  expenses: ExpenseTransaction[],
  windowSize: number,
  start: string,
  end: string,
) {
  const categories = [...new Set(expenses.map((expense) => expense.parentCategory))].sort();
  if (categories.length === 0) return [];

  const dates = eachDay(start, end);
  const totals = new Map(dates.map((date) => [date, Object.fromEntries(categories.map((category) => [category, 0]))]));
  for (const expense of expenses) {
    const day = totals.get(expense.date);
    if (day) day[expense.parentCategory] += expense.amount;
  }

  return dates.map((date, index) => {
    const days = dates.slice(Math.max(0, index - windowSize + 1), index + 1);
    return {
      period: date,
      categories: Object.fromEntries(categories.map((category) => [
        category,
        days.reduce((sum, day) => sum + totals.get(day)![category], 0) / days.length,
      ])),
    };
  });
}
