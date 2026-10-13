"use client";

import { useState } from "react";
import type { NetWorthReport } from "@/lib/analytics/net-worth";
import { NetWorthChart } from "./net-worth-chart";
import { NetWorthTable } from "./net-worth-table";

export function NetWorthPortfolio({ report }: { report: NetWorthReport }) {
  const [currencyIndex, setCurrencyIndex] = useState(0);

  return (
    <>
      <NetWorthChart report={report} currencyIndex={currencyIndex} onCurrencyChange={setCurrencyIndex} />
      {report.warnings.length > 0 && (
        <section className="mb-6 border border-zinc-300 bg-zinc-50 p-4" aria-labelledby="data-quality-heading">
          <h2 id="data-quality-heading" className="font-medium text-black">Data quality</h2>
          <p className="mt-1 text-sm text-zinc-700">Some current values could not be retrieved and are shown as —.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {report.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      )}
      <NetWorthTable report={report} currencyIndex={currencyIndex} />
    </>
  );
}
