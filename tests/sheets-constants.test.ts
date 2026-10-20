import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_APP_SETTINGS, parseAppSettings } from "@/lib/sheets/app-settings";
import { parseConstants } from "@/lib/sheets/parse";

describe("costants parsing", () => {
  it("normalises currency values but keeps text values as typed", () => {
    const constants = parseConstants([
      ["currency_1", " dol "],
      ["APP_NAME", "Giacomo's"],
      ["ALLOWED_EMAILS", "A@x.com, b@x.com"],
    ]);

    assert.equal(constants.get("CURRENCY_1"), "USD");
    assert.equal(constants.get("APP_NAME"), "Giacomo's");
    assert.equal(constants.get("ALLOWED_EMAILS"), "A@x.com, b@x.com");
  });

  it("reads the app name and description", () => {
    const settings = parseAppSettings([
      ["APP_NAME", "Giacomo's"],
      ["APP_DESCRIPTION", "Personal tracker"],
    ]);

    assert.deepEqual(settings, { appName: "Giacomo's", appDescription: "Personal tracker" });
  });

  it("falls back to the defaults for missing or blank keys", () => {
    assert.deepEqual(parseAppSettings([]), DEFAULT_APP_SETTINGS);
    assert.deepEqual(parseAppSettings([["APP_NAME", "  "]]), DEFAULT_APP_SETTINGS);
  });
});
