// Domain types produced by `lib/sheets` parsing and shared by the market-data, analytics and UI layers.

export type CashflowType = "income" | "expense" | "contribution";

export type CashflowTransaction = {
  date: string;
  type: CashflowType;
  amount: number;
  currency: string;
  category: string | null;
};

/** A transaction whose amount has been converted to a single reporting currency. */
export type ConvertedCashflowTransaction = Omit<CashflowTransaction, "currency">;

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

export type AssetDatatype = "quantity" | "cash" | "value";

export type AssetRow = {
  asset: string;
  datatype: AssetDatatype;
  currency: string;
  account: string;
  displayName: string | null;
  fullName: string | null;
  /** Reported quantity or value keyed by reporting-period date. */
  reportingValues: Map<string, number>;
};

export type NetWorthWorkbook = {
  assets: AssetRow[];
  reportingPeriods: string[];
  /** Report currencies: `CURRENCY_1` first, then secondary currencies. */
  currencies: string[];
};
