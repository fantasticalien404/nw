import { useMemo, useState } from "react";
import type { CashflowReport } from "@/lib/analytics/cashflow";
import {
  buildInsightPeriods,
  countSelectedDays,
  groupByMonth,
  selectExpenses,
  type ExpenseClassification,
} from "@/lib/analytics/cashflow-insights";
import { formatMonthDash } from "@/lib/format";

/**
 * Filter state of the expense-insights section and the expenses, monthly periods and day count it selects.
 * Insights never look past the reporting date.
 */
export function useExpenseInsights(report: CashflowReport, reportingDate: string, rangeStart: string, rangeEnd: string) {
  const [classification, setClassification] = useState<ExpenseClassification>("all");
  const [month, setMonth] = useState("all");
  const [categories, setCategories] = useState<Set<string>>(() => new Set(report.expenseCategories));
  const [parents, setParents] = useState<Set<string>>(() => new Set(report.parentCategories));

  const rangeLimit = rangeEnd < reportingDate ? rangeEnd : reportingDate;
  const expenses = useMemo(
    () => selectExpenses(report.expenseTransactions, {
      start: rangeStart,
      end: rangeLimit,
      month,
      categories,
      parents,
      classification,
    }),
    [report, rangeStart, rangeLimit, month, categories, parents, classification],
  );
  const expensesByMonth = useMemo(() => groupByMonth(expenses), [expenses]);
  const periods = useMemo(
    () => buildInsightPeriods(report, reportingDate, expensesByMonth).map((period) => ({
      ...period,
      label: formatMonthDash(period.period),
    })),
    [report, reportingDate, expensesByMonth],
  );

  return {
    filters: { classification, setClassification, month, setMonth, categories, setCategories, parents, setParents },
    expenses,
    expensesByMonth,
    periods,
    selectedDays: countSelectedDays(rangeStart, rangeLimit, month),
  };
}

export type ExpenseInsights = ReturnType<typeof useExpenseInsights>;
