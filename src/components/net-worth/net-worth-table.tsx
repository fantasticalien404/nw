"use client";

import { useState } from "react";
import type { NetWorthReport, NetWorthRow } from "@/lib/analytics/net-worth";

type NetWorthTableProps = {
  report: NetWorthReport;
};

function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(value);
  return `${month}-${String(value.getUTCFullYear()).slice(-2)}`;
}

function formatMoney(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function ytdPerformanceColor(value: number | null) {
  if (value === null || value === 0) return "text-black";
  return value > 0 ? "text-emerald-700" : "text-red-700";
}

function AssetName({ row }: { row: NetWorthRow }) {
  if (row.instrumentName && row.instrumentUrl) {
    return (
      <a href={row.instrumentUrl} target="_blank" rel="noreferrer" className="underline decoration-zinc-400 underline-offset-2">
        {row.instrumentName}
      </a>
    );
  }

  return row.asset;
}

function AssetGroup({ label, rows, periods, periodIndexes, currency, totals }: {
  label: string;
  rows: NetWorthRow[];
  periods: string[];
  periodIndexes: number[];
  currency: string;
  totals: Array<number | null>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <tbody>
      <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        <th colSpan={4} className="border border-zinc-300 px-2 py-1">{label}</th>
        {periodIndexes.map((periodIndex, index) => (
          <td key={periods[index]} className="border border-zinc-300 px-2 py-1 text-right tabular-nums text-black">
            {formatMoney(totals[periodIndex] ?? null)}
          </td>
        ))}
      </tr>
      {rows.map((row) => {
        const ytdPerformance = row.ytdPerformance[currency] ?? null;

        return (
          <tr key={`${row.datatype}-${row.asset}-${row.currency}`}>
            <th scope="row" className="border border-zinc-300 px-2 py-1 text-left font-medium text-black">
              <AssetName row={row} />
            </th>
            <td className="border border-zinc-300 px-2 py-1 text-zinc-700">{row.asset}</td>
            <td className="border border-zinc-300 px-2 py-1 text-zinc-700">{row.currency}</td>
            <td className={`border border-zinc-300 px-2 py-1 text-right tabular-nums ${ytdPerformanceColor(ytdPerformance)}`}>
              {formatPercentage(ytdPerformance)}
            </td>
            {periodIndexes.map((periodIndex, index) => (
              <td key={periods[index]} className="border border-zinc-300 px-2 py-1 text-right tabular-nums text-black">
                {formatMoney(row.values[periodIndex] ?? null)}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

function TotalRow({ label, currency, values, periods, periodIndexes, percentage = false }: {
  label: string;
  currency: string;
  values: Array<number | null>;
  periods: string[];
  periodIndexes: number[];
  percentage?: boolean;
}) {
  return (
    <tr className="bg-zinc-50 font-semibold">
      <th scope="row" className="border border-zinc-300 px-2 py-1 text-left">
        {label}
      </th>
      <td className="border border-zinc-300 px-2 py-1" />
      <td className="border border-zinc-300 px-2 py-1 text-zinc-700">{currency}</td>
      <td className="border border-zinc-300 px-2 py-1" />
      {periodIndexes.map((periodIndex, index) => (
        <td key={periods[index]} className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
          {percentage ? formatPercentage(values[periodIndex] ?? null) : formatMoney(values[periodIndex] ?? null)}
        </td>
      ))}
    </tr>
  );
}

export function NetWorthTable({ report, currencyIndex }: NetWorthTableProps & { currencyIndex: number }) {
  const years = [...new Set(report.periods.map((period) => period.slice(0, 4)))];
  const [selectedYear, setSelectedYear] = useState(years.at(-1) ?? "");
  const periodIndexes = report.periods.flatMap((period, index) => period.startsWith(selectedYear) ? [index] : []);
  const periods = periodIndexes.map((index) => report.periods[index]);
  const selectedCurrency = report.currencies[currencyIndex] ?? report.currencies[0];
  const financialAssets = report.rows.filter((row) => row.datatype === "quantity");
  const cashAssets = report.rows.filter((row) => row.datatype === "cash");
  const otherAssets = report.rows.filter((row) => row.datatype === "value");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-medium tracking-tight text-black">Asset summary</h2>
        <label className="text-sm font-medium text-zinc-700">
          Year
          <select className="ml-2 border border-zinc-300 bg-white px-2 py-1" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
            {years.map((year) => <option key={year}>{year}</option>)}
          </select>
        </label>
      </div>
      <div className="w-full overflow-x-auto border border-zinc-300 bg-white">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          {periods.map((period) => <col key={period} />)}
        </colgroup>
        <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="border border-zinc-300 px-2 py-1">Asset</th>
            <th className="border border-zinc-300 px-2 py-1">Ticker</th>
            <th className="border border-zinc-300 px-2 py-1">Currency</th>
            <th className="border border-zinc-300 px-2 py-1 text-right">YTD %</th>
            {periods.map((period) => (
              <th key={period} className="border border-zinc-300 px-2 py-1 text-right">
                {period === report.periods.at(-1) ? "Current" : formatDate(period)}
              </th>
            ))}
          </tr>
        </thead>
        <AssetGroup label="Financial instruments" rows={financialAssets} periods={periods} periodIndexes={periodIndexes} currency={selectedCurrency} totals={report.financialTotals[currencyIndex] ?? []} />
        <AssetGroup label="Cash assets" rows={cashAssets} periods={periods} periodIndexes={periodIndexes} currency={selectedCurrency} totals={report.cashTotals[currencyIndex] ?? []} />
        <AssetGroup label="Other assets" rows={otherAssets} periods={periods} periodIndexes={periodIndexes} currency={selectedCurrency} totals={report.otherTotals[currencyIndex] ?? []} />
        <tbody>
          <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <th colSpan={periods.length + 4} className="border border-zinc-300 px-2 py-1">Net Worth</th>
          </tr>
          {report.totals.map((total, index) => (
            <TotalRow
              key={report.currencies[index]}
              label="Total"
              currency={report.currencies[index]}
              values={total}
              periods={periods}
              periodIndexes={periodIndexes}
            />
          ))}
          <TotalRow
            label="Abs. change"
            currency={report.currencies[0]}
            values={report.absoluteChanges}
            periods={periods}
            periodIndexes={periodIndexes}
          />
          <TotalRow
            label="% change"
            currency={report.currencies[0]}
            values={report.percentageChanges}
            periods={periods}
            periodIndexes={periodIndexes}
            percentage
          />
        </tbody>
      </table>
      </div>
    </section>
  );
}
