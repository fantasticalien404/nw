import { google } from "googleapis";

function formatPrivateKey(privateKey: string) {
  const decodedKey = privateKey.replace(/\\n/g, "\n");

  if (decodedKey.includes("-----BEGIN PRIVATE KEY-----")) {
    return decodedKey;
  }

  return `-----BEGIN PRIVATE KEY-----\n${decodedKey}\n-----END PRIVATE KEY-----\n`;
}

function getSheetsClient() {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !email || !privateKey) {
    throw new Error("Google Sheets environment variables are not configured.");
  }

  const auth = new google.auth.JWT({
    email,
    key: formatPrivateKey(privateKey),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return { sheetId, sheets: google.sheets({ version: "v4", auth }) };
}

/** Raw cell values of one tab range; row 0 is the header row (the `constants` tab has none). */
export type SheetRows = unknown[][];

/** Reads several A1 ranges in parallel (read-only, unformatted values). One entry per range, in order. */
export async function readSheetValues(...ranges: string[]): Promise<SheetRows[]> {
  const { sheetId, sheets } = getSheetsClient();
  const responses = await Promise.all(
    ranges.map((range) =>
      sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range, valueRenderOption: "UNFORMATTED_VALUE" }),
    ),
  );
  return responses.map((response) => response.data.values ?? []);
}
