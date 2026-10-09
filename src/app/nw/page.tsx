import { NetWorthChart } from "@/components/net-worth/net-worth-chart";
import { NetWorthTable } from "@/components/net-worth/net-worth-table";
import { buildNetWorthReport } from "@/lib/analytics/net-worth";
import { loadNetWorthWorkbook } from "@/lib/sheets/net-worth";
import { connection } from "next/server";

export const instant = false;

function formatMoney(value: number | null) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
  }).format(value);
}

async function loadReport() {
  try {
    const workbook = await loadNetWorthWorkbook();
    return { report: await buildNetWorthReport(workbook), error: null };
  } catch (error) {
    return {
      report: null,
      error: error instanceof Error ? error.message : "The net-worth data could not be loaded.",
    };
  }
}

export default async function NetWorthPage() {
  await connection();
  const { report, error } = await loadReport();

  if (error || !report) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Net worth</h1>
        <p className="mt-4 border border-zinc-300 bg-zinc-50 p-4 text-zinc-800">{error}</p>
      </main>
    );
  }

  const currentNetWorth = report.totals[0]?.at(-1) ?? null;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-10 border-b border-zinc-300 pb-6">
        <p className="mb-2 text-sm text-zinc-600">Current net worth</p>
        <h1 className="text-3xl font-semibold tracking-tight text-black">
          {formatMoney(currentNetWorth)} {report.currencies[0]}
        </h1>
      </header>

      <NetWorthChart report={report} />

      {report.warnings.length > 0 && (
        <section className="mb-6 border border-zinc-300 bg-zinc-50 p-4" aria-labelledby="data-quality-heading">
          <h2 id="data-quality-heading" className="font-medium text-black">
            Data quality
          </h2>
          <p className="mt-1 text-sm text-zinc-700">
            Some current values could not be retrieved and are shown as —.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <NetWorthTable report={report} />
    </main>
  );
}
