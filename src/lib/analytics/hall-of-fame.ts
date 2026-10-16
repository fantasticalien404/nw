import type { ConvertedCashflowTransaction } from "@/lib/market-data/cashflow";
import type { NetWorthReport } from "./net-worth";

type Currency = "CHF" | "EUR";
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
  incomeCHF: number;
  incomeEUR: number;
  salaryCHF: number;
  salaryEUR: number;
  expensesCHF: number;
  savingsCHF: number;
  savingsRate: number | null;
  netWorthDeltaCHF: number | null;
  netWorthDeltaEUR: number | null;
};

const metricDefinitions = [
  {
    id: "income-chf",
    title: "Best income · CHF",
    description: "Months with the highest recorded income, including investment withdrawals and excluding portfolio contributions.",
    calculation: "Sum of income transactions in CHF for the month.",
    format: "money",
    value: (month: MonthlyValues) => month.incomeCHF,
    direction: "desc",
  },
  {
    id: "income-eur",
    title: "Best income · EUR",
    description: "Months with the highest recorded income, including investment withdrawals and excluding portfolio contributions.",
    calculation: "Sum of income transactions converted to EUR at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.incomeEUR,
    direction: "desc",
  },
  {
    id: "salary-chf",
    title: "Best salary · CHF",
    description: "Months with the highest recorded salary income.",
    calculation: "Sum of income transactions categorized as salary, converted to CHF at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.salaryCHF,
    direction: "desc",
  },
  {
    id: "salary-eur",
    title: "Best salary · EUR",
    description: "Months with the highest recorded salary income.",
    calculation: "Sum of income transactions categorized as salary, converted to EUR at each transaction's historical FX rate.",
    format: "money",
    value: (month: MonthlyValues) => month.salaryEUR,
    direction: "desc",
  },
  {
    id: "net-worth-delta-chf",
    title: "Best net-worth change · CHF",
    description: "Months with the largest increase in total net worth.",
    calculation: "Total net worth in CHF minus the previous reported month's total.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDeltaCHF,
    direction: "desc",
  },
  {
    id: "net-worth-delta-eur",
    title: "Best net-worth change · EUR",
    description: "Months with the largest increase in total net worth.",
    calculation: "Total net worth in EUR minus the previous reported month's total.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDeltaEUR,
    direction: "desc",
  },
  {
    id: "worst-net-worth-delta-chf",
    title: "Worst net-worth change · CHF",
    description: "Months with the largest decrease in total net worth.",
    calculation: "Total net worth in CHF minus the previous reported month's total; lowest values rank first.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDeltaCHF,
    direction: "asc",
  },
  {
    id: "worst-net-worth-delta-eur",
    title: "Worst net-worth change · EUR",
    description: "Months with the largest decrease in total net worth.",
    calculation: "Total net worth in EUR minus the previous reported month's total; lowest values rank first.",
    format: "money",
    value: (month: MonthlyValues) => month.netWorthDeltaEUR,
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

function monthsBetween(start: string, end: string) {
  const months: string[] = [];
  const current = new Date(`${start}-01T00:00:00Z`);
  const final = new Date(`${end}-01T00:00:00Z`);

  while (current <= final) {
    months.push(current.toISOString().slice(0, 7));
    current.setUTCMonth(current.getUTCMonth() + 1);
  }

  return months;
}

function emptyMonth(): MonthlyValues {
  return {
    incomeCHF: 0,
    incomeEUR: 0,
    salaryCHF: 0,
    salaryEUR: 0,
    expensesCHF: 0,
    savingsCHF: 0,
    savingsRate: null,
    netWorthDeltaCHF: null,
    netWorthDeltaEUR: null,
  };
}

function totalsFor(report: NetWorthReport, currency: Currency) {
  const index = report.currencies.indexOf(currency);
  return index < 0 ? [] : report.totals[index] ?? [];
}

export function buildHallOfFame(
  report: NetWorthReport,
  transactionsByCurrency: Record<Currency, ConvertedCashflowTransaction[]>,
  currentDate: string,
): HallOfFameMetric[] {
  const currentMonth = monthOf(currentDate);
  const dates = [...report.periods, ...transactionsByCurrency.CHF.map((item) => item.date)];
  const firstMonth = dates.map(monthOf).sort()[0] ?? currentMonth;
  const months = monthsBetween(firstMonth, currentMonth);
  const values = new Map(months.map((month) => [month, emptyMonth()]));

  for (const currency of ["CHF", "EUR"] as const) {
    for (const transaction of transactionsByCurrency[currency]) {
      const month = values.get(monthOf(transaction.date));
      if (!month) continue;

      if (transaction.type === "income") {
        month[currency === "CHF" ? "incomeCHF" : "incomeEUR"] += transaction.amount;
        if (transaction.category?.toLowerCase() === "salary") {
          month[currency === "CHF" ? "salaryCHF" : "salaryEUR"] += transaction.amount;
        }
      } else if (transaction.type === "expense" && currency === "CHF") {
        month.expensesCHF += transaction.amount;
      }
    }
  }

  const chfTotals = totalsFor(report, "CHF");
  const eurTotals = totalsFor(report, "EUR");
  const reportingMonthTotals = new Map<string, { chf: number | null; eur: number | null }>();
  report.periods.forEach((period, index) => {
    reportingMonthTotals.set(monthOf(period), {
      chf: chfTotals[index] ?? null,
      eur: eurTotals[index] ?? null,
    });
  });
  const reportedMonths = [...reportingMonthTotals.entries()];
  for (let index = 1; index < reportedMonths.length; index += 1) {
    const [monthName, currentTotals] = reportedMonths[index];
    const month = values.get(monthName);
    if (!month) continue;
    const previousTotals = reportedMonths[index - 1][1];
    month.netWorthDeltaCHF = previousTotals.chf === null || currentTotals.chf === null
      ? null
      : currentTotals.chf - previousTotals.chf;
    month.netWorthDeltaEUR = previousTotals.eur === null || currentTotals.eur === null
      ? null
      : currentTotals.eur - previousTotals.eur;
  }

  for (const month of values.values()) {
    month.savingsCHF = month.incomeCHF - month.expensesCHF;
    month.savingsRate = month.incomeCHF === 0 ? null : month.savingsCHF / month.incomeCHF;
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
    const currentValue = definition.value(values.get(currentMonth) ?? emptyMonth());

    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      calculation: definition.calculation,
      format: definition.format,
      topTen: ranked,
      currentMonth,
      currentValue,
      currentIsRanked: ranked.some((entry) => entry.month === currentMonth),
    };
  });
}
