import { cacheLife } from "next/cache";
import { DEFAULT_APP_SETTINGS, loadAppSettings } from "@/lib/sheets/app-settings";

/** Cached, so the root layout does not call Sheets on every request. */
export async function loadCachedAppSettings() {
  "use cache";
  cacheLife("minutes");

  try {
    return await loadAppSettings();
  } catch {
    // A Sheets outage must not break every page's title; each page reports its own load error.
    return DEFAULT_APP_SETTINGS;
  }
}
