"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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
  buildExpenseMovingAverage,
  type CashflowPeriod,
  type CashflowReport,
} from "@/lib/analytics/cashflow";
import { ReportFilters, type ReportRange } from "@/components/ui/report-filters";

type CashflowDashboardProps = {
  reports: Record<string, CashflowReport>;
  currency: string;
  reportingDate: string;
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

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});
const percentFormatter = new Intl.NumberFormat("en-GB", {
  style: "percent",
  maximumFractionDigits: 0,
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});
const fullMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC",
});
const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return {
    value,
    label: fullMonthFormatter.format(new Date(`2026-${value}-01T00:00:00Z`)),
  };
});

function formatMoney(value: number | null) {
  return value === null ? "—" : moneyFormatter.format(value);
}

const formatMoneyToInteger = formatMoney;

function formatMonth(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  return `${monthFormatter.format(date)}-${String(date.getUTCFullYear()).slice(-2)}`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : percentFormatter.format(value);
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
  return values.length === 0
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0) /
        values.length;
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

function previousMonth(reportingDate: string) {
  const date = new Date(`${reportingDate}T00:00:00Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 10);
}

function selectedDays(start: string, end: string, month: string) {
  if (start > end) return 0;
  let days = 0;
  const current = new Date(`${start}T00:00:00Z`);
  const final = new Date(`${end}T00:00:00Z`);

  while (current <= final) {
    if (month === "all" || current.toISOString().slice(5, 7) === month) days += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function availableReportMonths(report: CashflowReport, reportingDate: string) {
  const currentMonth = reportingDate.slice(0, 7);
  return report.periods.filter((period) =>
    period.period.slice(0, 7) <= currentMonth &&
    [period.income, period.expenses].some((value) => value !== null),
  );
}

function emptyPeriod(report: CashflowReport, period: string): CashflowPeriod {
  return {
    period,
    income: null,
    chartIncome: null,
    expenses: null,
    savings: null,
    savingsRate: null,
    salary: null,
    essentialExpenses: null,
    discretionaryExpenses: null,
    recurringExpenses: null,
    nonRecurringExpenses: null,
    incomeCategories: Object.fromEntries(report.incomeCategories.map((category) => [category, null])),
    expenseCategories: Object.fromEntries(report.expenseCategories.map((category) => [category, null])),
    categories: Object.fromEntries(report.parentCategories.map((category) => [category, null])),
  };
}

function rangePeriods(report: CashflowReport, startDate: string, endDate: string) {
  if (!startDate || !endDate || startDate > endDate) return [];

  const periods = new Map(report.periods.map((period) => [period.period, period]));
  const current = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`);
  const final = new Date(`${endDate.slice(0, 7)}-01T00:00:00Z`);
  const result: CashflowPeriod[] = [];

  while (current <= final) {
    const period = current.toISOString().slice(0, 10);
    result.push(periods.get(period) ?? emptyPeriod(report, period));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return result;
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  showSavingsRate = false,
  hideZeroValues = false,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | null;
    payload?: CashflowPeriod;
  }>;
  label?: string;
  currency: string;
  showSavingsRate?: boolean;
  hideZeroValues?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const period = payload[0].payload;
  const visiblePayload = hideZeroValues
    ? payload.filter((entry) => entry.value !== 0)
    : payload;

  return (
    <div
      className="border border-zinc-900 bg-white px-3 py-2 text-xs shadow-none"
      style={{ backgroundColor: "#fff", opacity: 1 }}
    >
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
        visiblePayload.map((entry, index) => (
          <p key={entry.name ?? index} className="text-zinc-700">
            {entry.name}: {formatMoney(entry.value ?? null)} {currency}
          </p>
        ))
      )}
    </div>
  );
}

