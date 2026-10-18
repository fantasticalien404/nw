import type { ExpenseTransaction } from "@/lib/analytics/cashflow";
import { sumAmounts, type InsightPeriod } from "@/lib/analytics/cashflow-insights";
import { formatMoney } from "@/lib/format";

function Metric({ label, value, currency }: { label: string; value: number | null; currency: string }) {
  return (
    <div className="border border-zinc-300 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-black">
        {formatMoney(value)} {value === null ? "" : currency}
      </p>
    </div>
  );
}

/** Headline totals for the selected expenses. `selectedDays` is the number of days the selection spans. */
export function ExpenseMetrics({
  expenses,
  periods,
  selectedDays,
  currency,
}: {
  expenses: ExpenseTransaction[];
  periods: InsightPeriod[];
  selectedDays: number;
  currency: string;
}) {
  const total = sumAmounts(expenses);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Metric label="Total expenses" value={total} currency={currency} />
      <Metric label="DAILY AVG EXPENSES" value={selectedDays === 0 ? null : total / selectedDays} currency={currency} />
      <Metric label="Salary" value={periods.reduce((sum, period) => sum + (period.salary ?? 0), 0)} currency={currency} />
      <Metric label="Essential expenses" value={sumAmounts(expenses, (expense) => expense.isEssential)} currency={currency} />
      <Metric label="Discretionary expenses" value={sumAmounts(expenses, (expense) => !expense.isEssential)} currency={currency} />
      <Metric label="Recurring expenses" value={sumAmounts(expenses, (expense) => expense.isRecurring)} currency={currency} />
    </div>
  );
}
