"use client";

import { useState } from "react";
import { tableCell, tableHead } from "@/components/ui/table-styles";
import type { NetWorthReport, NetWorthRow } from "@/lib/analytics/net-worth";
import { formatMoney, formatMonthDash, formatPercentPoints } from "@/lib/format";

/** The report periods shown for the selected year. */
type Column = { index: number; period: string };

// Fixed label columns (w-56 + w-20 + w-16 + w-16 = 432px) plus a minimum width per period: narrow screens scroll the table.
const LABEL_COLUMNS_WIDTH = 432;
const PERIOD_COLUMN_WIDTH = 68;

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

function AssetGroup({ label, rows, columns, currency, totals }: {
  label: string;
  rows: NetWorthRow[];
  columns: Column[];
  currency: string;
  totals: Array<number | null>;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <tbody>
      <tr className={tableHead}>
        <th colSpan={4} className={tableCell}>{label}</th>
        {columns.map(({ index, period }) => (
          <td key={period} className={`${tableCell} text-right tabular-nums text-black`}>
            {formatMoney(totals[index] ?? null)}
          </td>
        ))}
      </tr>
      {rows.map((row) => {
        const ytdPerformance = row.ytdPerformance[currency] ?? null;

        return (
          <tr key={`${row.datatype}-${row.asset}-${row.currency}`}>
            <th scope="row" className={`${tableCell} text-left font-medium text-black`}>
              <AssetName row={row} />
            </th>
            <td className={`${tableCell} text-zinc-700`}>{row.asset}</td>
            <td className={`${tableCell} text-zinc-700`}>{row.currency}</td>
            <td className={`${tableCell} text-right tabular-nums ${ytdPerformanceColor(ytdPerformance)}`}>
              {formatPercentPoints(ytdPerformance)}
            </td>
            {columns.map(({ index, period }) => (
              <td key={period} className={`${tableCell} text-right tabular-nums text-black`}>
                {formatMoney(row.values[index] ?? null)}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

function TotalRow({ label, currency, values, columns, percentage = false }: {
  label: string;
  currency: string;
  values: Array<number | null>;
  columns: Column[];
  percentage?: boolean;
}) {
  return (
    <tr className="bg-zinc-50 font-semibold">
      <th scope="row" className={`${tableCell} text-left`}>
        {label}
      </th>
      <td className={tableCell} />
      <td className={`${tableCell} text-zinc-700`}>{currency}</td>
      <td className={tableCell} />
      {columns.map(({ index, period }) => (
        <td key={period} className={`${tableCell} text-right tabular-nums`}>
          {percentage ? formatPercentPoints(values[index] ?? null) : formatMoney(values[index] ?? null)}
        </td>
      ))}
    </tr>
  );
}

export function NetWorthTable({ report, currencyIndex }: { report: NetWorthReport; currencyIndex: number }) {
  const years = [...new Set(report.periods.map((period) => period.slice(0, 4)))];
  const [selectedYear, setSelectedYear] = useState(years.at(-1) ?? "");
  const columns = report.periods.flatMap((period, index) => (period.startsWith(selectedYear) ? [{ index, period }] : []));
  const selectedCurrency = report.currencies[currencyIndex] ?? report.currencies[0];

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
      <table
        className="w-full table-fixed border-collapse text-xs"
        style={{ minWidth: LABEL_COLUMNS_WIDTH + columns.length * PERIOD_COLUMN_WIDTH }}
      >
        <colgroup>
          <col className="w-56" />
          <col className="w-20" />
          <col className="w-16" />
          <col className="w-16" />
          {columns.map(({ period }) => <col key={period} />)}
        </colgroup>
        <thead className={tableHead}>
          <tr>
            <th className={tableCell}>Asset</th>
            <th className={tableCell}>Ticker</th>
            <th className={tableCell}>Currency</th>
            <th className={`${tableCell} text-right`}>YTD %</th>
            {columns.map(({ period }) => (
              <th key={period} className={`${tableCell} text-right`}>
                {period === report.periods.at(-1) ? "Current" : formatMonthDash(period)}
              </th>
            ))}
          </tr>
        </thead>
        <AssetGroup label="Financial instruments" rows={report.rows.filter((row) => row.datatype === "quantity")} columns={columns} currency={selectedCurrency} totals={report.financialTotals[currencyIndex] ?? []} />
        <AssetGroup label="Cash assets" rows={report.rows.filter((row) => row.datatype === "cash")} columns={columns} currency={selectedCurrency} totals={report.cashTotals[currencyIndex] ?? []} />
        <AssetGroup label="Other assets" rows={report.rows.filter((row) => row.datatype === "value")} columns={columns} currency={selectedCurrency} totals={report.otherTotals[currencyIndex] ?? []} />
        <tbody>
          <tr className={tableHead}>
            <th colSpan={columns.length + 4} className={tableCell}>Net Worth</th>
          </tr>
          {report.totals.map((total, index) => (
            <TotalRow key={report.currencies[index]} label="Total" currency={report.currencies[index]} values={total} columns={columns} />
          ))}
          <TotalRow label="Abs. change" currency={report.currencies[0]} values={report.absoluteChanges} columns={columns} />
          <TotalRow label="% change" currency={report.currencies[0]} values={report.percentageChanges} columns={columns} percentage />
        </tbody>
      </table>
      </div>
    </section>
  );
}
