"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildExpenseHistogram,
  buildExpenseMovingAverage,
  type CashflowPeriod,
  type CashflowReport,
} from "@/lib/analytics/cashflow";

type CashflowDashboardProps = {
  report: CashflowReport;
  reports: Record<string, CashflowReport>;
  currency: string;
};

const categoryColors = [
  "#1d4ed8",
  "#7c3aed",
  "#c2410c",
  "#0f766e",
  "#a21caf",
  "#92400e",
  "#4f46e5",
  "#047857",
];

function formatMoney(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
        value,
      );
}

function formatMoneyToInteger(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        maximumFractionDigits: 0,
      }).format(value);
}

function formatMonth(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
  return `${month}-${String(date.getUTCFullYear()).slice(-2)}`;
}

function formatPercent(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-GB", {
        style: "percent",
        maximumFractionDigits: 0,
      }).format(value);
}

function Metric({
  label,
  value,
  currency,
  formatValue = formatMoney,
}: {
  label: string;
  value: number | null;
  currency: string;
  formatValue?: (value: number | null) => string;
}) {
  return (
    <div className="border border-zinc-300 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-black">
        {formatValue(value)} {value === null ? "" : currency}
      </p>
    </div>
  );
}

function axisValue(value: number) {
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

function monthlyAverage(values: Array<number | null>) {
  return (
    values.reduce<number>((total, value) => total + (value ?? 0), 0) /
    values.length
  );
}

function averageRate(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length === 0
    ? null
    : available.reduce((total, value) => total + value, 0) / available.length;
}

function expensesExcluding(
  period: CashflowPeriod,
  excludedCategories: string[],
) {
  if (period.expenses === null) return null;

  const excluded = new Set(
    excludedCategories.map((category) => category.toLowerCase()),
  );
  const excludedExpenses = Object.entries(period.expenseCategories).reduce(
    (total, [category, amount]) =>
      total + (excluded.has(category.toLowerCase()) ? (amount ?? 0) : 0),
    0,
  );
  return period.expenses - excludedExpenses;
}

function previousMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

function reportingYearMonths(report: CashflowReport, cutoff: string) {
  const year = cutoff.slice(0, 4);
  const periods = new Map(
    report.periods.map((period) => [period.period, period]),
  );

  return Array.from({ length: 12 }, (_, index) => {
    const period = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    const source = periods.get(period);
    const visible = period <= cutoff;

    return {
      period,
      label: formatMonth(period),
      income: visible ? (source?.income ?? null) : null,
      chartIncome: visible ? (source?.chartIncome ?? null) : null,
      expenses: visible ? (source?.expenses ?? null) : null,
      savingsRate: visible ? (source?.savingsRate ?? null) : null,
      salary: visible ? (source?.salary ?? null) : null,
      essentialExpenses: visible ? (source?.essentialExpenses ?? null) : null,
      discretionaryExpenses: visible
        ? (source?.discretionaryExpenses ?? null)
        : null,
      recurringExpenses: visible ? (source?.recurringExpenses ?? null) : null,
      nonRecurringExpenses: visible
        ? (source?.nonRecurringExpenses ?? null)
        : null,
      categories: visible ? (source?.categories ?? {}) : {},
      expenseCategories: visible ? (source?.expenseCategories ?? {}) : {},
      expensesExcludingRent:
        visible && source ? expensesExcluding(source, ["rent"]) : null,
    };
  });
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  showSavingsRate = false,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string;
    name?: string;
    value?: number | null;
    payload?: CashflowPeriod;
  }>;
  label?: string;
  currency: string;
  showSavingsRate?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const period = payload[0].payload;

  return (
    <div className="border border-zinc-900 bg-white px-3 py-2 text-xs shadow-none">
      <p className="mb-1 font-medium text-zinc-900">{label ?? "—"}</p>
      {showSavingsRate && period ? (
        <>
          <p className="text-emerald-700">
            Income: {formatMoney(period.income)} {currency}
          </p>
          <p className="text-red-700">
            Expenses: {formatMoney(period.expenses)} {currency}
          </p>
        </>
      ) : (
        payload.map((entry) => (
          <p key={entry.dataKey} className="text-zinc-700">
            {entry.name}: {formatMoney(entry.value ?? null)} {currency}
          </p>
        ))
      )}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="mb-5 text-xl font-medium tracking-tight text-black">
      {title}
    </h2>
  );
}

