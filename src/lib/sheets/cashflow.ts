import type { CashflowCategory, CashflowTransaction, CashflowType, CashflowWorkbook } from "@/types/workbook";
import { readSheetValues, type SheetRows } from "./client";
import {
  cellText,
  hasHeaders,
  isCurrencyCode,
  normalizeCurrency,
  normalizeHeaders,
  parseConstants,
  parseSheetDate,
} from "./parse";

export const CASHFLOW_HEADERS = ["date", "type", "name", "amount", "currency", "category", "subcategory", "notes"];
export const CATEGORY_HEADERS = ["category", "parent_category", "is_essential", "is_recurring"];
export const CASHFLOW_TYPES = ["income", "expense", "contribution"];

type CashflowTabs = {
  cashflowRows: SheetRows;
  categoryRows: SheetRows;
  constantRows: SheetRows;
};

// Classification flags are the boolean TRUE or blank; FALSE and text are rejected.
function isFlag(value: unknown) {
  return value === "" || value === undefined || value === true;
}

function parseCategories(rows: SheetRows) {
  const names = new Set<string>();
  return rows.map(([category, parentCategory, isEssential, isRecurring]): CashflowCategory => {
    const name = cellText(category);
    const parent = cellText(parentCategory);
    if (!name || !parent) {
      throw new Error("The categories tab contains an incomplete category.");
    }
    if (names.has(name)) {
      throw new Error(`The categories tab contains a duplicate category: ${name}.`);
    }
    if (!isFlag(isEssential) || !isFlag(isRecurring)) {
      throw new Error("The categories tab requires boolean TRUE or blank classification values.");
    }
    names.add(name);
    return { category: name, parentCategory: parent, isEssential: isEssential === true, isRecurring: isRecurring === true };
  });
}

function parseTransactions(rows: SheetRows, categoryNames: Set<string>) {
  return rows.map((row, index): CashflowTransaction => {
    const [rawDate, rawType, , rawAmount, rawCurrency, rawCategory] = row;
    const rowNumber = index + 2;
    const type = cellText(rawType).toLowerCase();
    const amount = Number(rawAmount);
    const currency = normalizeCurrency(rawCurrency);
    const category = cellText(rawCategory) || null;

    if (!CASHFLOW_TYPES.includes(type)) {
      throw new Error(`The cashflow tab contains an invalid type on row ${rowNumber}.`);
    }
    if (!Number.isFinite(amount) || amount < 0 || !isCurrencyCode(currency)) {
      throw new Error(`The cashflow tab contains an invalid transaction on row ${rowNumber}.`);
    }
    if (category && !categoryNames.has(category)) {
      throw new Error(`The cashflow tab contains an unknown category on row ${rowNumber}: ${category}.`);
    }

    return {
      date: parseSheetDate(rawDate, "The cashflow tab contains an invalid date."),
      type: type as CashflowType,
      amount,
      currency,
      category,
    };
  });
}

/** Reporting currencies are `CURRENCY_1..3` from `costants`: valid codes only, unique, in order. */
function parseReportingCurrencies(constantRows: SheetRows) {
  const constants = parseConstants(constantRows);
  const currencies = ["CURRENCY_1", "CURRENCY_2", "CURRENCY_3"]
    .map((key) => constants.get(key))
    .filter((currency): currency is string => currency !== undefined && isCurrencyCode(currency));
  if (currencies.length === 0) {
    throw new Error("Set CURRENCY_1 in the costants tab.");
  }
  return [...new Set(currencies)];
}

/** Validates and normalises the raw `cashflow`, `categories` and `costants` tabs. */
export function parseCashflowWorkbook({ cashflowRows, categoryRows, constantRows }: CashflowTabs): CashflowWorkbook {
  const [cashflowHeaders = [], ...transactionRows] = cashflowRows;
  const [categoryHeaders = [], ...categoryDataRows] = categoryRows;
  // `CITY` is the legacy name of the seventh column.
  const actualCashflowHeaders = normalizeHeaders(cashflowHeaders).map((header, index) =>
    index === 6 && header === "city" ? "subcategory" : header,
  );

  if (!hasHeaders(actualCashflowHeaders, CASHFLOW_HEADERS)) {
    throw new Error("The cashflow tab has invalid headers.");
  }
  if (!hasHeaders(normalizeHeaders(categoryHeaders), CATEGORY_HEADERS)) {
    throw new Error("The categories tab has invalid headers.");
  }

  const categories = parseCategories(categoryDataRows);
  const transactions = parseTransactions(transactionRows, new Set(categories.map(({ category }) => category)));
  return { transactions, categories, reportingCurrencies: parseReportingCurrencies(constantRows) };
}

export async function loadCashflowWorkbook(): Promise<CashflowWorkbook> {
  const [cashflowRows, categoryRows, constantRows] = await readSheetValues("cashflow!A:H", "categories!A:D", "costants!A:B");
  return parseCashflowWorkbook({ cashflowRows, categoryRows, constantRows });
}
