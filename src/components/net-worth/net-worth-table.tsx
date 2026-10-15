"use client";

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

function AssetGroup({ label, rows, periods, currency }: { label: string; rows: NetWorthRow[]; periods: string[]; currency: string }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <tbody>
      <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        <th colSpan={periods.length + 4} className="border border-zinc-300 px-2 py-1">
          {label}
        </th>
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
            {row.values.map((value, index) => (
              <td key={periods[index]} className="border border-zinc-300 px-2 py-1 text-right tabular-nums text-black">
                {formatMoney(value)}
              </td>
            ))}
          </tr>
        );
      })}
    </tbody>
  );
}

function TotalRow({ label, currency, values, periods, percentage = false }: {
  label: string;
  currency: string;
  values: Array<number | null>;
  periods: string[];
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
      {values.map((value, periodIndex) => (
        <td key={periods[periodIndex]} className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
          {percentage ? formatPercentage(value) : formatMoney(value)}
        </td>
      ))}
    </tr>
  );
}

export function NetWorthTable({ report, currencyIndex }: NetWorthTableProps & { currencyIndex: number }) {
  const selectedCurrency = report.currencies[currencyIndex] ?? report.currencies[0];
  const financialAssets = report.rows.filter((row) => row.datatype === "quantity");
  const cashAssets = report.rows.filter((row) => row.datatype === "cash");
  const otherAssets = report.rows.filter((row) => row.datatype === "value");

  return (
    <div className="w-full border border-zinc-300 bg-white">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          <col className="w-[7%]" />
          {report.periods.map((period) => <col key={period} />)}
        </colgroup>
        <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="border border-zinc-300 px-2 py-1">Asset</th>
            <th className="border border-zinc-300 px-2 py-1">Ticker</th>
            <th className="border border-zinc-300 px-2 py-1">Currency</th>
            <th className="border border-zinc-300 px-2 py-1 text-right">YTD %</th>
            {report.periods.map((period, index) => (
              <th key={period} className="border border-zinc-300 px-2 py-1 text-right">
                {index === report.periods.length - 1 ? "Current" : formatDate(period)}
              </th>
            ))}
          </tr>
        </thead>
        <AssetGroup label="Financial instruments" rows={financialAssets} periods={report.periods} currency={selectedCurrency} />
        <AssetGroup label="Cash assets" rows={cashAssets} periods={report.periods} currency={selectedCurrency} />
        <AssetGroup label="Other assets" rows={otherAssets} periods={report.periods} currency={selectedCurrency} />
        <tbody>
          <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <th colSpan={report.periods.length + 4} className="border border-zinc-300 px-2 py-1">Net Worth</th>
          </tr>
          {report.totals.map((total, index) => (
            <TotalRow
              key={report.currencies[index]}
              label="Total"
              currency={report.currencies[index]}
              values={total}
              periods={report.periods}
            />
          ))}
          <TotalRow
            label="Abs. change"
            currency={report.currencies[0]}
            values={report.absoluteChanges}
            periods={report.periods}
          />
          <TotalRow
            label="% change"
            currency={report.currencies[0]}
            values={report.percentageChanges}
            periods={report.periods}
            percentage
          />
        </tbody>
      </table>
    </div>
  );
}
