import type { NetWorthReport, NetWorthRow } from "@/lib/analytics/net-worth";

type NetWorthTableProps = {
  report: NetWorthReport;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function formatMoney(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

function AssetGroup({ label, rows, periods }: { label: string; rows: NetWorthRow[]; periods: string[] }) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <tbody>
      <tr className="bg-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
        <th colSpan={periods.length + 2} className="border border-zinc-300 px-3 py-2">
          {label}
        </th>
      </tr>
      {rows.map((row) => (
        <tr key={`${row.datatype}-${row.asset}-${row.currency}`}>
          <th scope="row" className="border border-zinc-300 px-3 py-2 text-left font-medium text-black">
            {row.asset}
          </th>
          <td className="border border-zinc-300 px-3 py-2 text-zinc-700">{row.currency}</td>
          {row.values.map((value, index) => (
            <td key={periods[index]} className="border border-zinc-300 px-3 py-2 text-right tabular-nums text-black">
              {formatMoney(value)}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function NetWorthTable({ report }: NetWorthTableProps) {
  const financialAssets = report.rows.filter((row) => row.datatype === "quantity");
  const cashAssets = report.rows.filter((row) => row.datatype === "cash");
  const otherAssets = report.rows.filter((row) => row.datatype === "value");

  return (
    <div className="overflow-x-auto border border-zinc-300 bg-white">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead className="bg-zinc-100 text-left text-xs font-medium uppercase tracking-wide text-zinc-600">
          <tr>
            <th className="border border-zinc-300 px-3 py-2">Asset</th>
            <th className="border border-zinc-300 px-3 py-2">Currency</th>
            {report.periods.map((period, index) => (
              <th key={period} className="border border-zinc-300 px-3 py-2 text-right">
                {index === report.periods.length - 1 ? "Current" : formatDate(period)}
              </th>
            ))}
          </tr>
        </thead>
        <AssetGroup label="Financial instruments" rows={financialAssets} periods={report.periods} />
        <AssetGroup label="Cash assets" rows={cashAssets} periods={report.periods} />
        <AssetGroup label="Other assets" rows={otherAssets} periods={report.periods} />
        <tbody>
          {report.totals.map((total, index) => (
            <tr key={report.currencies[index]} className="bg-zinc-50 font-semibold">
              <th scope="row" colSpan={2} className="border border-zinc-300 px-3 py-2 text-left">
                Total ({report.currencies[index]})
              </th>
              {total.map((value, periodIndex) => (
                <td key={report.periods[periodIndex]} className="border border-zinc-300 px-3 py-2 text-right tabular-nums">
                  {formatMoney(value)}
                </td>
              ))}
            </tr>
          ))}
          <tr className="font-semibold">
            <th scope="row" colSpan={2} className="border border-zinc-300 px-3 py-2 text-left">
              Absolute change ({report.currencies[0]})
            </th>
            {report.periods.map((period, index) => (
              <td key={period} className="border border-zinc-300 px-3 py-2 text-right tabular-nums">
                {formatMoney(report.absoluteChanges[index])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
