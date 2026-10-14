"use client";

import { useState } from "react";
import type { NetWorthReport } from "@/lib/analytics/net-worth";
import { NetWorthChart } from "./net-worth-chart";
import { NetWorthTable } from "./net-worth-table";

function formatMoney(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

export function NetWorthPortfolio({ report }: { report: NetWorthReport }) {
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const currency = report.currencies[currencyIndex] ?? report.currencies[0];
  const currentNetWorth = report.totals[currencyIndex]?.at(-1) ?? null;

  return (
    <>
      <header className="mb-8 border-b border-zinc-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          {formatMoney(currentNetWorth)} {currency}
        </h1>
      </header>

      <NetWorthChart report={report} currencyIndex={currencyIndex} onCurrencyChange={setCurrencyIndex} />
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
    </>
  );
}
