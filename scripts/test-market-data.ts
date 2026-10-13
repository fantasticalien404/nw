import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getLatestPrice } from "@/lib/market-data/prices";

async function main() {
  const localPrices = JSON.parse(await readFile("data/market-data/ACWI.json", "utf8")) as {
    prices: Array<{ close: number }>;
  };
  const localLatestPrice = localPrices.prices.at(-1)?.close;
  assert.notEqual(localLatestPrice, undefined);

  const originalFetch = globalThis.fetch;
  const timestamp = Math.floor(new Date().setUTCHours(0, 0, 0, 0) / 1000);

  try {
    globalThis.fetch = async () => new Response(JSON.stringify({
      chart: {
        result: [{
          timestamp: [timestamp],
          indicators: { quote: [{ close: [777] }], adjclose: [{ adjclose: [777] }] },
        }],
      },
    }));
    assert.equal(await getLatestPrice("ACWI"), 777);

    globalThis.fetch = async () => new Response(null, { status: 503 });
    assert.equal(await getLatestPrice("ACWI"), localLatestPrice);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("market-data tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
