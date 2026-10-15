"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NetWorthReport } from "@/lib/analytics/net-worth";

type NetWorthChartProps = {
  report: NetWorthReport;
  currencyIndex: number;
  onCurrencyChange: (index: number) => void;
  startDate: string;
  endDate: string;
  rangeStart: string;
  rangeEnd: string;
  firstPeriod: string;
  maxDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onRangeSelect: (range: "all" | "ytd" | "current-year" | "last-year") => void;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function formatAxisValue(value: number) {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  const absolute = Math.abs(rounded);

  if (absolute >= 1_000_000) return `${sign}${Math.round(absolute / 1_000_000)}m`;
  if (absolute >= 1_000) return `${sign}${Math.round(absolute / 1_000)}k`;
  return `${rounded}`;
}

function formatPercent(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    signDisplay: "always",
    maximumFractionDigits: 1,
  }).format(value);
}

export function NetWorthChart({
  report,
  currencyIndex,
  onCurrencyChange,
  startDate,
  endDate,
  rangeStart,
  rangeEnd,
  firstPeriod,
  maxDate,
  onStartDateChange,
  onEndDateChange,
  onRangeSelect,
}: NetWorthChartProps) {
  const currency = report.currencies[currencyIndex];
  const values = report.totals[currencyIndex] ?? [];
  const isCalendarYear = rangeStart.slice(5) === "01-01" && rangeEnd.slice(5) === "12-31" && rangeStart.slice(0, 4) === rangeEnd.slice(0, 4);
  const valuesByMonth = new Map(report.periods.map((period, index) => [period.slice(0, 7), values[index] ?? null]));
  const data = isCalendarYear
    ? Array.from({ length: 12 }, (_, month) => {
      const period = `${rangeStart.slice(0, 4)}-${String(month + 1).padStart(2, "0")}-01`;
      return { label: formatDate(period), period, value: valuesByMonth.get(period.slice(0, 7)) ?? null };
    })
    : report.periods.flatMap((period, index) => {
      if (period < rangeStart || period > rangeEnd) return [];
      return [{
        label: index === report.periods.length - 1 ? "Current" : formatDate(period),
        period,
        value: values[index] ?? null,
      }];
    });
  const availableValues = data.filter((entry): entry is (typeof data)[number] & { value: number } => entry.value !== null);
  const firstValue = availableValues[0]?.value;
  const currentValue = availableValues.at(-1)?.value;
  const change = firstValue && currentValue !== undefined ? currentValue / firstValue - 1 : null;

  return (
    <section className="mb-8 border-b border-zinc-300 pb-6" aria-label="Net-worth trend">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Display currency">
          {report.currencies.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => onCurrencyChange(index)}
              aria-pressed={index === currencyIndex}
              className={`border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                index === currencyIndex
                  ? "border-black bg-black text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:border-black hover:text-black"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          From
          <input className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black" type="date" min={firstPeriod} max={rangeEnd} value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium text-zinc-800">
          To
          <input className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black" type="date" min={rangeStart} max={maxDate} value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
        </label>
        <button type="button" onClick={() => onRangeSelect("all")} className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black">All time</button>
        <button type="button" onClick={() => onRangeSelect("ytd")} className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black">YTD</button>
        <button type="button" onClick={() => onRangeSelect("current-year")} className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black">Current year</button>
          <button type="button" onClick={() => onRangeSelect("last-year")} className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black">Last year</button>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-600">Δ since first period</p>
          <p className="text-lg font-semibold tabular-nums text-black">{formatPercent(change)}</p>
        </div>
      </div>

      {availableValues.length > 0 ? (
        <div className="h-70 w-full" aria-label={`Net worth in ${currency}`}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#d4d4d4" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={{ stroke: "#171717" }}
                tickLine={false}
                tick={{ fill: "#525252", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#525252", fontSize: 11 }}
                tickFormatter={formatAxisValue}
                width={54}
              />
              <Tooltip
                cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
                contentStyle={{ border: "1px solid #171717", borderRadius: 0, boxShadow: "none" }}
                formatter={(value) => [`${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Number(value))} ${currency}`, "Net worth"]}
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