function SectionHeading({ title, id }: { title: string; id?: string }) {
  return (
    <h2 id={id} className="mb-5 text-xl font-medium tracking-tight text-black">
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
  reports,
  currency,
  reportingDate,
}: CashflowDashboardProps) {
  const categoryMenuId = useId();
  const [displayCurrency, setDisplayCurrency] = useState(currency);
  const report = reports[displayCurrency];
  const summaryReport = reports[currency];
  const cutoff = previousMonth(reportingDate);
  const [insightCurrency, setInsightCurrency] = useState(currency);
  const summaryYears = [...new Set(summaryReport.periods.map((period) => period.period.slice(0, 4)))];
  const [selectedSummaryYear, setSelectedSummaryYear] = useState(
    () => summaryYears.at(-1) ?? reportingDate.slice(0, 4),
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const firstPeriod = report.periods[0]?.period ?? reportingDate;
  const currentYear = reportingDate.slice(0, 4);
  const rangeStart = startDate || firstPeriod;
  const rangeEnd = endDate || reportingDate;
  const selectRange = (range: ReportRange) => {
    if (range === "all") {
      setStartDate("");
      setEndDate("");
      return;
    }
    if (range === "ytd") {
      setStartDate(`${currentYear}-01-01`);
      setEndDate(reportingDate);
      return;
    }
    const year = range === "current-year" ? currentYear : String(Number(currentYear) - 1);
    setStartDate(`${year}-01-01`);
    setEndDate(`${year}-12-31`);
  };
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
  const [expenseAggregation, setExpenseAggregation] = useState<
    "category" | "parent"
  >("category");
  const [hiddenExpenseCategories, setHiddenExpenseCategories] = useState<
    Set<string>
  >(() => new Set());
  const [hiddenMovingAverageCategories, setHiddenMovingAverageCategories] =
    useState<Set<string>>(() => new Set());
  const [movingAverageDays, setMovingAverageDays] = useState(30);
  const [historicalExpenseCategory, setHistoricalExpenseCategory] = useState("");
  const [historicalParentCategory, setHistoricalParentCategory] = useState(
    () => report.parentCategories.find((category) => category.toLowerCase() === "food") ?? "",
  );
  const [showHistoricalSalary, setShowHistoricalSalary] = useState(false);
  const summaryPeriods = useMemo(
    () => rangePeriods(summaryReport, `${selectedSummaryYear}-01-01`, `${selectedSummaryYear}-12-31`),
    [summaryReport, selectedSummaryYear],
  );
  const summaryAveragePeriods = summaryPeriods.filter(
    (period) => period.period <= cutoff,
  );
  const summaryTotalIncome = summaryPeriods.reduce(
    (total, period) => total + (period.income ?? 0),
    0,
  );
  const summaryTotalExpenses = summaryPeriods.reduce(
    (total, period) => total + (period.expenses ?? 0),
    0,
  );
  const summaryTotalSavings = summaryTotalIncome - summaryTotalExpenses;
  const periodData = useMemo(
    () => rangePeriods(report, rangeStart, rangeEnd).map((period) => {
      const visible = period.period <= cutoff;
      return {
        ...period,
        label: formatMonth(period.period),
        income: visible ? period.income : null,
        chartIncome: visible ? period.chartIncome : null,
        expenses: visible ? period.expenses : null,
        salary: visible ? period.salary : null,
        expensesExcludingRent: visible && period.expenses !== null
          ? expensesExcluding(period, ["rent"])
          : null,
      };
    }),
    [report, rangeStart, rangeEnd, cutoff],
  );
  const insightReport = reports[insightCurrency];
  const categoryOptions = insightReport.expenseCategories;
  const parentOptions = insightReport.parentCategories;
  const insightRangeStart = rangeStart;
  const insightRangeEnd = rangeEnd < reportingDate ? rangeEnd : reportingDate;
  const hasValidRange = insightRangeStart <= insightRangeEnd;
  const filteredExpenses = useMemo(
    () => insightReport.expenseTransactions.filter(
      (expense) =>
        hasValidRange &&
        expense.date >= insightRangeStart &&
        expense.date <= insightRangeEnd &&
        (selectedMonth === "all" || expense.date.slice(5, 7) === selectedMonth) &&
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
    ),
    [
      insightReport,
      selectedMonth,
      hasValidRange,
      insightRangeStart,
      insightRangeEnd,
      selectedCategories,
      selectedParents,
      classification,
    ],
  );
  const expensesByMonth = useMemo(() => {
    const months = new Map<string, typeof filteredExpenses>();
    for (const expense of filteredExpenses) {
      const month = `${expense.date.slice(0, 7)}-01`;
      const expenses = months.get(month) ?? [];
      expenses.push(expense);
      months.set(month, expenses);
    }
    return months;
  }, [filteredExpenses]);
  const insightPeriodData = useMemo(
    () => availableReportMonths(insightReport, reportingDate)
      .filter((period) => expensesByMonth.has(period.period))
      .map((period) => {
        const expenses = expensesByMonth.get(period.period)!;
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const essential = expenses
          .filter((expense) => expense.isEssential)
          .reduce((sum, expense) => sum + expense.amount, 0);
        const recurring = expenses
          .filter((expense) => expense.isRecurring)
          .reduce((sum, expense) => sum + expense.amount, 0);
        return {
          ...period,
          label: formatMonth(period.period),
          expenses: total,
          essentialExpenses: essential,
          discretionaryExpenses: total - essential,
          recurringExpenses: recurring,
          nonRecurringExpenses: total - recurring,
          savingsRate:
            period.income === null || period.income === 0
              ? null
              : (period.income - total) / period.income,
        };
      }),
    [insightReport, reportingDate, expensesByMonth],
  );
  const expenseSeries = (expenseAggregation === "category"
    ? categoryOptions
    : parentOptions
  ).map((name, index) => ({ name, dataKey: `expense-${index}` }));
  const histogramByMonth = useMemo(() => {
    const months = new Map<string, Map<string, number>>();
    for (const expense of filteredExpenses) {
      const month = `${expense.date.slice(0, 7)}-01`;
      const grouping = expenseAggregation === "category"
        ? expense.category
        : expense.parentCategory;
      const categories = months.get(month) ?? new Map<string, number>();
      categories.set(grouping, (categories.get(grouping) ?? 0) + expense.amount);
      months.set(month, categories);
    }
    return months;
  }, [filteredExpenses, expenseAggregation]);
  const movingAverageByMonth = useMemo(() => {
    const months = new Map<string, Record<string, number>>();
    for (const period of buildExpenseMovingAverage(
      filteredExpenses,
      movingAverageDays,
      insightReport.rangeStart,
      insightReport.rangeEnd,
    )) {
      if (period.period <= cutoff)
        months.set(`${period.period.slice(0, 7)}-01`, period.categories);
    }
    return months;
  }, [
    filteredExpenses,
    movingAverageDays,
    insightReport.rangeStart,
    insightReport.rangeEnd,
    cutoff,
  ]);
  const histogramData = insightPeriodData.map((period) => {
    const categories = histogramByMonth.get(period.period);
    return {
      ...period,
      ...Object.fromEntries(
        expenseSeries.map(({ name, dataKey }) => [dataKey, categories?.get(name) ?? 0]),
      ),
    };
  });
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
  const historicalExpenseData = insightPeriodData.map((period) => ({
    label: period.label,
    expenses: historicalExpenseCategory || historicalParentCategory
      ? (expensesByMonth.get(period.period) ?? [])
          .filter((expense) => historicalExpenseCategory
            ? expense.category === historicalExpenseCategory
            : expense.parentCategory === historicalParentCategory)
          .reduce((sum, expense) => sum + expense.amount, 0)
      : null,
    salary: showHistoricalSalary ? period.salary : null,
  }));
  const historicalExpenseLabel = historicalExpenseCategory || historicalParentCategory;
  const cumulativeData = insightPeriodData.reduce<
    Array<
      (typeof insightPeriodData)[number] & {
        cumulativeSalary: number | null;
        cumulativeExpenses: number | null;
      }
    >
  >((data, period) => {
    const previous = data.at(-1);
    data.push({
      ...period,
      cumulativeSalary:
        (previous?.cumulativeSalary ?? 0) + (period.chartIncome ?? 0),
      cumulativeExpenses:
        (previous?.cumulativeExpenses ?? 0) + (period.expenses ?? 0),
    });
    return data;
  }, []);
  const filteredTotalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const daysInSelection = hasValidRange
    ? selectedDays(insightRangeStart, insightRangeEnd, selectedMonth)
    : 0;

  return (
    <div className="space-y-10">
      <ReportFilters
        currencies={Object.keys(reports)}
        selectedCurrency={displayCurrency}
        onCurrencyChange={setDisplayCurrency}
        startDate={startDate}
        endDate={endDate}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        minDate={firstPeriod}
        maxDate={`${currentYear}-12-31`}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onRangeSelect={selectRange}
      />
      <section
        className="border-b border-zinc-300 pb-6"
        aria-label="Monthly cashflow"
      >
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
                content={<ChartTooltip currency={displayCurrency} />}
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
                dataKey="income"
                name="INCOME"
                stroke="#15803d"
                strokeWidth={3}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="salary"
                name="SALARY"
                stroke="#1d4ed8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section aria-label="Cashflow summary">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-zinc-700">
            Year
            <select
              className="ml-2 border border-zinc-300 bg-white px-2 py-1"
              value={selectedSummaryYear}
              onChange={(event) => setSelectedSummaryYear(event.target.value)}
            >
              {summaryYears.map((year) => <option key={year}>{year}</option>)}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto border border-zinc-300 bg-white">
          <table className="w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-[16%]" />
            {summaryPeriods.map((period) => (
              <col key={period.period} />
            ))}
            <col />
            <col />
          </colgroup>
          <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border border-zinc-300 px-2 py-1">Cashflow</th>
              {summaryPeriods.map((period) => (
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
                colSpan={summaryPeriods.length + 3}
                className="border border-zinc-300 px-2 py-1"
              >
                Income
              </th>
            </tr>
            {summaryReport.incomeCategories.map((category) => (
              <tr key={category}>
                <th
                  scope="row"
                  className="border border-zinc-300 px-2 py-1 text-left font-medium text-black"
                >
                  {category}
                </th>
                {summaryPeriods.map((period) => (
                  <td
                    key={period.period}
                    className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                  >
                    {formatMoney(period.incomeCategories[category])}
                  </td>
                ))}
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    summaryPeriods.reduce(
                      (total, period) =>
                        total + (period.incomeCategories[category] ?? 0),
                      0,
                    ),
                  )}
                </td>
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    monthlyAverage(
                      summaryAveragePeriods.map(
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
              {summaryPeriods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(period.income)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(summaryTotalIncome)}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(summaryAveragePeriods.map((period) => period.income)),
                )}
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <th
                colSpan={summaryPeriods.length + 3}
                className="border border-zinc-300 px-2 py-1"
              >
                Expenses
              </th>
            </tr>
            {summaryReport.parentCategories.map((category) => (
              <tr key={category}>
                <th
                  scope="row"
                  className="border border-zinc-300 px-2 py-1 text-left font-medium text-black"
                >
                  {category}
                </th>
                {summaryPeriods.map((period) => (
                  <td
                    key={period.period}
                    className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                  >
                    {formatMoney(period.categories[category])}
                  </td>
                ))}
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    summaryPeriods.reduce(
                      (total, period) =>
                        total + (period.categories[category] ?? 0),
                      0,
                    ),
                  )}
                </td>
                <td className="border border-zinc-300 px-2 py-1 text-right font-semibold tabular-nums">
                  {formatMoney(
                    monthlyAverage(
                      summaryAveragePeriods.map(
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
              {summaryPeriods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(expensesExcluding(period, ["rent"]))}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  summaryPeriods.reduce(
                    (total, period) =>
                      total + (expensesExcluding(period, ["rent"]) ?? 0),
                    0,
                  ),
                )}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    summaryAveragePeriods.map((period) =>
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
              {summaryPeriods.map((period) => (
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
                  summaryPeriods.reduce(
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
                    summaryAveragePeriods.map((period) =>
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
              {summaryPeriods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(period.expenses)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(summaryTotalExpenses)}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    summaryAveragePeriods.map((period) => period.expenses),
                  ),
                )}
              </td>
            </tr>
          </tbody>
          <tbody>
            <tr className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <th
                colSpan={summaryPeriods.length + 3}
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
              {summaryPeriods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatMoney(period.savings)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(summaryTotalSavings)}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatMoney(
                  monthlyAverage(
                    summaryAveragePeriods.map((period) => period.savings),
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
              {summaryPeriods.map((period) => (
                <td
                  key={period.period}
                  className="border border-zinc-300 px-2 py-1 text-right tabular-nums"
                >
                  {formatPercent(period.savingsRate)}
                </td>
              ))}
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatPercent(
                  summaryTotalIncome === 0
                    ? null
                    : summaryTotalSavings / summaryTotalIncome,
                )}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-right tabular-nums">
                {formatPercent(
                  averageRate(
                    summaryAveragePeriods.map((period) => period.savingsRate),
                  ),
                )}
              </td>
            </tr>
          </tbody>
        </table>
          {summaryReport.unclassifiedExpenses > 0 && (
            <p className="border-t border-zinc-300 px-3 py-2 text-sm text-zinc-600">
              Unclassified expenses: {formatMoney(summaryReport.unclassifiedExpenses)}{" "}
              {currency}
            </p>
          )}
        </div>
      </section>

      <section
        className="space-y-8 pt-0"
        aria-labelledby="expense-insights-heading"
      >
        <h2 id="expense-insights-heading" className="mb-5 text-xl font-medium tracking-tight text-black">
          <span className="sr-only">Expense insights</span>
        </h2>
        <div className="grid items-end gap-3 border border-zinc-300 bg-zinc-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
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
                {monthOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="relative self-end">
              <button
                type="button"
                className="w-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium"
                aria-expanded={openCategoryMenu === "parent"}
                aria-controls={openCategoryMenu === "parent" ? `${categoryMenuId}-parent` : undefined}
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
                <div id={`${categoryMenuId}-parent`} className="absolute z-10 mt-1 w-80 border border-zinc-300 bg-white p-3 shadow-lg">
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
                aria-expanded={openCategoryMenu === "category"}
                aria-controls={openCategoryMenu === "category" ? `${categoryMenuId}-category` : undefined}
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
                <div id={`${categoryMenuId}-category`} className="absolute z-10 mt-1 w-80 border border-zinc-300 bg-white p-3 shadow-lg">
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">
              Click a category in the legend to hide/show it. Filters are applied
              before this view.
            </p>
            <div className="flex border border-zinc-300" role="group" aria-label="Expense chart grouping">
              {(["category", "parent"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  aria-pressed={expenseAggregation === level}
                  onClick={() => {
                    setExpenseAggregation(level);
                    setHiddenExpenseCategories(new Set());
                  }}
                  className={`px-3 py-1 text-sm font-medium ${expenseAggregation === level ? "bg-black text-white" : "bg-white text-zinc-700"}`}
                >
                  {level === "category" ? "Category" : "Parent category"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <AreaChart
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
                  content={
                    <ChartTooltip
                      currency={insightCurrency}
                      hideZeroValues
                    />
                  }
                  cursor={{ fill: "#f4f4f5" }}
                  wrapperStyle={{ zIndex: 10 }}
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
                {expenseSeries.map(({ name, dataKey }, index) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={dataKey}
                    name={name}
                    stackId="expenses"
                    hide={hiddenExpenseCategories.has(name)}
                    stroke={categoryColors[index % categoryColors.length]}
                    fill={categoryColors[index % categoryColors.length]}
                    fillOpacity={0.72}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
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
                data={insightPeriodData}
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
                  content={<ChartTooltip currency={insightCurrency} showSavingsRate />}
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
                  Daily expense average over the selected moving window.
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
              <ResponsiveContainer minHeight={320}>
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
                      dataKey={(period: (typeof movingAverageData)[number]) =>
                        period.categories[category] ?? null
                      }
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

        <section aria-labelledby="cumulative-cashflow-heading">
          <SectionHeading id="cumulative-cashflow-heading" title="Cumulative cashflow" />
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
                  content={<ChartTooltip currency={insightCurrency} />}
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
        </section>
      </section>

      <section className="border-t border-zinc-300 pt-8" aria-label="Historical expenses">
        <SectionHeading title="Historical expenses" />
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-zinc-700">
            Category
            <select
              className="ml-2 border border-zinc-300 bg-white px-2 py-1"
              value={historicalExpenseCategory}
              onChange={(event) => {
                setHistoricalExpenseCategory(event.target.value);
                setHistoricalParentCategory("");
              }}
            >
              <option value="">Select a category</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            Parent category
            <select
              className="ml-2 border border-zinc-300 bg-white px-2 py-1"
              value={historicalParentCategory}
              onChange={(event) => {
                setHistoricalParentCategory(event.target.value);
                setHistoricalExpenseCategory("");
              }}
            >
              <option value="">Select a parent category</option>
              {parentOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium aria-pressed:bg-zinc-100"
            aria-pressed={showHistoricalSalary}
            onClick={() => setShowHistoricalSalary((show) => !show)}
          >
            {showHistoricalSalary ? "Hide salary" : "Show salary"}
          </button>
        </div>
        {historicalExpenseLabel ? (
          <div className="h-80 w-full">
            <ResponsiveContainer>
              <LineChart
                data={historicalExpenseData}
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
                <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name={historicalExpenseLabel}
                  stroke="#b91c1c"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                {showHistoricalSalary && (
                  <Line
                    type="monotone"
                    dataKey="salary"
                    name="Salary"
                    stroke="#15803d"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Select a category or parent category to view its complete expense history.
          </p>
        )}
      </section>
    </div>
  );
}
