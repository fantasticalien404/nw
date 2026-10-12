import { getSheetsClient } from "@/lib/sheets/client";

export type AssetDatatype = "quantity" | "cash" | "value";

export type AssetRow = {
  asset: string;
  datatype: AssetDatatype;
  currency: string;
  account: string;
  displayName: string | null;
  fullName: string | null;
  reportingValues: Map<string, number>;
};

export type NetWorthWorkbook = {
  assets: AssetRow[];
  reportingPeriods: string[];
  currencies: string[];
};

function toIsoDate(serial: unknown) {
  const value = Number(serial);
  const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function normalizeCurrency(value: unknown) {
  const currency = String(value ?? "").trim().toUpperCase();
  return currency === "DOL" ? "USD" : currency;
}

export async function loadNetWorthWorkbook(): Promise<NetWorthWorkbook> {
  const { sheetId, sheets } = getSheetsClient();
  const [assetsResponse, constantsResponse, metadataResponse] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "assets!A:Z",
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "costants!A:B",
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "metadata!A:F",
      valueRenderOption: "UNFORMATTED_VALUE",
    }),
  ]);
  const [headers = [], ...assetRows] = assetsResponse.data.values ?? [];
  const [metadataHeaders = [], ...metadataRows] = metadataResponse.data.values ?? [];
  const expectedHeaders = ["asset", "datatype", "currency", "account"];
  const actualHeaders = headers.slice(0, 4).map((value) => String(value).trim().toLowerCase());

  if (actualHeaders.join("|") !== expectedHeaders.join("|")) {
    throw new Error("The assets tab has invalid headers.");
  }

  const expectedMetadataHeaders = ["ticker", "display_name", "full_name", "currency", "ter", "issuer"];
  const actualMetadataHeaders = metadataHeaders.map((value) => String(value).trim().toLowerCase());
  if (actualMetadataHeaders.join("|") !== expectedMetadataHeaders.join("|")) {
    throw new Error("The metadata tab has invalid headers.");
  }

  const metadata = new Map(
    metadataRows
      .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
      .map(([ticker, displayName, fullName]) => [
        String(ticker ?? "").trim(),
        {
          displayName: String(displayName ?? "").trim() || null,
          fullName: String(fullName ?? "").trim() || null,
        },
      ]),
  );

  const reportingPeriods = headers.slice(4).map(toIsoDate);
  const assets = assetRows
    .filter((row) => row.some((value) => String(value ?? "").trim() !== ""))
    .map((row) => {
      const [asset, datatype, rawCurrency, account] = row.slice(0, 4).map((value) => String(value ?? "").trim());
      const currency = normalizeCurrency(rawCurrency);
      const reportingValues = new Map<string, number>();

      for (const [index, value] of row.slice(4).entries()) {
        if (value !== "" && value !== undefined) {
          const numericValue = Number(value);

          if (!Number.isFinite(numericValue)) {
            throw new Error(`The assets tab contains an invalid reporting value for ${asset || "an unnamed asset"}.`);
          }

          reportingValues.set(reportingPeriods[index], numericValue);
        }
      }

      if (!asset || !["quantity", "cash", "value"].includes(datatype) || !/^[A-Z]{3}$/.test(currency)) {
        throw new Error(`The assets tab contains an invalid row for ${asset || "an unnamed asset"}.`);
      }

      const instrument = metadata.get(asset);

      return {
        asset,
        datatype: datatype as AssetDatatype,
        currency,
        account,
        displayName: instrument?.displayName ?? null,
        fullName: instrument?.fullName ?? null,
        reportingValues,
      };
    });
  const constants = new Map(
    (constantsResponse.data.values ?? []).map(([key, value]) => [String(key).trim().toUpperCase(), normalizeCurrency(value)]),
  );
  const primary = constants.get("CURRENCY_1");
  const supportedCurrencies = ["EUR", "CHF", "USD"];
  const secondaryCurrencies = [constants.get("CURRENCY_2"), constants.get("CURRENCY_3")].filter(
    (currency): currency is string => Boolean(currency && supportedCurrencies.includes(currency)),
  );
  const fallbackCurrencies = supportedCurrencies.filter((currency) => currency !== primary);
  const currencies = [primary, ...secondaryCurrencies, ...fallbackCurrencies]
    .filter((currency): currency is string => Boolean(currency && supportedCurrencies.includes(currency)))
    .filter((currency, index, list) => list.indexOf(currency) === index)
    .slice(0, 3);

  if (!primary || currencies.length === 0) {
    throw new Error("Set CURRENCY_1 in the costants tab.");
  }

  return { assets, reportingPeriods, currencies };
}
