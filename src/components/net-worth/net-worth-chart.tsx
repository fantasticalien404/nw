"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  boxedTooltipStyle,
  chartMargin,
  gridProps,
  lineCursor,
  xAxisProps,
  yAxisProps,
} from "@/components/charts/chart-style";
import { ReportFilters } from "@/components/ui/report-filters";
import type { ReportRangeState } from "@/components/ui/use-report-range";
import type { NetWorthReport } from "@/lib/analytics/net-worth";
import { formatAxisValue, formatInteger, formatMonthYear, formatPercent } from "@/lib/format";

type NetWorthChartProps = {
  report: NetWorthReport;
  currencyIndex: number;
  onCurrencyChange: (index: number) => void;
  range: ReportRangeState;
  firstPeriod: string;
  maxDate: string;
};

type TrendPoint = { label: string; period: string; value: number | null };

/** A single full calendar year shows all twelve months (gaps included); any other range shows reporting periods only. */
function buildTrendData(report: NetWorthReport, values: Array<number | null>, rangeStart: string, rangeEnd: string): TrendPoint[] {
  const isCalendarYear = rangeStart.slice(5) === "01-01" && rangeEnd.slice(5) === "12-31" && rangeStart.slice(0, 4) === rangeEnd.slice(0, 4);
  if (isCalendarYear) {
    const valuesByMonth = new Map(report.periods.map((period, index) => [period.slice(0, 7), values[index] ?? null]));
    return Array.from({ length: 12 }, (_, month) => {
      const period = `${rangeStart.slice(0, 4)}-${String(month + 1).padStart(2, "0")}-01`;
      return { label: formatMonthYear(period), period, value: valuesByMonth.get(period.slice(0, 7)) ?? null };
    });
  }

  return report.periods.flatMap((period, index) => {
    if (period < rangeStart || period > rangeEnd) return [];
    return [{
      label: index === report.periods.length - 1 ? "Current" : formatMonthYear(period),
      period,
      value: values[index] ?? null,
    }];
  });
}

export function NetWorthChart({ report, currencyIndex, onCurrencyChange, range, firstPeriod, maxDate }: NetWorthChartProps) {
  const currency = report.currencies[currencyIndex];
  const data = buildTrendData(report, report.totals[currencyIndex] ?? [], range.rangeStart, range.rangeEnd);
  const availableValues = data.flatMap((entry) => (entry.value === null ? [] : [entry.value]));
  const firstValue = availableValues[0];
  const currentValue = availableValues.at(-1);
  const change = firstValue && currentValue !== undefined ? currentValue / firstValue - 1 : null;

  return (
    <section className="mb-8 border-b border-zinc-300 pb-6" aria-label="Net-worth trend">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <ReportFilters
          currencies={report.currencies}
          selectedCurrency={currency}
          onCurrencyChange={(selected) => onCurrencyChange(report.currencies.indexOf(selected))}
          range={range}
          minDate={firstPeriod}
          maxDate={maxDate}
        />
        <div className="text-right">
          <p className="text-sm text-zinc-600">Δ since first period</p>
          <p className="text-lg font-semibold tabular-nums text-black">{formatPercent(change, { digits: 1, signed: true })}</p>
        </div>
      </div>

      {availableValues.length > 0 ? (
        <div className="h-70 w-full" aria-label={`Net worth in ${currency}`}>
          <ResponsiveContainer>
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
              <Tooltip
                cursor={lineCursor}
                contentStyle={boxedTooltipStyle}
                formatter={(value) => [`${formatInteger(Number(value))} ${currency}`, "Net worth"]}
                labelFormatter={(_, payload) => payload[0]?.payload.label ?? ""}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#171717"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ffffff", stroke: "#171717", strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: "#171717", stroke: "#ffffff", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">No net-worth values are available in {currency}.</p>
      )}
    </section>
  );
}
