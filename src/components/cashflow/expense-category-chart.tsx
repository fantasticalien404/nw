"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import type { ExpenseTransaction } from "@/lib/analytics/cashflow";
import { splitLargestGroups, sumByGroup, type InsightPeriod } from "@/lib/analytics/cashflow-insights";
import { formatAxisValue } from "@/lib/format";
import { toggleInSet } from "@/lib/sets";
import { categoryColors, otherGroupsColor } from "./category-colors";
import { ChartTooltip } from "./chart-tooltip";

type Grouping = "category" | "parent";

/**
 * Monthly expenses stacked by category or parent category; clicking a legend entry hides that series.
 * Only groups with selected expenses are drawn, largest first (the legend keeps that order). Beyond one colour per
 * group, the smallest are merged into one grey series.
 */
export function ExpenseCategoryChart({
  periods,
  expensesByMonth,
  currency,
}: {
  periods: Array<InsightPeriod & { label: string }>;
  expensesByMonth: Map<string, ExpenseTransaction[]>;
  currency: string;
}) {
  const [grouping, setGrouping] = useState<Grouping>("category");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  const monthlyTotals = periods.map((period) => sumByGroup(expensesByMonth.get(period.period) ?? [], grouping));
  const totals = new Map<string, number>();
  for (const month of monthlyTotals) {
    for (const [name, amount] of month) totals.set(name, (totals.get(name) ?? 0) + amount);
  }
  const { shown, merged } = splitLargestGroups(totals, categoryColors.length);

  // Series keys are indexed because category names may contain dots, which Recharts reads as nested paths.
  const series = shown.map((name, index) => ({ name, dataKey: `expense-${index}`, color: categoryColors[index] ?? otherGroupsColor }));
  if (merged.length > 0) {
    const noun = grouping === "category" ? "categories" : "parent categories";
    series.push({ name: `${merged.length} other ${noun}`, dataKey: "expense-other", color: otherGroupsColor });
  }
  const data = periods.map((period, index) => ({
    ...period,
    ...Object.fromEntries(shown.map((name, seriesIndex) => [`expense-${seriesIndex}`, monthlyTotals[index].get(name) ?? 0])),
    "expense-other": merged.reduce((sum, name) => sum + (monthlyTotals[index].get(name) ?? 0), 0),
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Click a category in the legend to hide/show it. Filters are applied before this view.
        </p>
        <div className="flex border border-zinc-300" role="group" aria-label="Expense chart grouping">
          {(["category", "parent"] as const).map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={grouping === level}
              onClick={() => {
                setGrouping(level);
                setHidden(new Set());
              }}
              className={`px-3 py-1 text-sm font-medium ${grouping === level ? "bg-black text-white" : "bg-white text-zinc-700"}`}
            >
              {level === "category" ? "Category" : "Parent category"}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
            <Tooltip
              content={<ChartTooltip currency={currency} variant="nonZero" />}
              cursor={{ fill: "#f4f4f5" }}
              wrapperStyle={{ zIndex: 10 }}
            />
            <Legend
              iconType="square"
              itemSorter={null}
              wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
              onClick={(entry) => setHidden((names) => toggleInSet(names, String(entry.value)))}
            />
            {series.map(({ name, dataKey, color }) => (
              <Area
                key={dataKey}
                type="monotone"
                dataKey={dataKey}
                name={name}
                stackId="expenses"
                hide={hidden.has(name)}
                stroke={color}
                fill={color}
                fillOpacity={0.72}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
