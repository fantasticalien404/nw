import { formatMoney } from "@/lib/format";

type TooltipEntry = {
  name?: string;
  value?: number | null;
  payload?: { income: number | null; expenses: number | null };
};

/**
 * Tooltip for the cashflow charts, passed to Recharts as `content`.
 * - `series`: every plotted value of the hovered month.
 * - `nonZero`: like `series`, without zero values (stacked area charts list many categories).
 * - `incomeAndExpenses`: the month's income and expenses, whatever series the chart plots (savings-rate chart).
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency,
  variant = "series",
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  currency: string;
  variant?: "series" | "nonZero" | "incomeAndExpenses";
}) {
  if (!active || !payload?.length) return null;
  const period = payload[0].payload;
  const visiblePayload = variant === "nonZero" ? payload.filter((entry) => entry.value !== 0) : payload;

  return (
    <div
      className="border border-zinc-900 bg-white px-3 py-2 text-xs shadow-none"
      style={{ backgroundColor: "#fff", opacity: 1 }}
    >
      <p className="mb-1 font-medium text-zinc-900">{label ?? "—"}</p>
      {variant === "incomeAndExpenses" && period ? (
        <>
          <p className="text-emerald-700">
            Income: {formatMoney(period.income)} {currency}
          </p>
          <p className="text-red-700">
            Expenses: {formatMoney(period.expenses)} {currency}
          </p>
        </>
      ) : (
        visiblePayload.map((entry, index) => (
          <p key={entry.name ?? index} className="text-zinc-700">
            {entry.name}: {formatMoney(entry.value ?? null)} {currency}
          </p>
        ))
      )}
    </div>
  );
}
