"use client";

import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, lineCursor, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import type { ExpenseTransaction } from "@/lib/analytics/cashflow";
import { sumAmounts, type InsightPeriod } from "@/lib/analytics/cashflow-insights";
import { formatAxisValue } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";
import { SectionHeading } from "./section-heading";

const selectClass = "ml-2 border border-zinc-300 bg-white px-2 py-1";

/** Month-by-month history of one category or parent category, optionally next to salary. */
export function HistoricalExpenses({
  periods,
  expensesByMonth,
  categoryOptions,
  parentOptions,
  currency,
}: {
  periods: Array<InsightPeriod & { label: string }>;
  expensesByMonth: Map<string, ExpenseTransaction[]>;
  categoryOptions: string[];
  parentOptions: string[];
  currency: string;
}) {
  // Exactly one of the two selections is active; picking one clears the other.
  const [category, setCategory] = useState("");
  const [parentCategory, setParentCategory] = useState(
    () => parentOptions.find((parent) => parent.toLowerCase() === "food") ?? "",
  );
  const [showSalary, setShowSalary] = useState(false);
  const selection = category || parentCategory;

  const data = periods.map((period) => ({
    label: period.label,
    expenses: selection
      ? sumAmounts(
        expensesByMonth.get(period.period) ?? [],
        (expense) => (category ? expense.category === category : expense.parentCategory === parentCategory),
      )
      : null,
    salary: showSalary ? period.salary : null,
  }));

  return (
    <section className="border-t border-zinc-300 pt-8" aria-label="Historical expenses">
      <SectionHeading title="Historical expenses" />
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-zinc-700">
          Category
          <select
            className={selectClass}
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setParentCategory("");
            }}
          >
            <option value="">Select a category</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-zinc-700">
          Parent category
          <select
            className={selectClass}
            value={parentCategory}
            onChange={(event) => {
              setParentCategory(event.target.value);
              setCategory("");
            }}
          >
            <option value="">Select a parent category</option>
            {parentOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium aria-pressed:bg-zinc-100"
          aria-pressed={showSalary}
          onClick={() => setShowSalary((show) => !show)}
        >
          {showSalary ? "Hide salary" : "Show salary"}
        </button>
      </div>
      {selection ? (
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
              <Tooltip content={<ChartTooltip currency={currency} />} cursor={lineCursor} />
              <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="expenses" name={selection} stroke="#b91c1c" strokeWidth={2} dot={false} isAnimationActive={false} />
              {showSalary && (
                <Line type="monotone" dataKey="salary" name="Salary" stroke="#15803d" strokeWidth={2} dot={false} isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          Select a category or parent category to view its complete expense history.
        </p>
      )}
    </section>
  );
}
