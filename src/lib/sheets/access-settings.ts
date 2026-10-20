// Access keys in the `constants` tab. They decide who sees real values, so they must never reach the browser.
import { readSheetValues, type SheetRows } from "./client";
import { parseConstants } from "./parse";

export type AccessSettings = {
  /** Lower-cased Google emails allowed to see real values. */
  allowedEmails: string[];
  /** A seed that unlocks real values for anyone; null when not set. */
  luckySeed: string | null;
};

export function parseAccessSettings(constantRows: SheetRows): AccessSettings {
  const constants = parseConstants(constantRows);
  const allowedEmails = (constants.get("ALLOWED_EMAILS") ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return { allowedEmails, luckySeed: constants.get("LUCKY_SEED") || null };
}

export async function loadAccessSettings(): Promise<AccessSettings> {
  const [constantRows] = await readSheetValues("constants!A:B");
  return parseAccessSettings(constantRows);
}
