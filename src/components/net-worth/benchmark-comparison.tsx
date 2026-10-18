"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  boxedTooltipStyle,
  chartMargin,
  gridProps,
  lineCursor,
  xAxisProps,
  yAxisProps,
} from "@/components/charts/chart-style";
import { buildBenchmarkComparison, type BenchmarkInput, type RebalancePeriod } from "@/lib/analytics/benchmark";
import { formatAxisValue, formatInteger, formatMonthYear } from "@/lib/format";

const benchmarkNames = {
  balanced: "60 / 40",
  stocks: "100% stocks",
} as const;

const rebalanceNames: Record<RebalancePeriod, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export function BenchmarkComparison({
  inputs,
  currencyIndex,
  startDate,
  endDate,
}: {
  inputs: BenchmarkInput[];
  currencyIndex: number;
  startDate: string;
  endDate: string;
}) {
  const [showMethodology, setShowMethodology] = useState(false);
  const [rebalancePeriod, setRebalancePeriod] = useState<RebalancePeriod>("monthly");
  const selectedInput = inputs[currencyIndex] ?? inputs[0];
  const input = useMemo(() => ({
    ...selectedInput,
    portfolio: selectedInput.portfolio.filter((point) => point.date >= startDate && point.date <= endDate),
    cashflows: selectedInput.cashflows.filter((cashflow) => cashflow.date >= startDate && cashflow.date <= endDate),
  }), [selectedInput, startDate, endDate]);
  const comparisons = useMemo(() => ({
    balanced: buildBenchmarkComparison(input, "balanced", rebalancePeriod),
    stocks: buildBenchmarkComparison(input, "stocks", rebalancePeriod),
  }), [input, rebalancePeriod]);
  // Both benchmarks share the portfolio's dates, so their points line up by index.
  const points = comparisons.balanced.points.map((point, index) => ({
    ...point,
    balanced: point.benchmark,
    stocks: comparisons.stocks.points[index]?.benchmark ?? null,
  }));
  const hasData = points.some((point) => point.portfolio !== null && (point.balanced !== null || point.stocks !== null));
  // Each contribution is marked on the first chart date on or after the day it is invested.
  const contributionMarkers = input.cashflows
    .filter((cashflow) => cashflow.amount > 0)
    .flatMap((cashflow) => {
      const point = points.find((candidate) => candidate.date >= cashflow.date);
      return point ? [{ date: point.date, amount: cashflow.amount }] : [];
    });

  return (
    <section className="mt-8 mb-8 border-b border-zinc-300 pb-6" aria-labelledby="benchmark-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3">
        <h2 id="benchmark-heading" className="text-xl font-medium tracking-tight text-black">Benchmark comparison</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium text-zinc-800">
            <select aria-label="Rebalancing interval" value={rebalancePeriod} onChange={(event) => setRebalancePeriod(event.target.value as RebalancePeriod)} className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black focus:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
              {Object.entries(rebalanceNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button
            type="button"
            aria-expanded={showMethodology}
            aria-controls="benchmark-methodology"
            onClick={() => setShowMethodology(true)}
            className="border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Info
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-700" aria-label="Chart legend">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-black" />Portfolio</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-700" />{benchmarkNames.balanced}</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-600" />{benchmarkNames.stocks}</span>
      </div>

      {hasData ? (
        <div className="h-80 w-full" aria-label="Portfolio compared with both benchmarks">
          <ResponsiveContainer>
            <LineChart data={points} margin={chartMargin}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="date" tickFormatter={formatMonthYear} {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={formatAxisValue} />
              <Tooltip
                cursor={lineCursor}
                contentStyle={boxedTooltipStyle}
                labelFormatter={(date) => formatMonthYear(String(date))}
                formatter={(value, name) => [
                  `${formatInteger(Number(value))} ${input.currency}`,
                  name === "portfolio" ? "Portfolio" : benchmarkNames[name as keyof typeof benchmarkNames],
                ]}
              />
              {contributionMarkers.map(({ date, amount }, index) => (
                <ReferenceLine
                  key={`${date}-${index}`}
                  x={date}
                  stroke="#a3a3a3"
                  strokeDasharray="3 3"
                  label={{ value: `+${formatInteger(amount)}`, position: "insideTopLeft", fill: "#525252", fontSize: 10 }}
                />
              ))}
              <Line type="monotone" dataKey="portfolio" name="portfolio" stroke="#171717" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="balanced" name="balanced" stroke="#1d4ed8" strokeWidth={3} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="stocks" name="stocks" stroke="#d97706" strokeWidth={3} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">Benchmark data is unavailable for the current reporting history.</p>
      )}

      {showMethodology && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation">
          <div id="benchmark-methodology" role="dialog" aria-modal="true" aria-labelledby="benchmark-methodology-heading" className="w-full max-w-xl border border-zinc-300 bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <h3 id="benchmark-methodology-heading" className="text-lg font-medium tracking-tight text-black">Benchmark information</h3>
              <button type="button" onClick={() => setShowMethodology(false)} className="text-sm font-medium text-zinc-700 underline decoration-zinc-400 underline-offset-2 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">Close</button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
              <p><span className="font-medium text-black">Portfolio:</span> quantity assets only, valued as in the net-worth table. Cash and manually valued assets are excluded.</p>
              <p><span className="font-medium text-black">60 / 40:</span> 60% iShares MSCI ACWI ETF (ACWI) and 40% Vanguard Total Bond Market ETF (BND).</p>
              <p><span className="font-medium text-black">100% stocks:</span> iShares MSCI ACWI ETF (ACWI).</p>
              <p><span className="font-medium text-black">Cashflows:</span> contributions are invested at the start of the following month; withdrawal income is removed on its transaction date. The dashed vertical lines mark contribution investment dates. Flows after the latest reported holdings are excluded until the next reporting period is filled in.</p>
              <p><span className="font-medium text-black">Currency and rebalancing:</span> both benchmarks use the selected reporting currency and rebalancing interval.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
