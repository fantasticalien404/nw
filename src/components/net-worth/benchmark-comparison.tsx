"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  buildBenchmarkComparison,
  type BenchmarkId,
  type BenchmarkInput,
  type RebalancePeriod,
} from "@/lib/analytics/benchmark";

const benchmarkNames: Record<BenchmarkId, string> = {
  balanced: "60 / 40",
  stocks: "100% stocks",
};

const benchmarkInstruments: Record<BenchmarkId, string> = {
  balanced: "60% iShares MSCI ACWI ETF (ACWI) · 40% Vanguard Total Bond Market ETF (BND)",
  stocks: "100% iShares MSCI ACWI ETF (ACWI)",
};

const rebalanceNames: Record<RebalancePeriod, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function formatAxis(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${Math.round(value / 1_000_000)}m`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

export function BenchmarkComparison({ inputs }: { inputs: BenchmarkInput[] }) {
  const [showMethodology, setShowMethodology] = useState(false);
  const [benchmark, setBenchmark] = useState<BenchmarkId>("balanced");
  const [rebalancePeriod, setRebalancePeriod] = useState<RebalancePeriod>("monthly");
  const input = inputs[0];
  const comparison = useMemo(
    () => buildBenchmarkComparison(input, benchmark, rebalancePeriod),
    [input, benchmark, rebalancePeriod],
  );
  const hasData = comparison.points.some((point) => point.portfolio !== null && point.benchmark !== null);
  const contributionMarkers = input.cashflows
    .filter((cashflow) => cashflow.amount > 0)
    .flatMap((cashflow) => {
      const point = comparison.points.find((candidate) => candidate.date >= cashflow.date);
      return point ? [{ date: point.date, amount: cashflow.amount }] : [];
    });

  return (
    <section className="mb-8 border-b border-zinc-300 pb-6" aria-labelledby="benchmark-heading">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="benchmark-heading" className="text-xl font-medium tracking-tight text-black">Benchmark comparison</h2>
          <p className="mt-1 text-sm text-zinc-600">Each benchmark starts at your first reported financial-instruments value and receives the same portfolio contributions and withdrawals.</p>
        </div>
        <button
          type="button"
          aria-expanded={showMethodology}
          aria-controls="benchmark-methodology"
          onClick={() => setShowMethodology((visible) => !visible)}
          className="border border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          {showMethodology ? "Hide methodology" : "Info"}
        </button>
      </div>

      {showMethodology && (
        <div id="benchmark-methodology" className="mb-5 border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700">
          <p><span className="font-medium text-black">Portfolio:</span> the total value of your financial instruments (quantity assets only), priced as in the net-worth table. Cash and manually valued assets are excluded.</p>
          <p className="mt-1.5"><span className="font-medium text-black">Cashflows:</span> each contribution is invested in the benchmark at the start of the following month; withdrawal income is removed on its transaction date. Contribution investment dates are marked on the chart.</p>
          <p className="mt-1.5"><span className="font-medium text-black">Benchmark:</span> it is valued daily in the primary reporting currency and rebalanced at the selected interval. IRR is annualized and money-weighted, using the starting value, scheduled contribution and withdrawal dates, and the ending value.</p>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3 border-y border-zinc-200 py-3">
        <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
          Benchmark
          <select value={benchmark} onChange={(event) => setBenchmark(event.target.value as BenchmarkId)} className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black focus:outline-2 focus:outline-offset-2 focus:outline-black">
            {Object.entries(benchmarkNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
          Rebalancing
          <select value={rebalancePeriod} onChange={(event) => setRebalancePeriod(event.target.value as RebalancePeriod)} className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black focus:outline-2 focus:outline-offset-2 focus:outline-black">
            {Object.entries(rebalanceNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <p className="mb-5 text-sm text-zinc-600"><span className="font-medium text-zinc-800">Instruments:</span> {benchmarkInstruments[benchmark]}</p>

      {hasData ? (
        <div className="h-80 w-full" aria-label={`Portfolio compared with ${benchmarkNames[benchmark]}`}>
          <ResponsiveContainer>
            <LineChart data={comparison.points} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#d4d4d4" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} axisLine={{ stroke: "#171717" }} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={formatAxis} axisLine={false} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} width={54} />
              <Tooltip
                cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
                contentStyle={{ border: "1px solid #171717", borderRadius: 0, boxShadow: "none" }}
                labelFormatter={(date) => formatDate(String(date))}
                formatter={(value, name) => [
                  `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Number(value))} ${input.currency}`,
                  name === "portfolio" ? "Portfolio" : benchmarkNames[benchmark],
                ]}
              />
              {contributionMarkers.map(({ date, amount }, index) => (
                <ReferenceLine
                  key={`${date}-${index}`}
                  x={date}
                  stroke="#a3a3a3"
                  strokeDasharray="3 3"
                  label={{ value: `+${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(amount)}`, position: "insideTopLeft", fill: "#525252", fontSize: 10 }}
                />
              ))}
              <Line type="monotone" dataKey="portfolio" name="portfolio" stroke="#171717" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="benchmark" name="benchmark" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">Benchmark data is unavailable for the current reporting history.</p>
      )}

    </section>
  );
}
