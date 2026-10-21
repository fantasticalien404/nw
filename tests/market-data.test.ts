import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createMarketData } from "@/lib/market-data/prices";
import { setupMarketData } from "./support/market-data-fixture";

let fixture: ReturnType<typeof setupMarketData>;
afterEach(() => fixture?.cleanup());

describe("market data lookups", () => {
  beforeEach(() => {
    fixture = setupMarketData({
      ACWI: [["2026-01-30", 100, 90], ["2026-02-02", 105, 94], ["2026-03-02", 110, null]],
      "USDCHF=X": [["2026-01-30", 0.9], ["2026-03-02", 0.8]],
    });
  });

  it("prices on the first trading day on or after the date, and past the data at the latest close", async () => {
    const market = createMarketData();
    assert.equal(await market.price("ACWI", "2026-01-30"), 100);
    assert.equal(await market.price("ACWI", "2026-01-31"), 105);
    assert.equal(await market.price("ACWI", "2026-12-31"), 110);
    assert.equal(await market.latestPrice("ACWI"), 110);
  });

  it("converts at the historical rate, and same-currency conversion is exactly one", async () => {
    const market = createMarketData();
    assert.equal(await market.fxRate("USD", "CHF", "2026-01-30"), 0.9);
    assert.equal(await market.fxRate("USD", "CHF", "2026-02-15"), 0.8);
    assert.equal(await market.latestFxRate("USD", "CHF"), 0.8);
    assert.equal(await market.fxRate("EUR", "EUR", "2026-02-15"), 1);
    assert.equal(await market.latestFxRate("EUR", "EUR"), 1);
  });

  it("returns half-open date ranges of raw and adjusted closes, skipping missing adjusted prices", async () => {
    const market = createMarketData();
    assert.deepEqual(await market.history("ACWI", "2026-01-30", "2026-03-02"), [
      { date: "2026-01-30", close: 100 },
      { date: "2026-02-02", close: 105 },
    ]);
    assert.deepEqual(await market.adjustedHistory("ACWI", "2026-01-01", "2026-04-01"), [
      { date: "2026-01-30", close: 90 },
      { date: "2026-02-02", close: 94 },
    ]);
    await assert.rejects(market.adjustedHistory("ACWI", "2026-03-01", "2026-04-01"), /no adjusted prices for ACWI/);
  });

  it("explains how to fix a missing or invalid local file", async () => {
    const market = createMarketData();
    await assert.rejects(market.price("NOPE", "2026-01-01"), /Download market data for NOPE with npm run download:market-data\./);
    await assert.rejects(market.fxRate("EUR", "CHF", "2026-01-01"), /Download market data for EURCHF=X/);
  });

  it("never requests market data at runtime, even when the local files end before today", async () => {
    const market = createMarketData();
    await market.latestPrice("ACWI");
    await market.latestFxRate("USD", "CHF");
    assert.equal(fixture.fetchCalls.length, 0);
  });
});
