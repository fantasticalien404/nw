import { google } from "googleapis";

function formatPrivateKey(privateKey: string) {
  const decodedKey = privateKey.replace(/\\n/g, "\n");

  if (decodedKey.includes("-----BEGIN PRIVATE KEY-----")) {
    return decodedKey;
  }

  return `-----BEGIN PRIVATE KEY-----\n${decodedKey}\n-----END PRIVATE KEY-----\n`;
}

export function getSheetsClient() {
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
