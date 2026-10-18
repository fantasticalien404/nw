# Product backlog and change log

Last updated: 2026-10-18.

## Open issues from the 2026-10-18 audit

Found by reading the code, probing the analytics with synthetic data, checking the real workbook structurally (counts and flags only) and rendering synthetic fixture pages at 390, 820 and 1440 px. Numbers match the audit report; items already fixed are listed under the change log below.

### Wrong or inconsistent numbers

- **Moving-average window ends on the wrong day.** `cutoff` in `src/components/cashflow/cashflow-dashboard.tsx` is the *first* day of the previous month (the summary table and trend chart need that), but `movingAverageWindow` expects the *last* day. The chart and table stop on the 1st of the previous month and miss the rest of it. The unit tests use end-of-month cutoffs, so they pass. Also decide whether the chart should show a rolling average over the whole history instead of only the ramp-up of the last window.
- **Expense insights drop unclassified expenses** (`if (transaction.category)` in `src/lib/analytics/cashflow.ts`). The insight tiles, category chart, ratios, savings-rate chart and moving average exclude expenses with a blank category, so they differ from the summary table. CLAUDE.md says blank categories are counted as unclassified. Latent today (the workbook has none).
- **Months without a matching expense disappear from the insight charts, and take their salary with them** (`buildInsightPeriods`). Cumulative salary and the Salary tile depend on the expense filters.
- **Mid-month custom ranges mix whole-month income with partial-month expenses** in the insight savings rate.
- **The "Unclassified expenses" footnote under the summary table is an all-time total**, not the selected year.
- **Insight charts include the in-progress month**, while the trend chart and the monthly averages stop at the previous month. The stacked area and ratio charts drop at the end.
- **Moving average ignores every filter**, although the filter panel sits above it.
- **Daily average divides by calendar days before the first transaction** (for example "Last year" when the data starts in September).
- **Savings-rate "Monthly avg" is a mean of monthly rates** that skips null months, while the other averages count missing months as zero, and the Total column includes the partial month. Average savings divided by average income would be coherent.
- **Duplicate period when today equals the latest valued reporting period** (React keys and chart points). Rare now that empty future periods are dropped.
- **Hall of fame ranks the partial current month** ("Lowest expenses" always puts it first); months without any cashflow data would also rank as zero if the cashflow history were shorter than the net-worth history.
- **YTD % uses the first trading day's close as its base**, not the prior year-end close (`calculateYtdPerformance`).

### Interaction and presentation

- Benchmark Info dialog does not close on Escape and has no focus handling.
- Unchecking the last checked category or parent selects everything (empty selection means "no filter").
- The moving-average window input cannot be cleared while typing.
- Several contributions on the same date draw overlapping markers on the benchmark chart.
- Quick-range buttons show no active state; the net-worth "Year" select is independent of the range filter.
- `NetWorthPortfolio` calls `today()` on the client, unlike the cashflow dashboard, which receives the date from the server.
- On a 390 px screen the label column of both summary tables takes most of the width; a sticky label column would help.
- Hard-coded business names: `rent` and `health insurance` rows, `food` as the default historical category, CHF and EUR in the hall of fame. The workbook has no `health insurance` category, so that row repeats the `rent` row.

### Against CLAUDE.md

- **No authentication or demo mode.** There is no Google OAuth, allowlist, middleware or API route, so `/` and `/networth` serve real data to anyone who can reach the server. Required before any deployment.
- **Runtime Yahoo top-up.** `src/lib/market-data/prices.ts` fetches missing recent days from Yahoo on every render when the local file is behind today, which CLAUDE.md forbids. It also merges re-based adjusted closes into older rows, and it issues one request per symbol on weekends and holidays.
- **Benchmark metrics are never rendered.** `buildBenchmarkComparison` computes IRR, growth, Sharpe ratio, volatility, maximum drawdown and best/worst month, but no component shows them. The money-weighted IRR is required by the spec.
- SAA, Monte Carlo and Docs pages are "Coming soon" placeholders; the spec names the net-worth route `/nw` while the code serves `/networth`.
- CLAUDE.md contradicts itself on monthly averages ("end at the previous month" versus "include future months as zero"); the code follows the first.
- `assets!A:Z` limits the workbook to 22 reporting-period columns.

## Cashflow and planning

- Add scenario analysis with income and expense forecasts and a Monte Carlo simulation.
- Add one-year expected shortfall at the 99% confidence level.
- Add best- and worst-month metrics.
- Add a monthly stacked bar chart that decomposes net-worth growth into:
  - active savings (income less expenses); and
  - market returns.
- Stop the cumulative cashflow chart at the previous month and omit future months.

## Portfolio analytics

