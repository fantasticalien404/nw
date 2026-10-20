// Page metadata kept in the `constants` tab (`APP_NAME`, `APP_DESCRIPTION`).
import { readSheetValues, type SheetRows } from "./client";
import { parseConstants } from "./parse";

export type AppSettings = { appName: string; appDescription: string };

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: "Net Worth",
  appDescription: "Private personal-wealth dashboard",
};

/** Blank or missing keys fall back to the defaults. */
export function parseAppSettings(constantRows: SheetRows): AppSettings {
  const constants = parseConstants(constantRows);
  return {
    appName: constants.get("APP_NAME") || DEFAULT_APP_SETTINGS.appName,
    appDescription: constants.get("APP_DESCRIPTION") || DEFAULT_APP_SETTINGS.appDescription,
  };
}

export async function loadAppSettings(): Promise<AppSettings> {
  const [constantRows] = await readSheetValues("constants!A:B");
  return parseAppSettings(constantRows);
}
