"use client";

import { useMemo } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, lineCursor, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import { expensesExcluding, periodsInRange, type CashflowReport } from "@/lib/analytics/cashflow";
import { formatAxisValue, formatMonthDash } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";

/** Monthly income, salary and expenses over the selected range. Months after `cutoff` are left as gaps. */
export function CashflowTrendChart({
  report,
  rangeStart,
  rangeEnd,
  cutoff,
  currency,
}: {
  report: CashflowReport;
  rangeStart: string;
  rangeEnd: string;
  cutoff: string;
  currency: string;
}) {
  const data = useMemo(
    () => periodsInRange(report, rangeStart, rangeEnd).map((period) => {
      const visible = period.period <= cutoff;
      return {
        label: formatMonthDash(period.period),
        income: visible ? period.income : null,
        expenses: visible ? period.expenses : null,
        salary: visible ? period.salary : null,
        expensesExcludingRent: visible ? expensesExcluding(period, ["rent"]) : null,
      };
    }),
    [report, rangeStart, rangeEnd, cutoff],
  );

  return (
    <section className="border-b border-zinc-300 pb-6" aria-label="Monthly cashflow">
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
            <Tooltip content={<ChartTooltip currency={currency} />} cursor={lineCursor} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="expenses" name="EXPENSES" stroke="#b91c1c" strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line
              type="monotone"
              dataKey="expensesExcludingRent"
              name="EXPENSES (NO RENT)"
              stroke="#b91c1c"
              strokeOpacity={0.35}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line type="monotone" dataKey="income" name="INCOME" stroke="#15803d" strokeWidth={3} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="salary" name="SALARY" stroke="#1d4ed8" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
