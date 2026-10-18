"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, lineCursor, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import { tableCell, tableHead } from "@/components/ui/table-styles";
import { buildExpenseMovingAverage, type ExpenseTransaction } from "@/lib/analytics/cashflow";
import { movingAverageWindow, sumAmounts } from "@/lib/analytics/cashflow-insights";
import { formatAxisValue, formatMoney } from "@/lib/format";
import { toggleInSet } from "@/lib/sets";
import { categoryColors } from "./category-colors";
import { ChartTooltip } from "./chart-tooltip";

type TotalRow = { label: string; expenses: ExpenseTransaction[]; shaded?: boolean };

/**
 * Trailing moving average of daily expenses per parent category, with a summary table of the same window.
 * Uses every expense up to `cutoff` (the end of the previous month); the insight filters do not apply here.
 */
export function MovingAverageExpenses({
  expenses,
  cutoff,
  currency,
}: {
  expenses: ExpenseTransaction[];
  cutoff: string;
  currency: string;
}) {
  const [windowDays, setWindowDays] = useState(30);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const averaged = movingAverageWindow(expenses, windowDays, cutoff);
  const categories = useMemo(() => [...new Set(expenses.map((expense) => expense.parentCategory))].sort(), [expenses]);
  // Series keys are indexed because category names may contain dots, which Recharts reads as nested paths.
  const data = useMemo(
    () => buildExpenseMovingAverage(expenses, windowDays, averaged.start, cutoff).map((day) => ({
      period: day.period,
      label: day.period,
      ...Object.fromEntries(categories.map((category, index) => [`moving-average-${index}`, day.categories[category] ?? null])),
    })),
    [expenses, windowDays, averaged.start, cutoff, categories],
  );

  const daily = (total: number) => (averaged.days === 0 ? null : total / averaged.days);
  const cell = (total: number) => `${formatMoney(total)} ${currency}`;
  const dailyCell = (total: number) => `${formatMoney(daily(total))} ${currency}`;
  const totalRows: TotalRow[] = [
    { label: "TOT", expenses: averaged.expenses, shaded: true },
    { label: "TOT (NO RENT)", expenses: averaged.expenses.filter((expense) => expense.category.toLowerCase() !== "rent") },
    { label: "TOT ESSENTIAL", expenses: averaged.expenses.filter((expense) => expense.isEssential) },
    { label: "TOT RECURRING", expenses: averaged.expenses.filter((expense) => expense.isRecurring) },
    { label: "TOT DISCRETIONARY", expenses: averaged.expenses.filter((expense) => !expense.isEssential) },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex h-full flex-col">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-medium text-black">
              Moving average expenses by parent category
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              Daily expense average over the selected moving window.
            </p>
          </div>
          <label className="text-sm font-medium text-zinc-700">
            Window (days)
            <input
              className="ml-2 w-20 border border-zinc-300 px-2 py-1 text-right"
              type="number"
              min="1"
              value={windowDays}
              onChange={(event) => setWindowDays(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
        </div>
        <div className="min-h-80 w-full flex-1">
          <ResponsiveContainer minHeight={320}>
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
              <Tooltip content={<ChartTooltip currency={currency} />} cursor={lineCursor} />
              <Legend
                iconType="line"
                wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                onClick={(entry) => setHidden((names) => toggleInSet(names, String(entry.value)))}
              />
              {categories.map((category, index) => (
                <Line
                  key={category}
                  type="monotone"
                  dataKey={`moving-average-${index}`}
                  name={category}
                  hide={hidden.has(category)}
                  stroke={categoryColors[index % categoryColors.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="overflow-x-auto border border-zinc-300 bg-white">
        <table className="w-full table-fixed border-collapse text-xs">
          <thead className={tableHead}>
            <tr>
              <th className={tableCell}>MOV. AVG. expenses by parent category</th>
              <th className={`${tableCell} text-right`}>Daily AVG</th>
              <th className={`${tableCell} text-right`}>TOT</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const total = sumAmounts(averaged.expenses, (expense) => expense.parentCategory === category);
              return (
                <tr key={category}>
                  <th className={`${tableCell} text-left font-medium`}>{category}</th>
                  <td className={`${tableCell} text-right tabular-nums`}>{dailyCell(total)}</td>
                  <td className={`${tableCell} text-right tabular-nums`}>{cell(total)}</td>
                </tr>
              );
            })}
            {totalRows.map(({ label, expenses: rowExpenses, shaded }) => {
              const total = sumAmounts(rowExpenses);
              return (
                <tr key={label} className={shaded ? "bg-zinc-50 font-semibold" : "font-semibold"}>
                  <th className={`${tableCell} text-left`}>{label}</th>
                  <td className={`${tableCell} text-right tabular-nums`}>{dailyCell(total)}</td>
                  <td className={`${tableCell} text-right tabular-nums`}>{cell(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
