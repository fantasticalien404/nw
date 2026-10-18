"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, lineCursor, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import { buildCumulative, type InsightPeriod } from "@/lib/analytics/cashflow-insights";
import { formatAxisValue } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";
import { SectionHeading } from "./section-heading";

/** Running salary income against running expenses over the selected months. */
export function CumulativeCashflowChart({ periods, currency }: { periods: Array<InsightPeriod & { label: string }>; currency: string }) {
  const labels = new Map(periods.map((period) => [period.period, period.label]));
  const data = buildCumulative(periods).map((point) => ({ ...point, label: labels.get(point.period) }));

  return (
    <section aria-labelledby="cumulative-cashflow-heading">
      <SectionHeading id="cumulative-cashflow-heading" title="Cumulative cashflow" />
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
            <Tooltip content={<ChartTooltip currency={currency} />} cursor={lineCursor} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
            <Area
              type="monotone"
              dataKey="cumulativeSalary"
              name="Salary"
              stroke="#15803d"
              fill="#15803d"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="cumulativeExpenses"
              name="Expenses"
              stroke="#b91c1c"
              fill="#b91c1c"
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
