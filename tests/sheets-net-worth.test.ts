import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNetWorthWorkbook } from "@/lib/sheets/net-worth";

const JAN_1_2026 = 46_023;
const FEB_1_2026 = 46_054;
const ASSET_HEADER = ["ASSET", "DATATYPE", "CURRENCY", "ACCOUNT", JAN_1_2026, FEB_1_2026];
const METADATA_HEADER = ["TICKER", "DISPLAY_NAME", "FULL_NAME", "CURRENCY", "TER", "ISSUER"];

function tabs(overrides: Partial<Parameters<typeof parseNetWorthWorkbook>[0]> = {}) {
  return {
    assetRows: [
      ASSET_HEADER,
      ["VT", "quantity", "USD", "IB", 10, 12],
      ["Savings", "cash", "EUR", "Bank", 1000, ""],
      [],
      ["House", "value", "DOL", "-", "", 250_000],
    ],
    metadataRows: [METADATA_HEADER, ["VT", "", "Vanguard Total World", "USD", 0.07, "Vanguard"], ["IWDA.AS", "World", "iShares MSCI World", "EUR", 0.2, "iShares"]],
    constantRows: [["CURRENCY_1", "CHF"]],
    ...overrides,
  };
}

const currenciesFor = (constantRows: unknown[][]) => parseNetWorthWorkbook(tabs({ constantRows })).currencies;

describe("parseNetWorthWorkbook", () => {
  it("parses assets, reporting periods and values, skipping blank rows and empty cells", () => {
    const workbook = parseNetWorthWorkbook(tabs());
    assert.deepEqual(workbook.reportingPeriods, ["2026-01-01", "2026-02-01"]);
    assert.deepEqual(workbook.assets.map((asset) => [asset.asset, asset.datatype, asset.currency, asset.account]), [
      ["VT", "quantity", "USD", "IB"],
      ["Savings", "cash", "EUR", "Bank"],
      ["House", "value", "USD", "-"],
    ]);
    assert.deepEqual([...workbook.assets[0].reportingValues], [["2026-01-01", 10], ["2026-02-01", 12]]);
    assert.deepEqual([...workbook.assets[1].reportingValues], [["2026-01-01", 1000]]);
    assert.deepEqual([...workbook.assets[2].reportingValues], [["2026-02-01", 250_000]]);
  });

  it("attaches instrument names from the metadata tab by ticker", () => {
    const [vt, savings] = parseNetWorthWorkbook(tabs()).assets;
    assert.deepEqual([vt.displayName, vt.fullName], [null, "Vanguard Total World"]);
    assert.deepEqual([savings.displayName, savings.fullName], [null, null]);
    const named = parseNetWorthWorkbook(tabs({ assetRows: [ASSET_HEADER, ["IWDA.AS", "quantity", "EUR", "IB", 1, 1]] })).assets[0];
    assert.deepEqual([named.displayName, named.fullName], ["World", "iShares MSCI World"]);
  });

  it("puts CURRENCY_1 first, then CURRENCY_2 and CURRENCY_3, then fills from EUR, CHF, USD", () => {
    assert.deepEqual(currenciesFor([["CURRENCY_1", "CHF"]]), ["CHF", "EUR", "USD"]);
    assert.deepEqual(currenciesFor([["CURRENCY_1", "USD"], ["CURRENCY_2", "chf"], ["CURRENCY_3", "EUR"]]), ["USD", "CHF", "EUR"]);
    assert.deepEqual(currenciesFor([["CURRENCY_1", "EUR"], ["CURRENCY_2", "GBP"]]), ["EUR", "CHF", "USD"]);
    assert.deepEqual(currenciesFor([["CURRENCY_1", "EUR"], ["CURRENCY_2", "EUR"], ["CURRENCY_3", "USD"]]), ["EUR", "USD", "CHF"]);
    assert.deepEqual(currenciesFor([["CURRENCY_1", "DOL"]]), ["USD", "EUR", "CHF"]);
  });

  it("requires CURRENCY_1", () => {
    assert.throws(() => currenciesFor([["CURRENCY_2", "EUR"]]), /Set CURRENCY_1/);
    assert.throws(() => currenciesFor([]), /Set CURRENCY_1/);
  });

  it("rejects invalid headers", () => {
    assert.throws(() => parseNetWorthWorkbook(tabs({ assetRows: [["ASSET", "TYPE", "CURRENCY", "ACCOUNT"]] })), /assets tab has invalid headers/);
    assert.throws(() => parseNetWorthWorkbook(tabs({ metadataRows: [["TICKER", "NAME"]] })), /metadata tab has invalid headers/);
    assert.throws(() => parseNetWorthWorkbook(tabs({ assetRows: [[...ASSET_HEADER.slice(0, 4), "soon"]] })), /invalid reporting-period date/);
  });

  it("rejects invalid asset rows, naming the asset", () => {
    const withRow = (row: unknown[]) => tabs({ assetRows: [ASSET_HEADER, row] });
    assert.throws(() => parseNetWorthWorkbook(withRow(["VT", "shares", "USD", "IB", 1])), /invalid row for VT/);
    assert.throws(() => parseNetWorthWorkbook(withRow(["VT", "quantity", "DOLLARS", "IB", 1])), /invalid row for VT/);
    assert.throws(() => parseNetWorthWorkbook(withRow(["", "quantity", "USD", "IB", 1])), /invalid row for an unnamed asset/);
    assert.throws(() => parseNetWorthWorkbook(withRow(["VT", "quantity", "USD", "IB", "ten"])), /invalid reporting value for VT/);
  });
});
