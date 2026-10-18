"use client";

import type { CashflowReport } from "@/lib/analytics/cashflow";
import { InsightLineChart } from "./insight-line-chart";
import { CumulativeCashflowChart } from "./cumulative-cashflow-chart";
import { ExpenseCategoryChart } from "./expense-category-chart";
import { ExpenseFilterPanel } from "./expense-filter-panel";
import { ExpenseMetrics } from "./expense-metrics";
import { MovingAverageExpenses } from "./moving-average-expenses";
import { SavingsRateChart } from "./savings-rate-chart";
import type { ExpenseInsights as Insights } from "./use-expense-insights";

/** Filterable expense analysis: totals, category breakdown, ratios, savings rate, moving average and cumulative cashflow. */
export function ExpenseInsights({
  report,
  insights,
  cutoff,
  currency,
}: {
  report: CashflowReport;
  insights: Insights;
  cutoff: string;
  currency: string;
}) {
  const { filters, expenses, expensesByMonth, periods, selectedDays } = insights;
  const categoryOptions = report.expenseCategories;
  const parentOptions = report.parentCategories;
  const salaryRatios = periods.map((period) => ({
    ...period,
    essentialToSalary: period.salary ? period.essentialExpenses / period.salary : null,
    discretionaryToSalary: period.salary ? period.discretionaryExpenses / period.salary : null,
  }));

  return (
    <section className="space-y-8 pt-0" aria-labelledby="expense-insights-heading">
      <h2 id="expense-insights-heading" className="mb-5 text-xl font-medium tracking-tight text-black">
        <span className="sr-only">Expense insights</span>
      </h2>
      <ExpenseFilterPanel filters={filters} categoryOptions={categoryOptions} parentOptions={parentOptions} />
      <ExpenseMetrics expenses={expenses} periods={periods} selectedDays={selectedDays} currency={currency} />
      <ExpenseCategoryChart periods={periods} expensesByMonth={expensesByMonth} currency={currency} />

      <div className="grid gap-8 lg:grid-cols-2">
        <InsightLineChart
          title="Essential vs Discretionary / Salary"
          data={salaryRatios}
          lines={[
            { key: "essentialToSalary", name: "Essential expenses / salary", color: "#b91c1c" },
            { key: "discretionaryToSalary", name: "Discretionary expenses / salary", color: "#ff6f00" },
          ]}
          percent
          strokeWidth={3}
        />
        <InsightLineChart
          title="Essential vs Recurring vs Discretionary"
          data={periods}
          lines={[
            { key: "essentialExpenses", name: "Essential", color: "#b91c1c" },
            { key: "recurringExpenses", name: "Recurring", color: "#7c3aed" },
            { key: "discretionaryExpenses", name: "Discretionary", color: "#ff6f00" },
          ]}
          currency={currency}
        />
      </div>

      <SavingsRateChart periods={periods} currency={currency} />
      <MovingAverageExpenses expenses={report.expenseTransactions} cutoff={cutoff} currency={currency} />
      <CumulativeCashflowChart periods={periods} currency={currency} />
    </section>
  );
}
