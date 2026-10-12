import { loadEnvConfig } from "@next/env";
import { google } from "googleapis";

loadEnvConfig(process.cwd());

const requiredVariables = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
] as const;

for (const variable of requiredVariables) {
  if (!process.env[variable]) {
    throw new Error(`Missing required environment variable: ${variable}`);
  }
}

function formatPrivateKey(privateKey: string) {
  const decodedKey = privateKey.replace(/\\n/g, "\n");

  if (decodedKey.includes("-----BEGIN PRIVATE KEY-----")) {
    return decodedKey;
  }

  return `-----BEGIN PRIVATE KEY-----\n${decodedKey}\n-----END PRIVATE KEY-----\n`;
}

async function main() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY!),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "cashflow!A:H",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const rows = response.data.values ?? [];
  if (rows.length === 0) {
    throw new Error("The cashflow tab is empty. Add the required header row and at least one transaction.");
  }

  const [headers, ...cashflowRows] = rows;
  const expectedHeaders = [
    "date",
    "type",
    "name",
    "amount",
    "currency",
    "category",
    "subcategory",
    "notes",
  ];
  const actualHeaders = headers.map((header, index) => {
    const value = String(header).trim().toLowerCase();
    return index === 6 && value === "city" ? "subcategory" : value;
  });

  if (actualHeaders.join("|") !== expectedHeaders.join("|")) {
    throw new Error(
      `Invalid cashflow headers. Expected: ${expectedHeaders.join(", ")}. Found: ${actualHeaders.join(", ")}`,
    );
  }

  const allowedTypes = new Set(["income", "expense", "contribution"]);
  const errors: string[] = [];

  for (const [index, row] of cashflowRows.entries()) {
    const rowNumber = index + 2;
    const [date, type, name, amount, currency] = row.map((value) =>
      String(value).trim(),
    );

    if (!date || !type || !name || !amount || !currency) {
      errors.push(`Row ${rowNumber}: date, transaction type, name, amount, and currency are required.`);
      continue;
    }

    if (!allowedTypes.has(type.toLowerCase())) {
      errors.push(`Row ${rowNumber}: invalid transaction type "${type}".`);
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      errors.push(`Row ${rowNumber}: amount "${amount}" must be a non-negative number.`);
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push(`Row ${rowNumber}: currency "${currency}" must be a three-letter uppercase code.`);
    }
  }

  console.log(`Found ${cashflowRows.length} cashflow rows`);

  if (errors.length > 0) {
    throw new Error(`Cashflow validation failed:\n${errors.join("\n")}`);
  }

  console.log("Cashflow schema and values are valid.");

  const assetsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "assets!A:Z",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const assetRows = assetsResponse.data.values ?? [];

  if (assetRows.length < 2) {
    throw new Error("The assets tab must contain a header row and at least one asset row.");
  }

  const [assetHeaders, ...assets] = assetRows;
  const expectedAssetHeaders = ["asset", "datatype", "currency", "account"];
  const actualAssetHeaders = assetHeaders
    .slice(0, 4)
    .map((header) => String(header).trim().toLowerCase());

  if (actualAssetHeaders.join("|") !== expectedAssetHeaders.join("|")) {
    throw new Error(
      `Invalid assets headers. Expected: ${expectedAssetHeaders.join(", ")}. Found: ${actualAssetHeaders.join(", ")}`,
    );
  }

  const reportingPeriods = assetHeaders.slice(4).map((value) => Number(value));
  const assetErrors: string[] = [];

  if (reportingPeriods.length === 0) {
    assetErrors.push("Add at least one reporting-period date after the Account column.");
  }

  for (const [index, reportingPeriod] of reportingPeriods.entries()) {
    if (!Number.isFinite(reportingPeriod)) {
      assetErrors.push(`Column ${index + 5}: reporting period must be a Google Sheets date.`);
    }

    if (index > 0 && reportingPeriod <= reportingPeriods[index - 1]) {
      assetErrors.push("Reporting-period dates must be in ascending order.");
    }
  }

  const allowedDatatypes = new Set(["quantity", "cash", "value"]);

  for (const [index, assetRow] of assets.entries()) {
    const rowNumber = index + 2;

    if (assetRow.every((value) => String(value ?? "").trim() === "")) {
      continue;
    }

    const [asset, datatype, currency] = assetRow
      .slice(0, 3)
      .map((value) => String(value).trim());

    if (!asset || !datatype || !currency) {
      assetErrors.push(`Row ${rowNumber}: asset, datatype, and currency are required.`);
      continue;
    }

    if (!allowedDatatypes.has(datatype.toLowerCase())) {
      assetErrors.push(`Row ${rowNumber}: invalid datatype "${datatype}".`);
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      assetErrors.push(`Row ${rowNumber}: currency "${currency}" must be a three-letter uppercase code.`);
    }

    const values = assetRow.slice(4).filter((value) => value !== "");

    for (const value of values) {
      if (!Number.isFinite(Number(value))) {
        assetErrors.push(`Row ${rowNumber}: reporting-period values must be numbers.`);
        break;
      }
    }
  }

  console.log(`Found ${assets.length} asset rows across ${reportingPeriods.length} reporting periods`);

  if (assetErrors.length > 0) {
    throw new Error(`Assets validation failed:\n${assetErrors.join("\n")}`);
  }

  console.log("Assets schema and values are valid.");

  const [constantsResponse, saaResponse, categoriesResponse, metadataResponse] = await Promise.all(
    ["costants!A:B", "saa!A:Z", "categories!A:B", "metadata!A:F"].map((range) =>
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range,
        valueRenderOption: "UNFORMATTED_VALUE",
      }),
    ),
  );
  const constants = constantsResponse.data.values ?? [];
  const saaRows = saaResponse.data.values ?? [];
  const categoryRows = categoriesResponse.data.values ?? [];
  const metadataRows = metadataResponse.data.values ?? [];
  const otherErrors: string[] = [];

  if (constants.length === 0) {
    otherErrors.push("The costants tab is empty.");
  }

  for (const [index, row] of constants.entries()) {
    const [key, value] = row;
    if (!String(key ?? "").trim() || value === "" || value === undefined) {
      otherErrors.push(`costants row ${index + 1}: key and value are required.`);
    }
  }

  if (saaRows.length < 2) {
    otherErrors.push("The saa tab must contain a header row and at least one target row.");
  } else {
    const [saaHeaders, ...targets] = saaRows;
    const expectedSaaHeaders = ["asset_class", "instrument"];
    const actualSaaHeaders = saaHeaders
      .slice(0, 2)
      .map((header) => String(header).trim().toLowerCase());
    const saaPeriods = saaHeaders.slice(2).map((value) => Number(value));

    if (actualSaaHeaders.join("|") !== expectedSaaHeaders.join("|")) {
      otherErrors.push(`Invalid saa headers. Expected: ${expectedSaaHeaders.join(", ")}.`);
    }

    for (const [index, period] of saaPeriods.entries()) {
      if (!Number.isFinite(period)) {
        otherErrors.push(`saa column ${index + 3}: reporting period must be a Google Sheets date.`);
      }

      if (index > 0 && period <= saaPeriods[index - 1]) {
        otherErrors.push("saa reporting-period dates must be in ascending order.");
      }
    }

    for (const [index, target] of targets.entries()) {
      const rowNumber = index + 2;
      const [assetClass, instrument] = target.slice(0, 2).map((value) => String(value).trim());
      if (!assetClass || !instrument) {
        otherErrors.push(`saa row ${rowNumber}: asset class and instrument are required.`);
      }

      for (const value of target.slice(2).filter((value) => value !== "")) {
        if (!Number.isFinite(Number(value)) || Number(value) < 0) {
          otherErrors.push(`saa row ${rowNumber}: targets must be non-negative numbers.`);
          break;
        }
      }
    }
  }

  if (categoryRows.length < 2) {
    otherErrors.push("The categories tab must contain a header row and at least one category row.");
  } else {
    const [categoryHeaders, ...categories] = categoryRows;
    const expectedCategoryHeaders = ["category", "parent_category"];
    const actualCategoryHeaders = categoryHeaders.map((header) => String(header).trim().toLowerCase());

    if (actualCategoryHeaders.join("|") !== expectedCategoryHeaders.join("|")) {
      otherErrors.push(`Invalid categories headers. Expected: ${expectedCategoryHeaders.join(", ")}.`);
    }

    const categoryKeys = new Set<string>();
    for (const [index, category] of categories.entries()) {
      const key = String(category[0] ?? "").trim();
      const parent = String(category[1] ?? "").trim();
      if (!key || !parent) {
        otherErrors.push(`categories row ${index + 2}: category and parent category are required.`);
      } else if (categoryKeys.has(key)) {
        otherErrors.push(`categories row ${index + 2}: duplicate category "${key}".`);
      } else {
        categoryKeys.add(key);
      }
    }

    for (const [index, cashflowRow] of cashflowRows.entries()) {
      const category = String(cashflowRow[5] ?? "").trim();
      if (category && !categoryKeys.has(category)) {
        otherErrors.push(`cashflow row ${index + 2}: unknown category "${category}".`);
      }
    }
  }

  if (metadataRows.length < 2) {
    otherErrors.push("The metadata tab must contain a header row and at least one instrument row.");
  } else {
    const [metadataHeaders, ...instruments] = metadataRows;
    const expectedMetadataHeaders = ["ticker", "display_name", "full_name", "currency", "ter", "issuer"];
    const actualMetadataHeaders = metadataHeaders.map((header) => String(header).trim().toLowerCase());

    if (actualMetadataHeaders.join("|") !== expectedMetadataHeaders.join("|")) {
      otherErrors.push(`Invalid metadata headers. Expected: ${expectedMetadataHeaders.join(", ")}.`);
    }

    for (const [index, instrument] of instruments.entries()) {
      const [ticker, , fullName, currency, ter, issuer] = instrument.map((value) => String(value ?? "").trim());
      if (!ticker || !fullName || !currency || !ter || !issuer) {
        otherErrors.push(`metadata row ${index + 2}: ticker, full name, currency, TER, and issuer are required.`);
      }
      if (currency && !/^[A-Z]{3}$/.test(currency)) {
        otherErrors.push(`metadata row ${index + 2}: currency must be a three-letter uppercase code.`);
      }
    }
  }

  console.log(`Found ${constants.length} constants, ${Math.max(saaRows.length - 1, 0)} SAA rows, ${Math.max(categoryRows.length - 1, 0)} category rows, and ${Math.max(metadataRows.length - 1, 0)} metadata rows`);

  if (otherErrors.length > 0) {
    throw new Error(`Constants, SAA, or categories validation failed:\n${otherErrors.join("\n")}`);
  }

  console.log("Constants, SAA, and categories schemas and values are valid.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