type InsightLineProps = {
  title: string;
  data: Array<Record<string, unknown>>;
  dataKey?: string;
  color?: string;
  percent?: boolean;
  currency?: string;
  lines?: Array<{ key: string; name: string; color: string }>;
  strokeWidth?: number;
};

function InsightLine({
  title,
  data,
  dataKey,
  color,
  percent = false,
  currency,
  lines,
  strokeWidth = 2,
}: InsightLineProps) {
  const series =
    lines ?? (dataKey && color ? [{ key: dataKey, name: title, color }] : []);
  return (
    <div>
      <h3 className="mb-2 text-base font-medium text-black">{title}</h3>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
          >
            <CartesianGrid stroke="#d4d4d4" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={{ stroke: "#171717" }}
              tickLine={false}
              tick={{ fill: "#525252", fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#525252", fontSize: 11 }}
              tickFormatter={
                percent ? (value) => `${Math.round(value * 100)}%` : axisValue
              }
              width={percent ? 46 : 54}
            />
            <Tooltip
              formatter={(value) =>
                percent
                  ? formatPercent(typeof value === "number" ? value : null)
                  : `${formatMoney(typeof value === "number" ? value : null)} ${currency ?? ""}`
              }
              cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
            />
            {series.length > 1 && (
              <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
            )}
            {series.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.name}
                stroke={line.color}
                strokeWidth={strokeWidth}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CashflowDashboard({
  report,
  reports,
  currency,
}: CashflowDashboardProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [insightCurrency, setInsightCurrency] = useState(currency);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(report.expenseCategories),
  );
  const [selectedParents, setSelectedParents] = useState<Set<string>>(
    () => new Set(report.parentCategories),
  );
  const [openCategoryMenu, setOpenCategoryMenu] = useState<
    "parent" | "category" | null
  >(null);
  const [classification, setClassification] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [customStart, setCustomStart] = useState(
    () => `${new Date().getUTCFullYear()}-01-01`,
  );
  const [customEnd, setCustomEnd] = useState(() => {
    const date = new Date();
    date.setUTCDate(0);
    return date.toISOString().slice(0, 10);
  });
  const [hiddenExpenseCategories, setHiddenExpenseCategories] = useState<
    Set<string>
  >(() => new Set());
  const [hiddenMovingAverageCategories, setHiddenMovingAverageCategories] =
    useState<Set<string>>(() => new Set());
  const [movingAverageDays, setMovingAverageDays] = useState(30);
  const currentPeriod = report.periods
    .filter((period) => period.period <= previousMonth())
    .at(-1);
  const averagePeriods = report.periods.filter(
    (period) => period.period <= previousMonth(),
  );
  const cutoff = previousMonth();
  const periodData = reportingYearMonths(report, cutoff);
  const insightReport = reports[insightCurrency];
  const categoryOptions = insightReport.expenseCategories;
  const parentOptions = insightReport.parentCategories;
  const reportingEnd = new Date(`${cutoff}T00:00:00Z`);
  reportingEnd.setUTCMonth(reportingEnd.getUTCMonth() + 1, 0);
  const reportingEndDate = reportingEnd.toISOString().slice(0, 10);
  const insightRangeStart = customStart;
  const insightRangeEnd = customEnd;
  const hasValidRange = Boolean(
    insightRangeStart &&
    insightRangeEnd &&
    insightRangeStart <= insightRangeEnd,
  );
  const filteredExpenses = insightReport.expenseTransactions.filter(
    (expense) =>
      (selectedMonth !== "all" || hasValidRange) &&
      (selectedMonth === "all"
        ? expense.date >= insightRangeStart && expense.date <= insightRangeEnd
        : expense.date.slice(5, 7) === selectedMonth) &&
      (selectedCategories.size === 0 ||
        selectedCategories.has(expense.category)) &&
      (selectedParents.size === 0 ||
        selectedParents.has(expense.parentCategory)) &&
      (classification === "all" ||
        (classification === "essential"
          ? expense.isEssential
          : classification === "discretionary"
            ? !expense.isEssential
            : classification === "recurring"
              ? expense.isRecurring
              : !expense.isRecurring)),
  );
  const insightPeriodData = reportingYearMonths(insightReport, cutoff).map(
    (period) => {
      const expenses = filteredExpenses.filter(
        (expense) => `${expense.date.slice(0, 7)}-01` === period.period,
      );
      const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const essential = expenses
        .filter((expense) => expense.isEssential)
        .reduce((sum, expense) => sum + expense.amount, 0);
      const recurring = expenses
        .filter((expense) => expense.isRecurring)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return {
        ...period,
        expenses: period.period <= cutoff ? total : null,
        essentialExpenses: period.period <= cutoff ? essential : null,
        discretionaryExpenses:
          period.period <= cutoff ? total - essential : null,
        recurringExpenses: period.period <= cutoff ? recurring : null,
        nonRecurringExpenses:
          period.period <= cutoff ? total - recurring : null,
        savingsRate:
          period.income === null || period.income === 0
            ? null
            : (period.income - total) / period.income,
      };
    },
  );
  const histogramByMonth = new Map(
    buildExpenseHistogram(filteredExpenses, "month").map((period) => [
      `${period.period}-01`,
      period.categories,
    ]),
  );
  const movingAverageByMonth = new Map<string, Record<string, number>>();
  for (const period of buildExpenseMovingAverage(
    filteredExpenses,
    movingAverageDays,
    insightReport.rangeStart,
    insightReport.rangeEnd,
  )) {
    if (period.period <= cutoff)
      movingAverageByMonth.set(
        `${period.period.slice(0, 7)}-01`,
        period.categories,
      );
  }
  const histogramData = insightPeriodData.map((period) => ({
    ...period,
    categories: histogramByMonth.get(period.period) ?? {},
  }));
  const movingAverageData = insightPeriodData.map((period) => ({
    ...period,
    categories: movingAverageByMonth.get(period.period) ?? {},
  }));
  const movingAverageCategories = [
    ...new Set(filteredExpenses.map((expense) => expense.parentCategory)),
  ].sort();
  const metricPeriods = insightPeriodData.map((period) => ({
    ...period,
    essentialToSalary: period.salary
      ? (period.essentialExpenses ?? 0) / period.salary
      : null,
    discretionaryToSalary: period.salary
      ? (period.discretionaryExpenses ?? 0) / period.salary
      : null,
  }));
  const cumulativeData = periodData.reduce<
    Array<
      (typeof periodData)[number] & {
        cumulativeSalary: number | null;
        cumulativeExpenses: number | null;
      }
    >
  >((data, period) => {
    if (period.period > cutoff)
      return [
        ...data,
        { ...period, cumulativeSalary: null, cumulativeExpenses: null },
      ];
    const previous = data.at(-1);
    return [
      ...data,
      {
        ...period,
        cumulativeSalary:
          (previous?.cumulativeSalary ?? 0) + (period.chartIncome ?? 0),
        cumulativeExpenses:
          (previous?.cumulativeExpenses ?? 0) + (period.expenses ?? 0),
      },
    ];
  }, []);
  const filteredTotalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const daysInSelection =
    selectedMonth === "all"
      ? hasValidRange
        ? Math.floor(
            (Date.parse(`${insightRangeEnd}T00:00:00Z`) -
              Date.parse(`${insightRangeStart}T00:00:00Z`)) /
              86_400_000,
          ) + 1
        : 0
      : new Date(
          Number(cutoff.slice(0, 4)),
          Number(selectedMonth),
          0,
        ).getDate();

  return (
    <div className="space-y-10">
      <section
        className="border-b border-zinc-300 pb-8"
        aria-labelledby="monthly-cashflow-heading"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title="Monthly cashflow" />
          {currentPeriod && (
            <div className="grid grid-cols-3 gap-5 text-right text-xs tabular-nums">
              <div>
                <p className="text-zinc-600">Income</p>
                <p className="mt-1 font-semibold text-emerald-700">
                  {formatMoney(currentPeriod.income)}
                </p>
              </div>
              <div>
                <p className="text-zinc-600">Expenses</p>
                <p className="mt-1 font-semibold text-red-700">
                  {formatMoney(currentPeriod.expenses)}
                </p>
              </div>
              <div>
                <p className="text-zinc-600">Savings rate</p>
                <p className="mt-1 font-semibold text-black">
                  {formatPercent(currentPeriod.savingsRate)}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart
              data={periodData}
              margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="#d4d4d4" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={{ stroke: "#171717" }}
                tickLine={false}
                tick={{ fill: "#525252", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#525252", fontSize: 11 }}
                tickFormatter={axisValue}
                width={54}
              />
              <Tooltip
                content={<ChartTooltip currency={currency} />}
                cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
              />
              <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="expenses"
                name="EXPENSES"
                stroke="#b91c1c"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="expensesExcludingRent"
                name="EXPENSES (NO RENT)"
                stroke="#b91c1c"
                strokeOpacity={0.35}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="chartIncome"
                name="INCOME"
                stroke="#15803d"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section
        className="overflow-x-auto border border-zinc-300 bg-white"
        aria-label="Cashflow summary"
      >
        <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[16%]" />
            {report.periods.map((period) => (
              <col key={period.period} />
            ))}
            <col />
            <col />
          </colgroup>
          <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border border-zinc-300 px-2 py-1">Cashflow</th>
              {report.periods.map((period) => (
                <th
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right"
                >
                  {formatMonth(period.period)}
                </th>
              ))}
              <th className="border border-zinc-300 px-2 py-1 text-right">
                Total
              </th>
              <th className="border border-zinc-300 px-2 py-1 text-right">
                Monthly avg
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <th
                colSpan={report.periods.length + 3}
                className="border border-zinc-300 px-2 py-1"
              >
                Income
              </th>
            </tr>
            {report.incomeCategories.map((category) => (
              <tr key={category}>
                <th
                  scope="row"
                  className="border border-zinc-300 px-2 py-1 text-left font-medium text-black"
                >
                  {category}
                </th>
                {report.periods.map((period) => (
                  <td
                    key={period.period}
                    className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                  >
                    {formatMoney(period.incomeCategories[category])}
                  </td>
                ))}
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    report.periods.reduce(
                      (total, period) =>
                        total + (period.incomeCategories[category] ?? 0),
                      0,
                    ),
                  )}
                </td>
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    monthlyAverage(
                      averagePeriods.map(
                        (period) => period.incomeCategories[category],
                      ),
                    ),
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-50 font-semibold">
              <th
                scope="row"
                className="border border-zinc-300 px-2 py-1 text-left"
              >
                Total income
              </th>
              {report.periods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(period.income)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(report.totalIncome)}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(averagePeriods.map((period) => period.income)),
                )}
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <th
                colSpan={report.periods.length + 3}
                className="border border-zinc-300 px-2 py-1"
              >
                Expenses
              </th>
            </tr>
            {report.parentCategories.map((category) => (
              <tr key={category}>
                <th
                  scope="row"
                  className="border border-zinc-300 px-2 py-1 text-left font-medium text-black"
                >
                  {category}
                </th>
                {report.periods.map((period) => (
                  <td
                    key={period.period}
                    className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                  >
                    {formatMoney(period.categories[category])}
                  </td>
                ))}
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    report.periods.reduce(
                      (total, period) =>
                        total + (period.categories[category] ?? 0),
                      0,
                    ),
                  )}
                </td>
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    monthlyAverage(
                      averagePeriods.map(
                        (period) => period.categories[category],
                      ),
                    ),
                  )}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <th
                scope="row"
                className="border border-zinc-300 px-2 py-1 text-left"
              >
                Expense (no rent)
              </th>
              {report.periods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(expensesExcluding(period, ["rent"]))}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  report.periods.reduce(
                    (total, period) =>
                      total + (expensesExcluding(period, ["rent"]) ?? 0),
                    0,
                  ),
                )}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    averagePeriods.map((period) =>
                      expensesExcluding(period, ["rent"]),
                    ),
                  ),
                )}
              </td>
            </tr>
            <tr className="font-semibold">
              <th
                scope="row"
                className="border border-zinc-300 px-2 py-1 text-left"
              >
                Expense (no rent and health insurance)
              </th>
              {report.periods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(
                    expensesExcluding(period, ["rent", "health insurance"]),
                  )}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  report.periods.reduce(
                    (total, period) =>
                      total +
                      (expensesExcluding(period, [
                        "rent",
                        "health insurance",
                      ]) ?? 0),
                    0,
                  ),
                )}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    averagePeriods.map((period) =>
                      expensesExcluding(period, ["rent", "health insurance"]),
                    ),
                  ),
                )}
              </td>
            </tr>
            <tr className="bg-zinc-50 font-semibold">
              <th
                scope="row"
                className="border border-zinc-300 px-2 py-1 text-left"
              >
                Expenses
              </th>
              {report.periods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(period.expenses)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(report.totalExpenses)}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    averagePeriods.map((period) => period.expenses),
                  ),
                )}
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <th
                colSpan={report.periods.length + 3}
                className="border border-zinc-300 px-2 py-1"
              >
                Savings
              </th>
            </tr>
            <tr className="font-semibold">
              <th
                scope="row"
                className="border border-zinc-300 px-2 py-1 text-left"
              >
                Savings
              </th>
              {report.periods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(period.savings)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(report.totalSavings)}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    averagePeriods.map((period) => period.savings),
                  ),
                )}
              </td>
            </tr>
            <tr className="font-semibold">
              <th
                scope="row"
                className="border border-zinc-300 px-2 py-1 text-left"
              >
                Savings rate
              </th>
              {report.periods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatPercent(period.savingsRate)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatPercent(
                  report.totalIncome === 0
                    ? null
                    : report.totalSavings / report.totalIncome,
                )}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatPercent(
                  averageRate(
                    averagePeriods.map((period) => period.savingsRate),
                  ),
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {report.unclassifiedExpenses > 0 && (
          <p className="border-t border-zinc-300 px-3 py-2 text-sm text-zinc-600">
            Unclassified expenses: {formatMoney(report.unclassifiedExpenses)}{" "}
            {currency}
          </p>
        )}
      </section>

      <section
        className="border-b border-zinc-300 pb-8"
        aria-labelledby="expense-composition-heading"
      >
        <SectionHeading title="Expense composition" />
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <AreaChart
              data={periodData}
              margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
            >
              <CartesianGrid stroke="#d4d4d4" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={{ stroke: "#171717" }}
                tickLine={false}
                tick={{ fill: "#525252", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#525252", fontSize: 11 }}
                tickFormatter={axisValue}
                width={54}
              />
              <Tooltip
                content={<ChartTooltip currency={currency} />}
                cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
              />
              <Legend
                iconType="square"
                wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                onClick={(entry) => {
                  const category = String(entry.value);
                  setHiddenCategories((categories) => {
                    const nextCategories = new Set(categories);
                    if (nextCategories.has(category))
                      nextCategories.delete(category);
                    else nextCategories.add(category);
                    return nextCategories;
                  });
                }}
              />
              {report.parentCategories.map((category, index) => (
                <Area
                  key={category}
                  type="monotone"
                  dataKey={`categories.${category}`}
                  name={category}
                  stackId="expenses"
                  hide={hiddenCategories.has(category)}
                  stroke={categoryColors[index % categoryColors.length]}
                  fill={categoryColors[index % categoryColors.length]}
                  fillOpacity={0.72}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section
        className="space-y-8 border-t border-zinc-300 pt-8"
        aria-labelledby="expense-insights-heading"
      >
        <SectionHeading title="Expense insights" />
        <div className="border border-zinc-300 bg-zinc-50 p-4">
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <label className="text-xs font-medium text-zinc-700">
              Display currency
              <select
                className="mt-1 w-full border border-zinc-300 bg-white px-2 py-1.5"
                value={insightCurrency}
                onChange={(event) => {
                  const nextCurrency = event.target.value;
                  setInsightCurrency(nextCurrency);
                  setSelectedCategories(
                    new Set(reports[nextCurrency].expenseCategories),
                  );
                  setSelectedParents(
                    new Set(reports[nextCurrency].parentCategories),
                  );
                }}
              >
                {Object.keys(reports).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Expense classification
              <select
                className="mt-1 w-full border border-zinc-300 bg-white px-2 py-1.5"
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
              >
                <option value="all">All expenses</option>
                <option value="essential">Essential</option>
                <option value="discretionary">Discretionary</option>
                <option value="recurring">Recurring</option>
                <option value="non-recurring">Non-recurring</option>
              </select>
            </label>
            <label className="text-xs font-medium text-zinc-700">
              Month
              <select
                className="mt-1 w-full border border-zinc-300 bg-white px-2 py-1.5"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              >
                <option value="all">Use date range</option>
                {Array.from({ length: 12 }, (_, index) => {
                  const value = String(index + 1).padStart(2, "0");
                  return (
                    <option key={value} value={value}>
                      {new Intl.DateTimeFormat("en-GB", {
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(`2026-${value}-01T00:00:00Z`))}
                    </option>
                  );
                })}
              </select>
            </label>
            <fieldset className="sm:col-span-2 lg:col-span-2">
              <div className="mt-1 grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-600">
                  From
                  <input
                    className="mt-1 w-full border border-zinc-300 bg-white px-2 py-1.5"
                    type="date"
                    max={customEnd || reportingEndDate}
                    value={customStart}
                    onChange={(event) => {
                      setCustomStart(event.target.value);
                      setSelectedMonth("all");
                    }}
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  To
                  <input
                    className="mt-1 w-full border border-zinc-300 bg-white px-2 py-1.5"
                    type="date"
                    min={customStart}
                    max={reportingEndDate}
                    value={customEnd}
                    onChange={(event) => {
                      setCustomEnd(event.target.value);
                      setSelectedMonth("all");
                    }}
                  />
                </label>
              </div>
            </fieldset>
            <div className="relative self-end">
              <button
                type="button"
                className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
                onClick={() =>
                  setOpenCategoryMenu((menu) =>
                    menu === "parent" ? null : "parent",
                  )
                }
              >
                Parent categories
                {selectedParents.size > 0 ? ` (${selectedParents.size})` : ""}
              </button>
              {openCategoryMenu === "parent" && (
                <div className="absolute z-10 mt-1 w-80 border border-zinc-300 bg-white p-3 shadow-lg">
                  <div className="mb-3 flex justify-between text-xs underline">
                    <button
                      type="button"
                      onClick={() => setSelectedParents(new Set(parentOptions))}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedParents(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {parentOptions.map((parent) => (
                      <label
                        key={parent}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedParents.has(parent)}
                          onChange={() =>
                            setSelectedParents((parents) => {
                              const next = new Set(parents);
                              if (next.has(parent)) next.delete(parent);
                              else next.add(parent);
                              return next;
                            })
                          }
                        />
                        {parent}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative self-end">
              <button
                type="button"
                className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
                onClick={() =>
                  setOpenCategoryMenu((menu) =>
                    menu === "category" ? null : "category",
                  )
                }
              >
                Categories
                {selectedCategories.size > 0
                  ? ` (${selectedCategories.size})`
                  : ""}
              </button>
              {openCategoryMenu === "category" && (
                <div className="absolute z-10 mt-1 w-80 border border-zinc-300 bg-white p-3 shadow-lg">
                  <div className="mb-3 flex justify-between text-xs underline">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCategories(new Set(categoryOptions))
                      }
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                    {categoryOptions.map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(category)}
                          onChange={() =>
                            setSelectedCategories((categories) => {
                              const next = new Set(categories);
                              if (next.has(category)) next.delete(category);
                              else next.add(category);
                              return next;
                            })
                          }
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-600">
          Filters apply only to the following section only. Hide/show a category
          by clicking on it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Metric
            label="Total expenses"
            value={filteredTotalExpenses}
            currency={insightCurrency}
            formatValue={formatMoneyToInteger}
          />
          <Metric
            label="DAILY AVG EXPENSES"
            value={
              daysInSelection === 0
                ? null
                : filteredTotalExpenses / daysInSelection
            }
            currency={insightCurrency}
            formatValue={formatMoneyToInteger}
          />
          <Metric
            label="Salary"
            value={insightPeriodData.reduce(
              (sum, period) => sum + (period.salary ?? 0),
              0,
            )}
            currency={insightCurrency}
            formatValue={formatMoneyToInteger}
          />
          <Metric
            label="Essential expenses"
            value={filteredExpenses
              .filter((expense) => expense.isEssential)
              .reduce((sum, expense) => sum + expense.amount, 0)}
            currency={insightCurrency}
          />
          <Metric
            label="Discretionary expenses"
            value={filteredExpenses
              .filter((expense) => !expense.isEssential)
              .reduce((sum, expense) => sum + expense.amount, 0)}
            currency={insightCurrency}
          />
          <Metric
            label="Recurring expenses"
            value={filteredExpenses
              .filter((expense) => expense.isRecurring)
              .reduce((sum, expense) => sum + expense.amount, 0)}
            currency={insightCurrency}
          />
        </div>

        <div>
          <p className="mb-4 text-sm text-zinc-600">
            Click a category in the legend to hide/show it. Filters are applied
            before this view.
          </p>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <BarChart
                data={histogramData}
                margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#d4d4d4" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: "#171717" }}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 11 }}
                  tickFormatter={axisValue}
                  width={54}
                />
                <Tooltip
                  content={<ChartTooltip currency={insightCurrency} />}
                  cursor={{ fill: "#f4f4f5" }}
                />
                <Legend
                  iconType="square"
                  wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                  onClick={(entry) => {
                    const category = String(entry.value);
                    setHiddenExpenseCategories((categories) => {
                      const next = new Set(categories);
                      if (next.has(category)) next.delete(category);
                      else next.add(category);
                      return next;
                    });
                  }}
                />
                {categoryOptions.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={`categories.${category}`}
                    name={category}
                    stackId="expenses"
                    hide={hiddenExpenseCategories.has(category)}
                    fill={categoryColors[index % categoryColors.length]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <InsightLine
            title="Essential vs Discretionary / Salary"
            data={metricPeriods}
            lines={[
              {
                key: "essentialToSalary",
                name: "Essential expenses / salary",
                color: "#b91c1c",
              },
              {
                key: "discretionaryToSalary",
                name: "Discretionary expenses / salary",
                color: "#ff6f00",
              },
            ]}
            percent
            strokeWidth={3}
          />
          <InsightLine
            title="Essential vs Recurring vs Discretionary"
            data={metricPeriods}
            lines={[
              { key: "essentialExpenses", name: "Essential", color: "#b91c1c" },
              { key: "recurringExpenses", name: "Recurring", color: "#7c3aed" },
              {
                key: "discretionaryExpenses",
                name: "Discretionary",
                color: "#ff6f00",
              },
            ]}
            currency={insightCurrency}
          />
        </div>

        <div>
          <SectionHeading title="Savings rate" />
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart
                data={periodData}
                margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#d4d4d4" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: "#171717" }}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 11 }}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                  width={46}
                />
                <Tooltip
                  content={<ChartTooltip currency={currency} showSavingsRate />}
                  cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
                />
                <Line
                  type="monotone"
                  dataKey="savingsRate"
                  name="Savings rate"
                  stroke="#171717"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#ffffff", stroke: "#171717" }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex h-full flex-col">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-medium text-black">
                  Moving average expenses by parent category
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Daily expense average over the selected trailing window.
                </p>
              </div>
              <label className="text-sm font-medium text-zinc-700">
                Window (days)
                <input
                  className="ml-2 w-20 border border-zinc-300 px-2 py-1 text-right"
                  type="number"
                  min="1"
                  value={movingAverageDays}
                  onChange={(event) =>
                    setMovingAverageDays(
                      Math.max(1, Number(event.target.value) || 1),
                    )
                  }
                />
              </label>
            </div>
            <div className="min-h-80 w-full flex-1">
              <ResponsiveContainer>
                <LineChart
                  data={movingAverageData}
                  margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
                >
                  <CartesianGrid stroke="#d4d4d4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    axisLine={{ stroke: "#171717" }}
                    tickLine={false}
                    tick={{ fill: "#525252", fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#525252", fontSize: 11 }}
                    tickFormatter={axisValue}
                    width={54}
                  />
                  <Tooltip
                    content={<ChartTooltip currency={insightCurrency} />}
                    cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
                  />
                  <Legend
                    iconType="line"
                    wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                    onClick={(entry) => {
                      const category = String(entry.value);
                      setHiddenMovingAverageCategories((categories) => {
                        const next = new Set(categories);
                        if (next.has(category)) next.delete(category);
                        else next.add(category);
                        return next;
                      });
                    }}
                  />
                  {movingAverageCategories.map((category, index) => (
                    <Line
                      key={category}
                      type="monotone"
                      dataKey={`categories.${category}`}
                      name={category}
                      hide={hiddenMovingAverageCategories.has(category)}
                      stroke={categoryColors[index % categoryColors.length]}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="overflow-x-auto border border-zinc-300 bg-white">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="border border-zinc-300 px-2 py-1">
                    MOV. AVG. expenses by parent category
                  </th>
                  <th className="border border-zinc-300 px-2 py-1 text-right">Daily AVG</th>
                  <th className="border border-zinc-300 px-2 py-1 text-right">TOT</th>
                </tr>
              </thead>
              <tbody>
                {movingAverageCategories.map((category) => (
                  <tr key={category}>
                    <th className="border border-zinc-300 px-2 py-1 text-left font-medium">
                      {category}
                    </th>
                    <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                      {formatMoneyToInteger(
                        movingAverageData
                          .filter((period) => period.period <= cutoff)
                          .at(-1)?.categories[category] ?? null,
                      )}{" "}
                      {insightCurrency}
                    </td>
                    <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                      {formatMoneyToInteger(
                        filteredExpenses
                          .filter(
                            (expense) => expense.parentCategory === category,
                          )
                          .reduce((sum, expense) => sum + expense.amount, 0),
                      )}{" "}
                      {insightCurrency}
                    </td>
                  </tr>
                ))}
                <tr className="bg-zinc-50 font-semibold">
                  <th className="border border-zinc-300 px-2 py-1 text-left">
                    TOT
                  </th>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      daysInSelection === 0
                        ? null
                        : filteredTotalExpenses / daysInSelection,
                    )}{" "}
                    {insightCurrency}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(filteredTotalExpenses)}{" "}
                    {insightCurrency}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <th className="border border-zinc-300 px-2 py-1 text-left">
                    TOT (NO RENT)
                  </th>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      daysInSelection === 0
                        ? null
                        : filteredExpenses
                            .filter(
                              (expense) =>
                                expense.category.toLowerCase() !== "rent",
                            )
                            .reduce((sum, expense) => sum + expense.amount, 0) /
                            daysInSelection,
                    )}{" "}
                    {insightCurrency}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      filteredExpenses
                        .filter(
                          (expense) =>
                            expense.category.toLowerCase() !== "rent",
                        )
                        .reduce((sum, expense) => sum + expense.amount, 0),
                    )}{" "}
                    {insightCurrency}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <th className="border border-zinc-300 px-2 py-1 text-left">
                    TOT ESSENTIAL
                  </th>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      daysInSelection === 0
                        ? null
                        : filteredExpenses
                            .filter((expense) => expense.isEssential)
                            .reduce((sum, expense) => sum + expense.amount, 0) /
                            daysInSelection,
                    )}{" "}
                    {insightCurrency}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      filteredExpenses
                        .filter((expense) => expense.isEssential)
                        .reduce((sum, expense) => sum + expense.amount, 0),
                    )}{" "}
                    {insightCurrency}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <th className="border border-zinc-300 px-2 py-1 text-left">
                    TOT RECURRING
                  </th>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      daysInSelection === 0
                        ? null
                        : filteredExpenses
                            .filter((expense) => expense.isRecurring)
                            .reduce((sum, expense) => sum + expense.amount, 0) /
                            daysInSelection,
                    )}{" "}
                    {insightCurrency}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      filteredExpenses
                        .filter((expense) => expense.isRecurring)
                        .reduce((sum, expense) => sum + expense.amount, 0),
                    )}{" "}
                    {insightCurrency}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <th className="border border-zinc-300 px-2 py-1 text-left">
                    TOT DISCRETIONARY
                  </th>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      daysInSelection === 0
                        ? null
                        : filteredExpenses
                            .filter((expense) => !expense.isEssential)
                            .reduce((sum, expense) => sum + expense.amount, 0) /
                            daysInSelection,
                    )}{" "}
                    {insightCurrency}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                    {formatMoneyToInteger(
                      filteredExpenses
                        .filter((expense) => !expense.isEssential)
                        .reduce((sum, expense) => sum + expense.amount, 0),
                    )}{" "}
                    {insightCurrency}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div aria-labelledby="cumulative-cashflow-heading">
          <SectionHeading title="Cumulative cashflow" />
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <AreaChart
                data={cumulativeData}
                margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
              >
                <CartesianGrid stroke="#d4d4d4" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: "#171717" }}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 11 }}
                  tickFormatter={axisValue}
                  width={54}
                />
                <Tooltip
                  content={<ChartTooltip currency={currency} />}
                  cursor={{ stroke: "#171717", strokeDasharray: "3 3" }}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="cumulativeSalary"
                  name="Salary"
                  stroke="#15803d"
                  fill="#15803d"
                  fillOpacity={0.35}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeExpenses"
                  name="Expenses"
                  stroke="#b91c1c"
                  fill="#b91c1c"
                  fillOpacity={0.35}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
