"use client";

import { useState } from "react";
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
import type { CashflowPeriod, CashflowReport } from "@/lib/analytics/cashflow";

type CashflowDashboardProps = {
  report: CashflowReport;
  currency: string;
};

const categoryColors = ["#1d4ed8", "#7c3aed", "#c2410c", "#0f766e", "#a21caf", "#92400e", "#4f46e5", "#047857"];

function formatMoney(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function formatMonth(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
  return `${month}-${String(date.getUTCFullYear()).slice(-2)}`;
}

function formatPercent(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 }).format(value);
}

function axisValue(value: number) {
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

function monthlyAverage(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0) / values.length;
}

function averageRate(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length === 0 ? null : available.reduce((total, value) => total + value, 0) / available.length;
}

function expensesExcluding(period: CashflowPeriod, excludedCategories: string[]) {
  if (period.expenses === null) return null;

  const excluded = new Set(excludedCategories.map((category) => category.toLowerCase()));
  const excludedExpenses = Object.entries(period.expenseCategories).reduce(
    (total, [category, amount]) => total + (excluded.has(category.toLowerCase()) ? (amount ?? 0) : 0),
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
  const periods = new Map(report.periods.map((period) => [period.period, period]));

  return Array.from({ length: 12 }, (_, index) => {
    const period = `${year}-${String(index + 1).padStart(2, "0")}-01`;
    const source = periods.get(period);
    const visible = period <= cutoff;

    return {
      period,
      label: formatMonth(period),
      income: visible ? source?.income ?? null : null,
      chartIncome: visible ? source?.chartIncome ?? null : null,
      expenses: visible ? source?.expenses ?? null : null,
      savingsRate: visible ? source?.savingsRate ?? null : null,
      categories: visible ? source?.categories ?? {} : {},
      expensesExcludingRent: visible && source ? expensesExcluding(source, ["rent"]) : null,
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
  payload?: Array<{ dataKey?: string; name?: string; value?: number | null; payload?: CashflowPeriod }>;
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
          <p className="text-emerald-700">Income: {formatMoney(period.income)} {currency}</p>
          <p className="text-red-700">Expenses: {formatMoney(period.expenses)} {currency}</p>
        </>
      ) : payload.map((entry) => (
        <p key={entry.dataKey} className="text-zinc-700">
          {entry.name}: {formatMoney(entry.value ?? null)} {currency}
        </p>
      ))}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="mb-5 text-xl font-medium tracking-tight text-black">{title}</h2>;
}

export function CashflowDashboard({ report, currency }: CashflowDashboardProps) {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(() => new Set());
  const currentPeriod = report.periods.filter((period) => period.period <= previousMonth()).at(-1);
  const averagePeriods = report.periods.filter((period) => period.period <= previousMonth());
  const cutoff = previousMonth();
  const periodData = reportingYearMonths(report, cutoff);
  const yearData = periodData.map((period, index) => {
    if (period.period > cutoff) {
      return { ...period, cumulativeSalary: null, cumulativeExpenses: null };
    }

    const periodsThroughCurrent = periodData.slice(0, index + 1);
    return {
      ...period,
      cumulativeSalary: periodsThroughCurrent.reduce((total, entry) => total + (entry.chartIncome ?? 0), 0),
      cumulativeExpenses: periodsThroughCurrent.reduce((total, entry) => total + (entry.expenses ?? 0), 0),
    };
  });

  return (
    <div className="space-y-10">
      <section className="border-b border-zinc-300 pb-8" aria-labelledby="monthly-cashflow-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading title="Monthly cashflow" />
          {currentPeriod && (
            <div className="grid grid-cols-3 gap-5 text-right text-xs tabular-nums">
              <div><p className="text-zinc-600">Income</p><p className="mt-1 font-semibold text-emerald-700">{formatMoney(currentPeriod.income)}</p></div>
              <div><p className="text-zinc-600">Expenses</p><p className="mt-1 font-semibold text-red-700">{formatMoney(currentPeriod.expenses)}</p></div>
              <div><p className="text-zinc-600">Savings rate</p><p className="mt-1 font-semibold text-black">{formatPercent(currentPeriod.savingsRate)}</p></div>
            </div>
          )}
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={periodData} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#d4d4d4" vertical={false} />
              <XAxis dataKey="label" axisLine={{ stroke: "#171717" }} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} tickFormatter={axisValue} width={54} />
              <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "#171717", strokeDasharray: "3 3" }} />
              <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="expenses" name="EXPENSES" stroke="#b91c1c" strokeWidth={3} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="expensesExcludingRent" name="EXPENSES (NO RENT)" stroke="#b91c1c" strokeOpacity={0.35} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="chartIncome" name="INCOME" stroke="#15803d" strokeWidth={3} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="space-y-4">
      <section aria-label="Income">
        <div className="overflow-x-auto border border-zinc-300 bg-white">
          <table className="w-full min-w-225 table-fixed border-collapse text-xs">
            <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="w-[16%] border border-zinc-300 px-2 py-1.5">Income</th>
                {report.periods.map((period) => <th key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right">{formatMonth(period.period)}</th>)}
                <th className="border border-zinc-300 px-2 py-1.5 text-right">Total</th>
                <th className="border border-zinc-300 px-2 py-1.5 text-right">Monthly avg</th>
              </tr>
            </thead>
            <tbody>
              {report.incomeCategories.map((category) => (
                <tr key={category}>
                  <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left font-medium text-black">{category}</th>
                  {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(period.incomeCategories[category])}</td>)}
                  <td className="border border-zinc-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(report.periods.reduce((total, period) => total + (period.incomeCategories[category] ?? 0), 0))}</td>
                  <td className="border border-zinc-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => period.incomeCategories[category])))}</td>
                </tr>
              ))}
              <tr className="bg-zinc-50 font-semibold">
                <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left">Total income</th>
                {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(period.income)}</td>)}
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(report.totalIncome)}</td>
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => period.income)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Expenses by parent category">
        <div className="overflow-x-auto border border-zinc-300 bg-white">
          <table className="w-full min-w-225 table-fixed border-collapse text-xs">
            <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="w-[16%] border border-zinc-300 px-2 py-1.5">Expenses</th>
                {report.periods.map((period) => <th key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right">{formatMonth(period.period)}</th>)}
                <th className="border border-zinc-300 px-2 py-1.5 text-right">Total</th>
                <th className="border border-zinc-300 px-2 py-1.5 text-right">Monthly avg</th>
              </tr>
            </thead>
            <tbody>
              {report.parentCategories.map((category) => (
                <tr key={category}>
                  <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left font-medium text-black">{category}</th>
                  {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(period.categories[category])}</td>)}
                  <td className="border border-zinc-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(report.periods.reduce((total, period) => total + (period.categories[category] ?? 0), 0))}</td>
                  <td className="border border-zinc-300 px-2 py-1.5 text-right font-semibold tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => period.categories[category])))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left">Expense excluding rent</th>
                {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(expensesExcluding(period, ["rent"]))}</td>)}
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(report.periods.reduce((total, period) => total + (expensesExcluding(period, ["rent"]) ?? 0), 0))}</td>
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => expensesExcluding(period, ["rent"]))))}</td>
              </tr>
              <tr className="font-semibold">
                <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left">Expense excluding rent and health insurance</th>
                {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(expensesExcluding(period, ["rent", "health insurance"]))}</td>)}
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(report.periods.reduce((total, period) => total + (expensesExcluding(period, ["rent", "health insurance"]) ?? 0), 0))}</td>
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => expensesExcluding(period, ["rent", "health insurance"]))))}</td>
              </tr>
              <tr className="bg-zinc-50 font-semibold">
                <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left">Expenses</th>
                {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(period.expenses)}</td>)}
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(report.totalExpenses)}</td>
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => period.expenses)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {report.unclassifiedExpenses > 0 && <p className="mt-3 text-sm text-zinc-600">Unclassified expenses: {formatMoney(report.unclassifiedExpenses)} {currency}</p>}
      </section>

      <section aria-label="Savings">
        <div className="overflow-x-auto border border-zinc-300 bg-white">
          <table className="w-full min-w-225 table-fixed border-collapse text-xs">
            <thead className="bg-zinc-100 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="w-[16%] border border-zinc-300 px-2 py-1.5">Savings</th>
                {report.periods.map((period) => <th key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right">{formatMonth(period.period)}</th>)}
                <th className="border border-zinc-300 px-2 py-1.5 text-right">Total</th>
                <th className="border border-zinc-300 px-2 py-1.5 text-right">Monthly avg</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left">Savings</th>
                {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(period.savings)}</td>)}
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(report.totalSavings)}</td>
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatMoney(monthlyAverage(averagePeriods.map((period) => period.savings)))}</td>
              </tr>
              <tr className="font-semibold">
                <th scope="row" className="border border-zinc-300 px-2 py-1.5 text-left">Savings rate</th>
                {report.periods.map((period) => <td key={period.period} className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatPercent(period.savingsRate)}</td>)}
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatPercent(report.totalIncome === 0 ? null : report.totalSavings / report.totalIncome)}</td>
                <td className="border border-zinc-300 px-2 py-1.5 text-right tabular-nums">{formatPercent(averageRate(averagePeriods.map((period) => period.savingsRate)))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      </div>

      <section className="border-b border-zinc-300 pb-8" aria-labelledby="expense-composition-heading">
        <SectionHeading title="Expense composition" />
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <AreaChart data={periodData} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="#d4d4d4" vertical={false} />
              <XAxis dataKey="label" axisLine={{ stroke: "#171717" }} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} tickFormatter={axisValue} width={54} />
              <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "#171717", strokeDasharray: "3 3" }} />
              <Legend
                iconType="square"
                wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                onClick={(entry) => {
                  const category = String(entry.value);
                  setHiddenCategories((categories) => {
                    const nextCategories = new Set(categories);
                    if (nextCategories.has(category)) nextCategories.delete(category);
                    else nextCategories.add(category);
                    return nextCategories;
                  });
                }}
              />
              {report.parentCategories.map((category, index) => <Area key={category} type="monotone" dataKey={`categories.${category}`} name={category} stackId="expenses" hide={hiddenCategories.has(category)} stroke={categoryColors[index % categoryColors.length]} fill={categoryColors[index % categoryColors.length]} fillOpacity={0.72} isAnimationActive={false} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div aria-labelledby="savings-rate-heading">
          <SectionHeading title="Savings rate" />
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={periodData} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#d4d4d4" vertical={false} />
                <XAxis dataKey="label" axisLine={{ stroke: "#171717" }} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} tickFormatter={(value) => `${Math.round(value * 100)}%`} width={46} />
                <Tooltip content={<ChartTooltip currency={currency} showSavingsRate />} cursor={{ stroke: "#171717", strokeDasharray: "3 3" }} />
                <Line type="monotone" dataKey="savingsRate" name="Savings rate" stroke="#171717" strokeWidth={2} dot={{ r: 2, fill: "#ffffff", stroke: "#171717" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div aria-labelledby="cumulative-cashflow-heading">
          <SectionHeading title="Cumulative cashflow" />
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={yearData} margin={{ top: 12, right: 18, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="#d4d4d4" vertical={false} />
                <XAxis dataKey="label" axisLine={{ stroke: "#171717" }} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#525252", fontSize: 11 }} tickFormatter={axisValue} width={54} />
                <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: "#171717", strokeDasharray: "3 3" }} />
                <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="cumulativeSalary" name="Salary" stroke="#15803d" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="cumulativeExpenses" name="Expenses" stroke="#b91c1c" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
