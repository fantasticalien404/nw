"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  boxedTooltipStyle,
  chartMargin,
  gridProps,
  lineCursor,
  xAxisProps,
  yAxisProps,
} from "@/components/charts/chart-style";
import type { NetWorthReport } from "@/lib/analytics/net-worth";
import { formatAxisValue, formatInteger, formatMonthYear } from "@/lib/format";

const COLORS = ["#171717", "#1d4ed8", "#d97706"];

// Absolute net worth in every report currency on one shared axis, limited to the selected date range.
export function NetWorthByCurrency({ report, startDate, endDate }: { report: NetWorthReport; startDate: string; endDate: string }) {
  const data = report.periods.flatMap((period, index) => {
    if (period < startDate || period > endDate) return [];
    return [{
      period,
      label: index === report.periods.length - 1 ? "Current" : formatMonthYear(period),
      ...Object.fromEntries(report.currencies.map((currency, currencyIndex) => [currency, report.totals[currencyIndex]?.[index] ?? null])),
    }];
  });

  return (
    <section className="mt-8 border-t border-zinc-300 pt-6" aria-label="Net worth by currency">
      <h2 className="mb-4 font-medium text-black">Net worth by currency</h2>
      {data.length > 0 ? (
        <div className="h-70 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
              <Tooltip
                cursor={lineCursor}
                contentStyle={boxedTooltipStyle}
                formatter={(value, name) => [formatInteger(Number(value)), name]}
              />
              <Legend />
              {report.currencies.map((currency, index) => (
                <Line key={currency} type="monotone" dataKey={currency} name={currency} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">No net-worth values are available in the selected range.</p>
      )}
    </section>
  );
}
