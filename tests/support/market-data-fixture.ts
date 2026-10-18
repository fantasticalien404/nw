// Hermetic market data for tests: price files in a temp working directory and a stubbed Yahoo `fetch`.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** `[date, close, adjustedClose?]` rows; the adjusted close defaults to the close. */
export type PriceRows = Array<[string, number, (number | null)?]>;

export function setupMarketData(series: Record<string, PriceRows>) {
  const previousCwd = process.cwd();
  const previousFetch = globalThis.fetch;
  const directory = mkdtempSync(join(tmpdir(), "nw-market-data-"));
  mkdirSync(join(directory, "data", "market-data"), { recursive: true });

  for (const [symbol, rows] of Object.entries(series)) {
    const prices = rows.map(([date, close, adjustedClose]) => ({ date, close, adjustedClose: adjustedClose === undefined ? close : adjustedClose }));
    writeFileSync(join(directory, "data", "market-data", `${encodeURIComponent(symbol)}.json`), JSON.stringify({ symbol, downloadedAt: "test", prices }));
  }
  process.chdir(directory);

  const fetchCalls: string[] = [];
  let handler: (url: string) => Response = () => new Response(null, { status: 503 });
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    return handler(String(input));
  }) as typeof fetch;

  return {
    /** Every URL requested through `fetch` (Yahoo top-ups). Defaults to answering 503. */
    fetchCalls,
    respondWith(next: (url: string) => Response) {
      handler = next;
    },
    cleanup() {
      process.chdir(previousCwd);
      globalThis.fetch = previousFetch;
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/** A Yahoo chart response with one daily bar per `[date, close]` row. */
export function yahooResponse(rows: Array<[string, number]>) {
  return new Response(JSON.stringify({
    chart: {
      result: [{
        timestamp: rows.map(([date]) => Date.parse(`${date}T00:00:00Z`) / 1000),
        indicators: { quote: [{ close: rows.map(([, close]) => close) }], adjclose: [{ adjclose: rows.map(([, close]) => close) }] },
      }],
    },
  }));
}
