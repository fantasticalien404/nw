"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, lineCursor, percentAxisWidth, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import type { InsightPeriod } from "@/lib/analytics/cashflow-insights";
import { formatAxisPercent } from "@/lib/format";
import { ChartTooltip } from "./chart-tooltip";
import { SectionHeading } from "./section-heading";

export function SavingsRateChart({ periods, currency }: { periods: Array<InsightPeriod & { label: string }>; currency: string }) {
  return (
    <div>
      <SectionHeading title="Savings rate" />
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={periods} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={formatAxisPercent} width={percentAxisWidth} />
            <Tooltip content={<ChartTooltip currency={currency} variant="incomeAndExpenses" />} cursor={lineCursor} />
            <Line
              type="monotone"
              dataKey="savingsRate"
              name="Savings rate"
              stroke="#171717"
              strokeWidth={2}
              dot={{ r: 2, fill: "#ffffff", stroke: "#171717" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
