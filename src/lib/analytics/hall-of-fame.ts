import { monthStarts } from "@/lib/dates";
import type { ConvertedCashflowTransaction } from "@/types/workbook";
import { isSalary } from "./cashflow";
import type { NetWorthReport } from "./net-worth";

const CURRENCIES = ["CHF", "EUR"] as const;
type Currency = (typeof CURRENCIES)[number];
type MetricValue = number | null;

type HallOfFameEntry = {
  month: string;
  value: number;
};

export type HallOfFameMetric = {
  id: string;
  title: string;
  description: string;
  calculation: string;
  format: "money" | "percent";
  topTen: HallOfFameEntry[];
  currentMonth: string;
  currentValue: MetricValue;
  currentIsRanked: boolean;
};

type MonthlyValues = {
  income: Record<Currency, number>;
  salary: Record<Currency, number>;
  expensesCHF: number;
  savingsCHF: number;
  savingsRate: number | null;
  netWorthDelta: Record<Currency, number | null>;
};

const metricDefinitions = [
  {
    id: "income-chf",
    title: "Best income · CHF",
    description: "Months with the highest recorded income, including investment withdrawals and excluding portfolio contributions.",
    calculation: "Sum of income transactions in CHF for the month.",
    format: "money",
    value: (month: MonthlyValues) => month.income.CHF,
    direction: "desc",
  },
  {
    id: "income-eur",
    title: "Best income · EUR",
    description: "Months with the highest recorded income, including investment withdrawals and excluding portfolio contributions.",
    calculation: "Sum of income transactions converted to EUR at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.income.EUR,
    direction: "desc",
  },
  {
    id: "salary-chf",
    title: "Best salary · CHF",
    description: "Months with the highest recorded salary income.",
    calculation: "Sum of income transactions categorized as salary, converted to CHF at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.salary.CHF,
    direction: "desc",
  },
  {
    id: "salary-eur",
    title: "Best salary · EUR",
    description: "Months with the highest recorded salary income.",
    calculation: "Sum of income transactions categorized as salary, converted to EUR at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.salary.EUR,
    direction: "desc",
  },
  {
    id: "net-worth-delta-chf",
    title: "Best net-worth change · CHF",
    description: "Months with the largest increase in total net worth.",
    calculation: "Total net worth in CHF minus the previous reported month's total.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDelta.CHF,
    direction: "desc",
  },
  {
    id: "net-worth-delta-eur",
    title: "Best net-worth change · EUR",
    description: "Months with the largest increase in total net worth.",
    calculation: "Total net worth in EUR minus the previous reported month's total.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDelta.EUR,
    direction: "desc",
  },
  {
    id: "worst-net-worth-delta-chf",
    title: "Worst net-worth change · CHF",
    description: "Months with the largest decrease in total net worth.",
    calculation: "Total net worth in CHF minus the previous reported month's total; lowest values rank first.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDelta.CHF,
    direction: "asc",
  },
  {
    id: "worst-net-worth-delta-eur",
    title: "Worst net-worth change · EUR",
    description: "Months with the largest decrease in total net worth.",
    calculation: "Total net worth in EUR minus the previous reported month's total; lowest values rank first.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDelta.EUR,
    direction: "asc",
  },
  {
    id: "expenses-chf",
    title: "Highest expenses · CHF",
    description: "Months with the highest recorded expenses.",
    calculation: "Sum of expense transactions converted to CHF at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.expensesCHF,
    direction: "desc",
  },
  {
    id: "lowest-expenses-chf",
    title: "Lowest expenses · CHF",
    description: "Months with the lowest recorded expenses.",
    calculation: "Sum of expense transactions converted to CHF at each transaction's historical FX rate; lowest values rank first.",
    format: "money",
    value: (month: MonthlyValues) => month.expensesCHF,
    direction: "asc",
  },
  {
    id: "savings-chf",
    title: "Best savings · CHF",
    description: "Months with the highest cashflow savings.",
    calculation: "Monthly income minus monthly expenses, converted to CHF using historical transaction-date FX rates.",
    format: "money",
    value: (month: MonthlyValues) => month.savingsCHF,
    direction: "desc",
  },
  {
    id: "savings-rate",
    title: "Savings rate",
    description: "Months with the highest share of income left after expenses.",
    calculation: "(Monthly income − monthly expenses) ÷ monthly income; omitted when income is zero.",
    format: "percent",
    value: (month: MonthlyValues) => month.savingsRate,
    direction: "desc",
  },
] as const;

