"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  boxedTooltipStyle,
  chartMargin,
  gridProps,
  lineCursor,
  xAxisProps,
  yAxisProps,
} from "@/components/charts/chart-style";
import type { NetWorthGrowthPoint } from "@/lib/analytics/net-worth";
import { formatAxisValue, formatFullDate, formatMoney, formatMonthYear } from "@/lib/format";

const tableRows = [
  ["Total net worth", "totalNetWorth"],
  ["Increase due to financial assets", "financialIncrease"],
  ["Increase due to salary", "salary"],
  ["Total increase", "totalIncrease"],
] as const;

export function NetWorthGrowth({
  points,
  currency,
  startDate,
  endDate,
}: {
  points: NetWorthGrowthPoint[] | null;
  currency: string;
  startDate: string;
  endDate: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const visiblePoints = points?.filter((point) => point.period >= startDate && point.period <= endDate) ?? [];
  const hasChartData = visiblePoints.some((point) => point.financialIncrease !== null || point.salary !== null);

  return (
    <section className="mt-8 mb-8 border-b border-zinc-300 pb-6" aria-labelledby="net-worth-growth-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3">
        <h2 id="net-worth-growth-heading" className="text-xl font-medium tracking-tight text-black">
          Net-worth growth sources
        </h2>
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls="net-worth-growth-summary"
          disabled={points === null}
          onClick={() => setShowTable((shown) => !shown)}
          className="border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          {showTable ? "Hide summary table" : "Show summary table"}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-700" aria-label="Chart legend">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-700" />Increase from financial assets</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600" />Salary income</span>
      </div>

      {points === null ? (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">Growth data is unavailable because cashflow data could not be loaded.</p>
      ) : hasChartData ? (
        <div className="h-80 w-full" aria-label={`Net-worth growth sources in ${currency}`}>
          <ResponsiveContainer>
            <LineChart data={visiblePoints} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="period" tickFormatter={formatMonthYear} {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
              <Tooltip
                cursor={lineCursor}
                contentStyle={boxedTooltipStyle}
                labelFormatter={(label) => formatMonthYear(String(label))}
                formatter={(value, name) => [
                  `${formatMoney(Number(value))} ${currency}`,
                  name === "financialIncrease" ? "Increase from financial assets" : "Salary income",
                ]}
              />
              <Line type="monotone" dataKey="financialIncrease" name="financialIncrease" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="salary" name="salary" stroke="#d97706" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">No growth data is available for the selected dates.</p>
      )}

      {showTable && points !== null && (
        <div id="net-worth-growth-summary" className="mt-5">
          <p className="mb-3 text-sm text-zinc-600">
            Salary is recorded salary income. Total increase is the actual change in net worth. Financial-asset increase is the sum of each instrument’s price change multiplied by prior-period holdings, converted at prior-period FX; trades and currency movements are excluded.
          </p>
          {visiblePoints.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-zinc-100">
                    <th scope="col" className="border border-zinc-300 px-3 py-2 font-semibold text-black">{currency}</th>
                    {visiblePoints.map((point) => (
                      <th key={point.period} scope="col" className="whitespace-nowrap border border-zinc-300 px-3 py-2 text-right font-semibold text-black">
                        {formatFullDate(point.period)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map(([label, key]) => (
                    <tr key={key}>
                      <th scope="row" className="whitespace-nowrap border border-zinc-300 px-3 py-2 font-medium text-black">{label}</th>
                      {visiblePoints.map((point) => (
                        <td key={point.period} className="whitespace-nowrap border border-zinc-300 px-3 py-2 text-right tabular-nums text-black">
                          {formatMoney(point[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">No periods fall within the selected dates.</p>
          )}
        </div>
      )}
    </section>
  );
}
