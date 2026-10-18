import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NetWorthPortfolio } from "@/components/net-worth/net-worth-portfolio";
import { buildHallOfFame } from "@/lib/analytics/hall-of-fame";
import { netWorthFixture } from "./support/net-worth-fixture";

const { report, benchmarkInputs, growthSeries } = netWorthFixture();
const hallOfFame = buildHallOfFame(report, { CHF: [], EUR: [] }, report.periods.at(-1)!);

function render(props: Partial<Parameters<typeof NetWorthPortfolio>[0]> = {}) {
  return renderToStaticMarkup(
    <NetWorthPortfolio report={report} benchmarkInputs={benchmarkInputs} growthSeries={growthSeries} hallOfFame={hallOfFame} {...props} />,
  );
}

describe("NetWorthPortfolio", () => {
  const html = render();

  it("headlines the current net worth in the first currency", () => {
    assert.match(html, /<h1[^>]*>93,400 CHF<\/h1>/);
  });

  it("splits the asset table into financial, cash and other sections with group totals", () => {
    for (const heading of ["Financial instruments", "Cash assets", "Other assets", "Net Worth"]) assert.match(html, new RegExp(`>${heading}<`));
    assert.match(html, /<th[^>]*>Financial instruments<\/th>(<td[^>]*>[\d,—]+<\/td>)+/);
    assert.match(html, />1,300<\/td>/);
  });

  it("totals every currency and the first currency's changes, with plain numbers", () => {
    assert.equal((html.match(/>Total<\/th>/g) ?? []).length, 2);
    for (const label of ["Abs. change", "% change"]) assert.match(html, new RegExp(`>${label}<`));
    assert.match(html, />93,400</);
    assert.match(html, />87,100</);
    assert.match(html, />2477\.1%</);
    assert.doesNotMatch(html, /[$€£]/);
  });

  it("shows missing values as a dash", () => {
    assert.match(html, /<td[^>]*>—<\/td>/);
    assert.doesNotMatch(html, /NaN|undefined|Infinity/);
  });

  it("links instruments to their quote page by display name and prints other assets plain", () => {
    assert.match(html, /<a href="https:\/\/finance\.yahoo\.com\/quote\/VT"[^>]*>Vanguard World<\/a>/);
    assert.match(html, /<th[^>]*>Savings<\/th>/);
    assert.match(html, /<td[^>]*>VT<\/td>/);
  });

  it("colours year-to-date performance by sign", () => {
    assert.match(html, /text-emerald-700">8\.4%</);
    assert.match(html, /text-black">0\.0%</);
    assert.match(html, /text-black">—</);
  });

  it("offers the benchmark comparison, growth sources, rankings and per-currency chart", () => {
    assert.match(html, />Benchmark comparison</);
    assert.match(html, /<select aria-label="Rebalancing interval"/);
    assert.match(html, />Net-worth growth sources</);
    assert.match(html, />Hall of fame</);
    assert.match(html, />Net worth by currency</);
  });

  it("explains unavailable sections instead of hiding them", () => {
    const degraded = render({ benchmarkInputs: null, growthSeries: null, hallOfFame: null });
    assert.doesNotMatch(degraded, />Benchmark comparison</);
    assert.match(degraded, /Growth data is unavailable because cashflow data could not be loaded\./);
    assert.match(degraded, /Rankings are unavailable because cashflow data could not be loaded\./);
  });

  it("lists data-quality warnings only when there are any", () => {
    assert.doesNotMatch(html, /Data quality/);
    const warned = render({ report: { ...report, warnings: ["Download market data for XYZ with npm run download:market-data."] } });
    assert.match(warned, /Data quality/);
    assert.match(warned, /<li>Download market data for XYZ with npm run download:market-data\.<\/li>/);
  });

  it("links every aria-labelledby to an existing id, and ids are unique", () => {
    for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
      for (const id of match[1].split(" ")) assert.ok(html.includes(`id="${id}"`), `Missing label target: ${id}`);
    }
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length);
  });
});