- Render the benchmark metrics (money-weighted IRR, growth, Sharpe ratio, volatility, maximum drawdown, best/worst month) for the portfolio and both benchmarks.
- Add rolling 12-month Sharpe and Sortino ratio charts.
- Add a dynamic correlation heatmap for portfolio instruments.
- Add target versus actual asset allocation on `/networth`.
- Add a fund look-through capability for stock, country, sector, and related exposures.
- Add portfolio leverage over time, including embedded ETF leverage and explicit Interactive Brokers leverage. => probably better with a dedicated skill
- Finish the multi-year view: an all-time historical summary. (Year selects on both tables and date-range filters on both dashboards exist.)

## Product scope still to build

- Google OAuth with the `ALLOWED_EMAILS` allowlist and a privacy-preserving demo mode, enforced in the backend.
- Home overview, SAA drift page, Monte Carlo page, admin/settings and the information page (`/docs`).
- Read-only JSON API routes, if they are still wanted once the pages exist.

## Completed

### Benchmark comparison

- Compare the portfolio with 60/40 and 100% equities benchmarks (both plotted at once).
- Apply the same `contribution` and `withdrawal` cashflows to the benchmark.
- Support benchmark currency (the selected report currency) and rebalancing-period selection.
- The analytics compute annualized money-weighted IRR, growth, Sharpe ratio, volatility, maximum drawdown and best/worst month; displaying them is open (see above).

### Navigation and pages

- Navigation bar for cashflow, net worth, SAA, Monte Carlo and docs.
- `/` (cashflow, with `/cashflow` redirecting to it) and `/networth` dashboards.

### Expense dashboard

- Expense insights with filters by currency, date range, month of the year, expense classification (essential, discretionary, recurring, non-recurring), parent category and category.
- Category area chart, essential/discretionary/recurring charts, savings rate, moving average with window selection, cumulative cashflow and a historical expense chart per category.

### 2026-10-18: audit and fixes

What was done, in order:

1. **Audit** of the whole repository: calculations, filters and charts. See the open issues above.
2. **Net-worth periods and the current column.** `valueNetWorth` (`src/lib/market-data/net-worth.ts`) now leaves out reporting periods after the latest one with values, so the "Current" period directly follows the last valued period.
   - Current's absolute and percentage change, the growth sources and the price increases compare against that period.
   - Charts no longer receive empty future periods: no zero plunge in the growth chart, no isolated Current point, no out-of-order axis on "Current year".
   - On the real workbook the periods went from 16 (out of order) to 13 (ascending). Interior empty periods are kept.
   - Behaviour change: the asset table no longer shows empty future columns. The spec sentence in CLAUDE.md was updated.
3. **Benchmark flow cap.** `benchmarkCashflows` takes the date of the latest reported holdings and drops later flows; `fillBenchmarkInputs` passes the period before Current. The Current portfolio value reuses those holdings, so a contribution invested later is not replayed into the benchmark.
   - On the real workbook the benchmark at Current moved from +18.1% to -0.7% against the portfolio.
   - The benchmark Info dialog and CLAUDE.md describe the rule.
4. **Tables on narrow screens.** The asset summary and cashflow summary tables use fixed pixel label columns and a minimum width per period column, so they scroll horizontally instead of squeezing digits together. They still fill the width on desktop.
5. **Category chart.**
   - `src/components/cashflow/category-colors.ts` has 12 distinct colours (the moving-average chart uses them too) and a grey for merged groups.
   - `ExpenseCategoryChart` draws only groups with expenses in the current selection, largest first, and keeps the legend in that order.
   - Beyond 12 groups, the smallest are merged into one grey "N other categories" series; a single extra group keeps its own series. The pure `splitLargestGroups` in `cashflow-insights.ts` does the ranking.
   - The chart no longer takes `categoryOptions` and `parentOptions`.
6. **Tests: 145 to 154.**
   - `benchmark.test.ts`: flows after the holdings date are excluded.
   - `net-worth-valuation.test.ts`: empty trailing periods are dropped and Current's change uses the last valued period; an interior empty period is kept.
   - `page-loaders.test.ts`: empty future periods and pending flows stay out of every series. The shared contribution moved to 75 days ago so the existing flow test does not depend on the day of the month.
   - `cashflow-insights.test.ts`: four `splitLargestGroups` cases and a palette-distinctness check.
   - The three new behaviour tests fail against the pre-fix code.
7. **Documentation.** Two CLAUDE.md sentences (table columns and the benchmark flow rule), this file, and a rewrite of README.md covering the current status, the backend and the workflow.

Verification: `npm run lint`, `npx tsc --noEmit` and `npm test` pass. The real workbook was checked structurally only (counts and flags, nothing written to disk). Pages were rendered from seeded synthetic data in a throwaway copy at 390, 820 and 1440 px; the repository itself holds no fixture code.