function monthOf(date: string) {
  return date.slice(0, 7);
}

function emptyMonth(): MonthlyValues {
  return {
    income: { CHF: 0, EUR: 0 },
    salary: { CHF: 0, EUR: 0 },
    expensesCHF: 0,
    savingsCHF: 0,
    savingsRate: null,
    netWorthDelta: { CHF: null, EUR: null },
  };
}

function totalsFor(report: NetWorthReport, currency: Currency) {
  const index = report.currencies.indexOf(currency);
  return index < 0 ? [] : report.totals[index] ?? [];
}

/**
 * Top-ten monthly rankings of income, salary, expenses, savings and net-worth change, plus the current month's value.
 * Transactions must already be converted to each currency at their own historical FX rate.
 */
export function buildHallOfFame(
  report: NetWorthReport,
  transactionsByCurrency: Record<Currency, ConvertedCashflowTransaction[]>,
  currentDate: string,
): HallOfFameMetric[] {
  const currentMonth = monthOf(currentDate);
  const dates = [...report.periods, ...transactionsByCurrency.CHF.map((item) => item.date)];
  const firstMonth = dates.map(monthOf).sort()[0] ?? currentMonth;
  const months = monthStarts(`${firstMonth}-01`, `${currentMonth}-01`).map(monthOf);
  const values = new Map(months.map((month) => [month, emptyMonth()]));

  for (const currency of CURRENCIES) {
    for (const transaction of transactionsByCurrency[currency]) {
      const month = values.get(monthOf(transaction.date));
      if (!month) continue;

      if (transaction.type === "income") {
        month.income[currency] += transaction.amount;
        if (isSalary(transaction)) month.salary[currency] += transaction.amount;
      } else if (transaction.type === "expense" && currency === "CHF") {
        month.expensesCHF += transaction.amount;
      }
    }
  }

  // Net-worth change compares consecutive reported months; the latest reading of a month wins.
  const totalsByCurrency = Object.fromEntries(CURRENCIES.map((currency) => [currency, totalsFor(report, currency)])) as Record<Currency, Array<number | null>>;
  const reportedMonths = new Map<string, Record<Currency, number | null>>();
  report.periods.forEach((period, index) => {
    reportedMonths.set(monthOf(period), {
      CHF: totalsByCurrency.CHF[index] ?? null,
      EUR: totalsByCurrency.EUR[index] ?? null,
    });
  });
  const reported = [...reportedMonths.entries()];
  for (let index = 1; index < reported.length; index += 1) {
    const [monthName, currentTotals] = reported[index];
    const month = values.get(monthName);
    if (!month) continue;
    const previousTotals = reported[index - 1][1];
    for (const currency of CURRENCIES) {
      month.netWorthDelta[currency] = previousTotals[currency] === null || currentTotals[currency] === null
        ? null
        : currentTotals[currency]! - previousTotals[currency]!;
    }
  }

  for (const month of values.values()) {
    month.savingsCHF = month.income.CHF - month.expensesCHF;
    month.savingsRate = month.income.CHF === 0 ? null : month.savingsCHF / month.income.CHF;
  }

  return metricDefinitions.map((definition) => {
    const ranked = [...values.entries()]
      .map(([month, monthlyValues]) => ({ month, value: definition.value(monthlyValues) }))
      .filter((entry): entry is HallOfFameEntry => entry.value !== null && Number.isFinite(entry.value))
      .sort((left, right) => {
        const difference = definition.direction === "desc"
          ? right.value - left.value
          : left.value - right.value;
        return difference || left.month.localeCompare(right.month);
      })
      .slice(0, 10);

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      calculation: definition.calculation,
      format: definition.format,
      topTen: ranked,
      currentMonth,
      currentValue: definition.value(values.get(currentMonth) ?? emptyMonth()),
      currentIsRanked: ranked.some((entry) => entry.month === currentMonth),
    };
  });
}
