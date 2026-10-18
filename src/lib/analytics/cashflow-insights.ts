// Pure view-model calculations behind the cashflow "expense insights" section. The UI owns the filter state and
// formatting; everything derived from it lives here so it can be tested without rendering.
import { addDays, daysBetween, isIsoDate, monthStart, monthStarts } from "@/lib/dates";
import type { CashflowReport, ExpenseTransaction } from "./cashflow";

export type ExpenseClassification = "all" | "essential" | "discretionary" | "recurring" | "non-recurring";

export type ExpenseSelection = {
  start: string;
  end: string;
  /** Two-digit calendar month ("01".."12") to keep only that month in every year, or "all". */
  month: string;
  /** An empty set selects every category. */
  categories: ReadonlySet<string>;
  parents: ReadonlySet<string>;
  classification: ExpenseClassification;
};

export type InsightPeriod = {
  period: string;
  income: number | null;
  salary: number | null;
  /** Expenses of the selected transactions only. */
  expenses: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
  recurringExpenses: number;
  nonRecurringExpenses: number;
  /** Savings rate of the month's income against the selected expenses. */
  savingsRate: number | null;
};

export type MovingAverageWindow = {
  start: string;
  /** Days from `start` through the cutoff, inclusive. */
  days: number;
  expenses: ExpenseTransaction[];
};

function matchesClassification(expense: ExpenseTransaction, classification: ExpenseClassification) {
  switch (classification) {
    case "all": return true;
    case "essential": return expense.isEssential;
    case "discretionary": return !expense.isEssential;
    case "recurring": return expense.isRecurring;
    case "non-recurring": return !expense.isRecurring;
  }
}

export function selectExpenses(expenses: ExpenseTransaction[], selection: ExpenseSelection) {
  if (selection.start > selection.end) return [];

  return expenses.filter((expense) =>
    expense.date >= selection.start
    && expense.date <= selection.end
    && (selection.month === "all" || expense.date.slice(5, 7) === selection.month)
    && (selection.categories.size === 0 || selection.categories.has(expense.category))
    && (selection.parents.size === 0 || selection.parents.has(expense.parentCategory))
    && matchesClassification(expense, selection.classification));
}

export function sumAmounts(expenses: ExpenseTransaction[], predicate: (expense: ExpenseTransaction) => boolean = () => true) {
  return expenses.reduce((sum, expense) => (predicate(expense) ? sum + expense.amount : sum), 0);
}

/** Groups expenses by the first day of their month. */
export function groupByMonth(expenses: ExpenseTransaction[]) {
  const months = new Map<string, ExpenseTransaction[]>();
  for (const expense of expenses) {
    const month = monthStart(expense.date);
    const group = months.get(month) ?? [];
    group.push(expense);
    months.set(month, group);
  }
  return months;
}

/** Total per category or parent category. */
export function sumByGroup(expenses: ExpenseTransaction[], group: "category" | "parent") {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = group === "category" ? expense.category : expense.parentCategory;
    totals.set(key, (totals.get(key) ?? 0) + expense.amount);
  }
  return totals;
}

/**
 * Splits groups by descending total for a stacked chart: the `limit` largest keep their own series and any further
 * groups are merged into one (a single extra group keeps its own series, since merging would only hide its name).
 * Groups without expenses are dropped. Ties keep alphabetical order.
 */
export function splitLargestGroups(totals: ReadonlyMap<string, number>, limit: number) {
  const ranked = [...totals]
    .filter(([, total]) => total > 0)
    .sort(([leftName, left], [rightName, right]) => right - left || leftName.localeCompare(rightName))
    .map(([name]) => name);
  const kept = ranked.length === limit + 1 ? ranked.length : limit;
  return { shown: ranked.slice(0, kept), merged: ranked.slice(kept) };
}

/**
 * Days from `start` through `end` that fall in `month` ("all" counts every day); 0 for a reversed or invalid range.
 * Counts whole months rather than days, because the dates come from inputs that pass through years like 0002 while typing.
 */
export function countSelectedDays(start: string, end: string, month: string) {
  if (!isIsoDate(start) || !isIsoDate(end) || start > end) return 0;
  if (month === "all") return daysBetween(start, end) + 1;

  return monthStarts(start, end)
    .filter((first) => first.slice(5, 7) === month)
    .reduce((days, first) => {
      const last = addDays(monthStart(first, 1), -1);
      return days + daysBetween(first > start ? first : start, last < end ? last : end) + 1;
    }, 0);
}

/**
 * One entry per reported month up to the reporting month that has selected expenses, with that month's
 * expense totals split by classification.
 */
export function buildInsightPeriods(
  report: CashflowReport,
  reportingDate: string,
  expensesByMonth: Map<string, ExpenseTransaction[]>,
): InsightPeriod[] {
  const reportingMonth = reportingDate.slice(0, 7);

  return report.periods
    .filter((period) =>
      period.period.slice(0, 7) <= reportingMonth
      && (period.income !== null || period.expenses !== null)
      && expensesByMonth.has(period.period))
    .map((period) => {
      const expenses = expensesByMonth.get(period.period)!;
      const total = sumAmounts(expenses);
      const essential = sumAmounts(expenses, (expense) => expense.isEssential);
      const recurring = sumAmounts(expenses, (expense) => expense.isRecurring);
      return {
        period: period.period,
        income: period.income,
        salary: period.salary,
        expenses: total,
        essentialExpenses: essential,
        discretionaryExpenses: total - essential,
        recurringExpenses: recurring,
        nonRecurringExpenses: total - recurring,
        savingsRate: period.income === null || period.income === 0 ? null : (period.income - total) / period.income,
      };
    });
}

/** Running salary and expense totals across the insight periods. */
export function buildCumulative(periods: InsightPeriod[]) {
  let cumulativeSalary = 0;
  let cumulativeExpenses = 0;
  return periods.map((period) => {
    cumulativeSalary += period.salary ?? 0;
    cumulativeExpenses += period.expenses;
    return { period: period.period, cumulativeSalary, cumulativeExpenses };
  });
}

/**
 * The trailing `windowDays` days ending at `cutoff`, shortened so it never starts before the first expense.
 * Returns the expenses inside it.
 */
export function movingAverageWindow(expenses: ExpenseTransaction[], windowDays: number, cutoff: string): MovingAverageWindow {
  const requestedStart = addDays(cutoff, -(windowDays - 1));
  const firstExpenseDate = expenses.map((expense) => expense.date).sort()[0];
  const start = firstExpenseDate && firstExpenseDate > requestedStart ? firstExpenseDate : requestedStart;
  return {
    start,
    days: countSelectedDays(start, cutoff, "all"),
    expenses: expenses.filter((expense) => expense.date >= start && expense.date <= cutoff),
  };
}
