"use client";

import { useState } from "react";
import { useReportRange } from "@/components/ui/use-report-range";
import type { BenchmarkInput } from "@/lib/analytics/benchmark";
import type { HallOfFameMetric } from "@/lib/analytics/hall-of-fame";
import type { NetWorthGrowthPoint, NetWorthReport } from "@/lib/analytics/net-worth";
import { today } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { BenchmarkComparison } from "./benchmark-comparison";
import { HallOfFame } from "./hall-of-fame";
import { NetWorthByCurrency } from "./net-worth-by-currency";
import { NetWorthChart } from "./net-worth-chart";
import { NetWorthGrowth } from "./net-worth-growth";
import { NetWorthTable } from "./net-worth-table";

export function NetWorthPortfolio({
  report,
  benchmarkInputs,
  growthSeries,
  hallOfFame,
}: {
  report: NetWorthReport;
  benchmarkInputs: BenchmarkInput[] | null;
  growthSeries: NetWorthGrowthPoint[][] | null;
  hallOfFame: HallOfFameMetric[] | null;
}) {
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const currentDate = today();
  const firstPeriod = report.periods[0] ?? "";
  const range = useReportRange({ today: currentDate, firstDate: firstPeriod, lastDate: report.periods.at(-1) ?? currentDate });
  const currency = report.currencies[currencyIndex] ?? report.currencies[0];
  const currentNetWorth = report.totals[currencyIndex]?.at(-1) ?? null;

  return (
    <>
      <header className="mb-8 border-b border-zinc-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          {formatMoney(currentNetWorth)} {currency}
        </h1>
      </header>

      <NetWorthChart
        report={report}
        currencyIndex={currencyIndex}
        onCurrencyChange={setCurrencyIndex}
        range={range}
        firstPeriod={firstPeriod}
        maxDate={`${currentDate.slice(0, 4)}-12-31`}
      />
      {report.warnings.length > 0 && (
        <section className="mb-5 border border-zinc-300 bg-zinc-50 px-4 py-3" aria-labelledby="data-quality-heading">
          <h2 id="data-quality-heading" className="font-medium text-black">Data quality</h2>
          <p className="mt-1 text-sm text-zinc-700">Some current values could not be retrieved and are shown as —.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {report.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}
      <NetWorthTable report={report} currencyIndex={currencyIndex} />
      {benchmarkInputs && (
        <BenchmarkComparison inputs={benchmarkInputs} currencyIndex={currencyIndex} startDate={range.rangeStart} endDate={range.rangeEnd} />
      )}
      <NetWorthGrowth
        points={growthSeries?.[currencyIndex] ?? null}
        currency={currency}
        startDate={range.rangeStart}
        endDate={range.rangeEnd}
      />
      <HallOfFame metrics={hallOfFame} />
      <NetWorthByCurrency report={report} startDate={range.rangeStart} endDate={range.rangeEnd} />
    </>
  );
}
