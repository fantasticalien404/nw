"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { NetWorthReport } from "@/lib/analytics/net-worth";

type NetWorthChartProps = {
  report: NetWorthReport;
  currencyIndex: number;
  onCurrencyChange: (index: number) => void;
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

export function NetWorthChart({ report, currencyIndex, onCurrencyChange }: NetWorthChartProps) {
  const currency = report.currencies[currencyIndex];
  const values = report.totals[currencyIndex] ?? [];
  const data = report.periods.map((period, index) => ({
    label: index === report.periods.length - 1 ? "Current" : formatDate(period),
    period,
    value: values[index] ?? null,
  }));
  const availableValues = data.filter((entry): entry is (typeof data)[number] & { value: number } => entry.value !== null);
  const firstValue = availableValues[0]?.value;
  const currentValue = availableValues.at(-1)?.value;
  const change = firstValue && currentValue !== undefined ? currentValue / firstValue - 1 : null;

  return (
    <section className="mb-8 border-b border-zinc-300 pb-6" aria-labelledby="net-worth-trend-heading">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="net-worth-trend-heading" className="text-xl font-medium tracking-tight text-black">
            Trend
          </h2>
          <p className="mt-1 text-sm text-zinc-600">Reporting periods through current value</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-zinc-600">Change since first period</p>
          <p className="text-lg font-semibold tabular-nums text-black">{formatPercent(change)}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Display currency">
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
