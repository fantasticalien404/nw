"use client";

import { useState } from "react";
import type { BenchmarkInput } from "@/lib/analytics/benchmark";
import type { NetWorthReport } from "@/lib/analytics/net-worth";
import { BenchmarkComparison } from "./benchmark-comparison";
import { NetWorthChart } from "./net-worth-chart";
import { NetWorthTable } from "./net-worth-table";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yearStart(year: string) {
  return `${year}-01-01`;
}

function yearEnd(year: string) {
  return `${year}-12-31`;
}

function formatMoney(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

export function NetWorthPortfolio({
  report,
  benchmarkInputs,
}: {
  report: NetWorthReport;
  benchmarkInputs: BenchmarkInput[] | null;
}) {
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const currency = report.currencies[currencyIndex] ?? report.currencies[0];
  const currentNetWorth = report.totals[currencyIndex]?.at(-1) ?? null;
  const firstPeriod = report.periods[0] ?? "";
  const currentDate = today();
  const currentYear = currentDate.slice(0, 4);
  const latestPeriod = report.periods.at(-1) ?? currentDate;
  const rangeStart = startDate || firstPeriod;
  const rangeEnd = endDate || latestPeriod;
  const selectRange = (range: "all" | "ytd" | "current-year" | "last-year") => {
    if (range === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (range === "ytd") {
      setStartDate(yearStart(currentYear));
      setEndDate(currentDate);
      return;
    }
    const year = range === "current-year" ? currentYear : String(Number(currentYear) - 1);
    setStartDate(yearStart(year));
    setEndDate(yearEnd(year));
  };

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
        startDate={startDate}
        endDate={endDate}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        firstPeriod={firstPeriod}
        maxDate={yearEnd(currentYear)}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onRangeSelect={selectRange}
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
      {benchmarkInputs && <BenchmarkComparison inputs={benchmarkInputs} currencyIndex={currencyIndex} startDate={rangeStart} endDate={rangeEnd} />}
    </>
  );
}
