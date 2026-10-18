import type { AssetDatatype } from "./workbook";

/** One workbook asset priced for every reporting period; the output of the market-data conversion step. */
export type ValuedAsset = {
  asset: string;
  currency: string;
  datatype: AssetDatatype;
  /** Set for ticker-priced (`quantity`) assets only. */
  instrumentName: string | null;
  instrumentUrl: string | null;
  /** Value per period in the asset's own currency; null when unavailable. */
  values: Array<number | null>;
  /** Value per report currency (outer) and period (inner), converted at that period's FX rate. */
  convertedValues: Array<Array<number | null>>;
  /** Year-to-date price performance in percent, per report currency. */
  ytdPerformance: Record<string, number | null>;
};

export type ValuedNetWorth = {
  currencies: string[];
  /** Reporting periods up to the latest one with values, followed by the current date. */
  periods: string[];
  assets: ValuedAsset[];
  warnings: string[];
};
