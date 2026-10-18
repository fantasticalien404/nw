"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chartMargin, gridProps, lineCursor, percentAxisWidth, xAxisProps, yAxisProps } from "@/components/charts/chart-style";
import { formatAxisPercent, formatAxisValue, formatMoney, formatPercent } from "@/lib/format";

type Series = { key: string; name: string; color: string };

/** Titled line chart over `data` (which needs a `label` field). Values are fractions when `percent`, else money. */
export function InsightLineChart({
  title,
  data,
  lines,
  percent = false,
  currency = "",
  strokeWidth = 2,
}: {
  title: string;
  data: Array<Record<string, unknown>>;
  lines: Series[];
  percent?: boolean;
  currency?: string;
  strokeWidth?: number;
}) {
  return (
    <div>
      <h3 className="mb-2 text-base font-medium text-black">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={chartMargin}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis
              {...yAxisProps}
              tickFormatter={percent ? formatAxisPercent : formatAxisValue}
              width={percent ? percentAxisWidth : yAxisProps.width}
            />
            <Tooltip
              formatter={(value) => {
                const amount = typeof value === "number" ? value : null;
                return percent ? formatPercent(amount) : `${formatMoney(amount)} ${currency}`;
              }}
              cursor={lineCursor}
            />
            {lines.length > 1 && <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />}
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={line.color}
                strokeWidth={strokeWidth}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
