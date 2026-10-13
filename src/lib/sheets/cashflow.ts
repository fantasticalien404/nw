import { getSheetsClient } from "@/lib/sheets/client";

export type CashflowType = "income" | "expense" | "contribution";

export type CashflowTransaction = {
  date: string;
  type: CashflowType;
  amount: number;
  currency: string;
  category: string | null;
};

export type CashflowCategory = {
  category: string;
  parentCategory: string;
  isEssential: boolean;
  isRecurring: boolean;
};

export type CashflowWorkbook = {
  transactions: CashflowTransaction[];
  categories: CashflowCategory[];
  reportingCurrencies: string[];
};

function toIsoDate(value: unknown) {
  const serial = Number(value);
  if (!Number.isFinite(serial)) {
    throw new Error("The cashflow tab contains an invalid date.");
  }

  return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
}

function normalizeCurrency(value: unknown) {
  const currency = String(value ?? "").trim().toUpperCase();
  return currency === "DOL" ? "USD" : currency;
}

export async function loadCashflowWorkbook(): Promise<CashflowWorkbook> {
  const { sheetId, sheets } = getSheetsClient();
  const [cashflowResponse, categoriesResponse, constantsResponse] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "cashflow!A:H",
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "categories!A:D",
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "costants!A:B",
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
  ]);
  const [cashflowHeaders = [], ...cashflowRows] = cashflowResponse.data.values ?? [];
  const [categoryHeaders = [], ...categoryRows] = categoriesResponse.data.values ?? [];
  const expectedCashflowHeaders = ["date", "type", "name", "amount", "currency", "category", "subcategory", "notes"];
  const actualCashflowHeaders = cashflowHeaders.map((value, index) => {
    const header = String(value).trim().toLowerCase();
    return index === 6 && header === "city" ? "subcategory" : header;
  });
  const expectedCategoryHeaders = ["category", "parent_category", "is_essential", "is_recurring"];
  const actualCategoryHeaders = categoryHeaders.map((value) => String(value).trim().toLowerCase());

  if (actualCashflowHeaders.join("|") !== expectedCashflowHeaders.join("|")) {
    throw new Error("The cashflow tab has invalid headers.");
  }
  if (actualCategoryHeaders.join("|") !== expectedCategoryHeaders.join("|")) {
    throw new Error("The categories tab has invalid headers.");
  }

  const categories: CashflowCategory[] = [];
  const categoryByName = new Map<string, CashflowCategory>();
  for (const [category, parentCategory, isEssential, isRecurring] of categoryRows) {
    const key = String(category ?? "").trim();
    const parent = String(parentCategory ?? "").trim();
    if (!key || !parent) {
      throw new Error("The categories tab contains an incomplete category.");
    }
    if (categoryByName.has(key)) {
      throw new Error(`The categories tab contains a duplicate category: ${key}.`);
    }
    if (!["", undefined, true].includes(isEssential) || !["", undefined, true].includes(isRecurring)) {
      throw new Error("The categories tab requires boolean TRUE or blank classification values.");
    }
    const definition = {
      category: key,
      parentCategory: parent,
      isEssential: isEssential === true,
      isRecurring: isRecurring === true,
    };
    categoryByName.set(key, definition);
    categories.push(definition);
  }

  const transactions = cashflowRows.map((row, index) => {
    const [rawDate, rawType, , rawAmount, rawCurrency, rawCategory] = row;
    const type = String(rawType ?? "").trim().toLowerCase();
    const amount = Number(rawAmount);
    const currency = normalizeCurrency(rawCurrency);
    const category = String(rawCategory ?? "").trim() || null;

    if (!(["income", "expense", "contribution"] as string[]).includes(type)) {
      throw new Error(`The cashflow tab contains an invalid type on row ${index + 2}.`);
    }
    if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) {
      throw new Error(`The cashflow tab contains an invalid transaction on row ${index + 2}.`);
    }
    if (category && !categoryByName.has(category)) {
      throw new Error(`The cashflow tab contains an unknown category on row ${index + 2}: ${category}.`);
    }

    return { date: toIsoDate(rawDate), type: type as CashflowType, amount, currency, category };
  });

  const constants = new Map(
    (constantsResponse.data.values ?? []).map(([key, value]) => [String(key).trim().toUpperCase(), normalizeCurrency(value)]),
  );
  const reportingCurrencies = ["CURRENCY_1", "CURRENCY_2", "CURRENCY_3"].flatMap((key) => {
    const currency = constants.get(key);
    return currency && /^[A-Z]{3}$/.test(currency) ? [currency] : [];
  }).filter((currency, index, values) => values.indexOf(currency) === index);
  if (reportingCurrencies.length === 0) {
    throw new Error("Set CURRENCY_1 in the costants tab.");
  }

  return { transactions, categories, reportingCurrencies };
}
