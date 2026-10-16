import { Fragment } from "react";
import type { HallOfFameMetric } from "@/lib/analytics/hall-of-fame";

function formatValue(metric: HallOfFameMetric, value: number | null) {
  if (value === null) return "—";
  if (metric.format === "percent") {
    return new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function MetricHeader({ metric }: { metric: HallOfFameMetric }) {
  return (
    <th
      colSpan={2}
      scope="colgroup"
      title={`${metric.description} Calculation: ${metric.calculation}`}
      className="cursor-help border border-zinc-300 bg-zinc-100 px-2 py-2 text-left text-xs font-semibold text-black"
    >
      <div className="flex min-h-8 items-center justify-between gap-1">
        <span>{metric.title}</span>
        <span aria-hidden="true" className="shrink-0 border-b border-dotted border-zinc-500 px-1 text-zinc-600">i</span>
      </div>
    </th>
  );
}

function RankingTable({ metrics }: { metrics: HallOfFameMetric[] }) {
  const month = metrics[0]?.currentMonth ?? "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-275 table-fixed border-collapse text-xs">
        <colgroup>
          <col style={{ width: "3.25rem" }} />
        </colgroup>
        {metrics.map((metric) => (
          <colgroup key={metric.id}>
            <col style={{ width: "11.5%" }} />
            <col style={{ width: "11.5%" }} />
          </colgroup>
        ))}
        <thead>
          <tr>
            <th rowSpan={2} scope="col" className="border border-zinc-300 bg-zinc-100 px-2 py-2 text-center font-semibold text-black">Rank</th>
            {metrics.map((metric) => <MetricHeader key={metric.id} metric={metric} />)}
          </tr>
          <tr>
            {metrics.map((metric) => (
              <Fragment key={metric.id}>
                <th scope="col" className="border border-zinc-300 bg-zinc-50 px-2 py-1 text-left font-medium text-zinc-700">Month</th>
                <th scope="col" className="border border-zinc-300 bg-zinc-50 px-2 py-1 text-right font-medium text-zinc-700">Value</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, rankIndex) => (
            <tr key={rankIndex}>
              <th scope="row" className="border border-zinc-300 px-2 py-1 text-center font-medium tabular-nums text-zinc-700">{rankIndex + 1}</th>
              {metrics.map((metric) => {
                const entry = metric.topTen[rankIndex];
                const isCurrent = entry?.month === month;
                return (
                  <Fragment key={metric.id}>
                    <td className={`whitespace-nowrap border border-zinc-300 px-2 py-1 ${isCurrent ? "bg-yellow-100" : ""}`}>
                      {entry?.month ?? "—"}
                    </td>
                    <td className={`whitespace-nowrap border border-zinc-300 px-2 py-1 text-right tabular-nums ${isCurrent ? "bg-yellow-100" : ""}`}>
                      {entry ? formatValue(metric, entry.value) : "—"}
                    </td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row" className="border border-zinc-300 bg-zinc-50 px-2 py-1 text-center font-medium text-zinc-700">Now</th>
            {metrics.map((metric) => {
              const isVisible = !metric.currentIsRanked;
              return (
                <Fragment key={metric.id}>
                  <td className={`whitespace-nowrap border border-zinc-300 px-2 py-1 font-medium ${isVisible ? "bg-yellow-100" : ""}`}>
                    {isVisible ? month : ""}
                  </td>
                  <td className={`whitespace-nowrap border border-zinc-300 px-2 py-1 text-right font-medium tabular-nums ${isVisible ? "bg-yellow-100" : ""}`}>
                    {isVisible ? formatValue(metric, metric.currentValue) : ""}
                  </td>
                </Fragment>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function HallOfFame({ metrics }: { metrics: HallOfFameMetric[] | null }) {
  return (
    <section className="mt-8 border-t border-zinc-300 pt-6" aria-labelledby="hall-of-fame-heading">
      <div className="mb-4 border-b border-zinc-200 pb-3">
        <h2 id="hall-of-fame-heading" className="text-xl font-medium tracking-tight text-black">Hall of fame</h2>
      </div>
      {metrics === null ? (
        <p className="border border-zinc-300 px-4 py-3 text-sm text-zinc-700">Rankings are unavailable because cashflow data could not be loaded.</p>
      ) : (
        <div className="space-y-5">
          {[0, 1, 2].map((rowIndex) => (
            <RankingTable key={rowIndex} metrics={metrics.slice(rowIndex * 4, rowIndex * 4 + 4)} />
          ))}
        </div>
      )}
    </section>
  );
}
