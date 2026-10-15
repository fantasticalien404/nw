import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CashflowDashboard } from "@/components/cashflow/cashflow-dashboard";
import { buildCashflowReport, type CashflowReport } from "@/lib/analytics/cashflow";

const categories = [
  { category: "rent", parentCategory: "housing", isEssential: true, isRecurring: true },
  { category: "dining", parentCategory: "food", isEssential: false, isRecurring: false },
  { category: "food.delivery", parentCategory: "food.delivery", isEssential: false, isRecurring: true },
];
const report = buildCashflowReport([
  { date: "2026-01-10", type: "income", amount: 3000, category: "salary" },
  { date: "2026-01-15", type: "expense", amount: 1000, category: "rent" },
  { date: "2026-02-10", type: "expense", amount: 100, category: "dining" },
  { date: "2026-02-12", type: "expense", amount: 25, category: "food.delivery" },
], categories);

function renderReport(report: CashflowReport, reportingDate = "2026-10-15") {
  return renderToStaticMarkup(
    <CashflowDashboard reports={{ EUR: report }} currency="EUR" reportingDate={reportingDate} />,
  );
}

const html = renderReport(report);
assert.match(html, /1,125 EUR/);
assert.match(html, /1,000 EUR/);
assert.match(html, /food\.delivery/);
assert.equal((html.match(/<table\b/g) ?? []).length, 2);
assert.equal((html.match(/class="recharts-responsive-container"/g) ?? []).length, 8);
assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 2);
assert.match(html, /<span class="sr-only">Expense insights<\/span>/);
for (const match of html.matchAll(/aria-labelledby="([^"]+)"/g)) {
  for (const id of match[1].split(" ")) {
    assert.ok(html.includes(`id="${id}"`), `Missing label target: ${id}`);
  }
}
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length);

for (const source of [report, buildCashflowReport([], [])]) {
  for (const date of ["2026-01-15", "2026-10-15"]) {
    const result = renderReport(source, date);
    assert.doesNotMatch(result, /NaN|Infinity/);
    assert.ok(result.includes(`max="${date}" value="${date}"`));
  }
}
assert.equal(renderReport(report), html);
console.log("cashflow dashboard render tests passed");
