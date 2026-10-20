# Personal Wealth Management Platform

## Objective

A private, fully customizable personal-finance dashboard made of:

- A Google Sheets workbook as the single source of truth and the manual data-entry layer.
- A Next.js web application that reads the workbook, enriches it with local market data, runs the analytics on the server and renders dashboards.
- Local market-data files (`data/market-data`) with downloaded prices, dividend-adjusted prices and exchange rates.

### Design philosophy

Enter data manually once, store it in a simple and transparent format, and let the application calculate everything else. The application is read-only for financial data: it never writes anything back to the workbook, and it has no database of its own.

## Status

| Area | State |
| --- | --- |
| `/` cashflow dashboard (`/cashflow` redirects here) | Implemented: monthly report in three currencies, summary table, expense insights with filters, charts |
| `/networth` dashboard | Implemented: trend, asset table, benchmark comparison, growth sources, hall of fame, net worth by currency |
| Workbook parsing and contract validation | Implemented (`npm run test:sheets`) |
| Market-data downloader and local price store | Implemented (`npm run download:market-data`); the app also tops up stale files at runtime (see [Market data](#market-data)) |
| Test suite | 154 tests, synthetic data only (`npm test`) |
| `/saa`, `/montecarlo`, `/docs` | Placeholders ("Coming soon") |
| Authentication and demo mode | **Not implemented.** Do not deploy before adding Google OAuth with the allowlist (see CLAUDE.md) |
| API routes | Not implemented; pages are server components that call the loaders directly |
| Benchmark metrics (IRR, Sharpe, drawdown, ...) | Calculated in the analytics layer; not rendered yet |

Known defects and the backlog live in [TODO.md](TODO.md). The agent instructions and the product contract live in [CLAUDE.md](CLAUDE.md); the visual rules in [STYLE.MD](STYLE.MD).

## Architecture

```text
Google Sheets (read-only)                         data/market-data/*.json
  │                                                  ▲ npm run download:market-data (Yahoo Finance)
  │ lib/sheets: client, parsers, validation          │
  ▼                                                  │
typed workbook (cashflow / net worth)  ──►  lib/market-data: prices, FX, valuation, conversion
                                                     │
                                                     ▼
                                          lib/analytics: pure, deterministic reports
                                                     │
                                                     ▼
                    src/app: server pages and loaders ──►  src/components: tables and Recharts
```

Rules that keep the layers apart:

- `src/lib/sheets` is the only place that talks to Google Sheets. It parses and validates; it does not calculate.
- `src/lib/market-data` reads the local price files and converts workbook data into valued, single-currency inputs. Yahoo Finance is called by the downloader script and by one runtime top-up path in `prices.ts`.
- `src/lib/analytics` contains pure functions: no I/O, no React, no environment access.
- Route pages are server components. A loader (`load-*-page.ts`) composes workbook loading, market-data conversion and analytics, and hands serializable reports to client components.
- Client components own only interaction state (filters, legends, toggles). They never fetch financial data.

### Request lifecycle

1. The page calls `await connection()`, so it is rendered per request. There is no cache: every page load re-reads the workbook and the price files.
2. The loader reads the needed tabs in parallel with one Sheets call per range and parses them into typed workbooks.
3. A fresh market-data object is created for the request. It reads each price file at most once and answers every later lookup from memory.
4. Workbook values are priced and converted, then the analytics build the reports.
5. The page renders. If a step fails, the page shows the error message in a bordered box instead of the dashboard. On `/networth` the cashflow-dependent sections fail separately and leave the rest intact (see [Failure handling](#failure-handling)).

### Module boundaries

| Path | Responsibility |
| --- | --- |
| `src/lib/sheets/client.ts` | Service-account Google Sheets client; reads A1 ranges with unformatted values (the only Sheets I/O) |
| `src/lib/sheets/cashflow.ts`, `net-worth.ts`, `parse.ts` | Pure tab parsers and normalization (dates, currencies, headers, constants) |
| `src/lib/sheets/validate.ts` | Contract checks behind `npm run test:sheets`; reports every problem with row numbers |
| `src/lib/market-data/prices.ts` | Local price and FX store: reads files, optional top-up, price and FX lookups |
| `src/lib/market-data/net-worth.ts` | Values every asset per period and currency; price changes for the growth sources |
| `src/lib/market-data/cashflow.ts` | Converts transactions to a reporting currency at their own date |
| `src/lib/market-data/benchmark.ts` | Daily benchmark prices (ACWI, BND) in a report currency |
| `src/lib/market-data/symbols.ts` | Every symbol the dashboards need (tickers, benchmark ETFs, FX pairs) |
| `src/lib/market-data/yahoo.ts` | Yahoo Finance chart-endpoint client |
| `src/lib/analytics/net-worth.ts` | Totals, period changes and growth sources |
| `src/lib/analytics/benchmark.ts` | Benchmark simulation, Modified Dietz returns, XIRR and risk metrics |
| `src/lib/analytics/hall-of-fame.ts` | Monthly rankings |
| `src/lib/analytics/cashflow.ts` | Monthly cashflow report and moving-average series |
| `src/lib/analytics/cashflow-insights.ts` | Calculations behind the expense filters and insight charts |
| `src/lib/dates.ts`, `format.ts`, `sets.ts` | UTC date helpers, display formatting (plain numbers, `—` for missing), small set helper |
| `src/types` | Domain types shared by the layers |
| `src/app` | Routes, page loaders and the read-only server pages |
| `src/components` | Tables and Recharts charts; `charts/chart-style.ts` holds the shared chart styling, `ui/` the shared filters |
| `scripts` | `download-market-data.ts` (price store refresh) and `test-google-sheets.ts` (workbook validation) |
| `tests` | The `node:test` suite and its synthetic fixtures |

## Workflow

### Routine (after changing the workbook)

1. **Update the workbook by hand.** Add transactions to `cashflow`; add a new reporting-period column to `assets` with the quantities, cash balances and manual values. Keep `cashflow.CATEGORY` equal to a `categories.CATEGORY` value, or blank when unsure. Add new tickers to `metadata`. The app never writes to the workbook.
2. **`npm run test:sheets`.** Reads all six tabs from the live workbook, checks the contract (headers, types, currencies, ascending dates, known categories, required metadata) and then runs the app's own parsers on the same rows, so the check cannot pass while a page would fail. It needs `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` in `.env.local`; the service account needs Viewer access.
3. **`npm run download:market-data`.** Reads both workbooks to find every symbol, then downloads the full history from the earliest workbook date through today for each one, and overwrites its file in `data/market-data`. It pauses 500 ms between symbols. Run it after workbook changes, when a new ticker or currency appears, and before deploying.
4. **`npm run dev`** (runs `test:sheets` first, then `next dev`) or `npm run build && npm start`. Open `/` for cashflow and `/networth` for net worth.

Reporting periods: the `assets` tab may contain empty columns for future periods. They are ignored until some asset has a value in them, so you can pre-create the year's columns.

### Before committing code

```bash
npm run lint
npx tsc --noEmit
npm test
```

Add or update a test with every change to a parser, an analytics function or the market-data layer. Run `npm run test:sheets` after any workbook, schema or parser change. Never print or commit environment values, the spreadsheet id or service-account credentials, and never write real workbook data to disk when debugging.

## Market data

### The local store

`data/market-data` holds one JSON file per symbol, named with `encodeURIComponent(symbol)`, for example `ACWI.json` and `USDEUR%3DX.json`. A file contains the symbol, a download timestamp and daily rows with the raw `close` and the dividend-adjusted `adjustedClose` (null when the provider has none).

The downloader requests, for every run:

- Every `assets.ASSET` whose datatype is `quantity` (the ticker).
- `ACWI` and `BND` for the benchmark.
- An FX pair `FROMTO=X` from every currency found in the workbooks (report currencies, asset currencies, transaction currencies) to every reporting currency, so every conversion can be answered directly, without inverting or chaining rates.

Replacing Yahoo means changing `scripts/download-market-data.ts` and `lib/market-data/yahoo.ts` while keeping this file format.

### Lookups

- **Price or FX on a date:** the close of the first trading day on or after the date. Weekend and holiday dates therefore use the next trading day. A date after the last row uses the latest close, and a date before the first row uses the first close.
- **Latest price or FX:** the last row of the series.
- **Raw closes** value the net-worth table and convert currencies. **Adjusted closes** (total return) drive the benchmark and the year-to-date column.
- A missing or corrupt file raises `Download market data for <symbol> with npm run download:market-data.`

### Runtime top-up

When a file's last date is before today, `prices.ts` requests the missing days from Yahoo once per symbol per request and merges them in memory. Nothing is written to disk. If the request fails, the local rows are used silently. This is a deviation from the "no runtime market-data requests" rule in CLAUDE.md: it keeps the "current" column fresh without running the downloader, but it makes weekend and holiday renders issue requests and can merge re-based adjusted closes into older rows. It is tracked in [TODO.md](TODO.md); run the downloader regularly instead of relying on it.

## Backend logic in detail

### Reading and parsing the workbook

- Ranges read: `cashflow!A:H`, `categories!A:D`, `costants!A:B`, `assets!A:Z` (at most 22 reporting-period columns), `metadata!A:F`.
- Dates arrive as Google Sheets serial numbers and become ISO `YYYY-MM-DD` strings. Every date in the app is a UTC calendar day, never local time.
- Headers are matched case-insensitively. The seventh `cashflow` header may be `CITY`, a legacy alias for `SUBCATEGORY`. `DOL` is accepted as a legacy alias for `USD`.
- Parsers throw on the first problem (for example an unknown category on a row); `test:sheets` reports all of them.
- **Report currencies.** Cashflow: `CURRENCY_1..3` from `costants`, valid three-letter codes, unique, in order (at least `CURRENCY_1`). Net worth: `CURRENCY_1` first, then `CURRENCY_2` and `CURRENCY_3`, then `EUR`, `CHF`, `USD` (excluding duplicates) to fill up to three; only these three currencies are supported there.

### Net-worth valuation (`valueNetWorth`)

1. The **latest reporting period** is the last `assets` column in which any asset has a value. Later columns are empty and are dropped. The periods used are every column up to it, plus the **current date**, which always comes last.
2. For each asset and period, the reported cell is read. A blank cell means no value (`null`).
   - `quantity`: quantity × the close on or after the period date.
   - `cash` and `value`: the reported number.
   - **Current period:** the latest reported quantity or balance (from the latest reporting period) × the latest close.
3. Each value is converted into every report currency with the FX rate of the same date (latest rate for Current).
4. A lookup that fails (missing file, no price) gives `null` and a data-quality warning; the remaining assets are unaffected. Warnings are de-duplicated and shown above the table.

### Net-worth reports

- **Totals** are computed independently in each report currency: the sum of all non-null converted values of the period, split into financial instruments, cash and other assets. A total is `null` only when no asset has a value. Missing values are skipped, not counted as zero, so a missing price understates a total; the warning says so.
- **Change rows** compare each period with the previous one in the first report currency: absolute change, and percentage change when the previous total is non-zero. Current is compared with the last valued period.
- **Summary table columns** (`netWorthYearColumns`): always January to December of the year chosen in the dropdown, one column per month. A month shows the report period dated in it, or `—` when there is none (a gap in the `assets` columns, a year before the first period, months after the latest reported one). The current period is a separate `Current` column after December, shown only when the current date is in the selected year; it never fills a month column. The change rows keep comparing each period with the previous report period, not with the previous calendar month.
- **YTD %** per instrument: the dividend-adjusted close from the first trading day of the year to the latest close, with the FX rate of the first day and the latest FX rate, in the selected currency. It is `null` for cash and manual assets.
- **Growth sources** (per period, per currency):
  - *Salary*: income transactions categorized `salary` dated in (previous period, period].
  - *Financial assets*: for each quantity asset, (end price − start price) × holdings at the start of the period, summed and converted at the start-of-period FX rate. A missing price or rate makes the period `null`.
  - *Total increase*: the actual change of the total net worth. The two sources are explanatory, not an exact decomposition: contributions, other income, expenses and currency moves are not part of them.
- **Hall of fame**: twelve monthly rankings (best income, salary, net-worth change, savings and savings rate; highest and lowest expenses; worst net-worth change), each top ten plus the current month's value. Months run from the earliest of the first reporting period and the first transaction through the current month. Income and expenses are converted per transaction at its own date; rankings use CHF and EUR whatever the report currencies are. The current month is partial.

### Benchmark engine

The comparison covers the **financial-instruments portfolio only** (`quantity` rows): cash and manually valued assets are excluded. Two benchmarks are simulated at once, **60/40** (60% ACWI, 40% BND) and **100% stocks** (ACWI), with a selectable rebalancing interval (monthly by default, quarterly, yearly). Benchmark prices are dividend-adjusted closes converted daily into the selected report currency.

External flows come from `cashflow`:

- A `contribution` enters the portfolio at the **start of the following month** and is invested in the benchmark on the first close on or after that date.
- An `income` row with the `withdrawal` category leaves the portfolio on its own date. It is also income for cashflow reports.
- Flows after the **latest reported holdings** are not replayed. The Current portfolio value reuses those holdings, so a contribution invested later is not in the portfolio yet; including it would inflate the benchmark.
- Purchases, sales, dividends, fees and taxes inside the platform are internal and never recorded in `cashflow`. The portfolio-return series assumes distributions are reinvested in the tracked instruments, so ETF dividends held as broker cash understate returns.

The benchmark starts with the value of the first non-null portfolio snapshot and replays the same flows. A flow on a snapshot date counts in that snapshot; rebalancing happens once the chosen number of calendar months has passed since the last one.

Metrics (computed by `buildBenchmarkComparison`; not displayed yet) use the interval returns between the portfolio's non-null snapshots. Each interval return is a Modified Dietz return:

$$
r = \frac{V_{end} - V_{start} - \sum CF}{V_{start} + \sum(CF \cdot w)}
$$

where $w$ is the fraction of the interval for which a flow was invested (a flow on the end date has $w = 0$).

- **Growth:** compounded product of the interval returns.
- **IRR:** annualized money-weighted return (XIRR) over the first value, every flow and the last value, solved by bisection.
- **Volatility:** sample standard deviation of interval returns × $\sqrt{12}$ (monthly snapshots).
- **Sharpe ratio:** mean interval return over its standard deviation × $\sqrt{12}$, with a zero risk-free rate.
- **Maximum drawdown:** worst fall from the peak of the flow-free cumulative index.
- **Best / worst month:** highest and lowest interval return.

### Cashflow pipeline

1. Every transaction is converted into each reporting currency at the FX rate of its own date.
2. `contribution` rows are excluded from income, spending, savings-rate and category reports. They matter only to the benchmark.
3. `buildCashflowReport` buckets income and expenses by month from the first to the last transaction. A month with no transaction has all-`null` values: tables show `—` and charts show a gap. Income is also grouped by category; expenses by category and by parent category (`CATEGORY → PARENT_CATEGORY`); salary is income categorized `salary`. Expenses with a blank category are never inferred: they count in totals and in `unclassifiedExpenses`, but not in any category row.
4. Savings are $income - expenses$; the savings rate is $savings / income$ when income is non-zero.
5. `periodsInRange` returns one period per month in a date range, filling months without data with `null` periods.

### Cashflow summary table

- Always shows all twelve months, January to December, of the year chosen in the dropdown (the latest transaction year by default), with a Total column and a Monthly avg column. Months without data show `—`; the date-range and currency filters never change the columns.
- Totals sum the months that have data. The total savings rate is total savings over total income.
- Monthly averages cover the months up to the previous month (the current month is still in progress); months in that window without data count as zero. The savings-rate average is the mean of the monthly rates that exist.
- Rows: income by category, expenses by parent category, two "no rent" variants, expenses, savings and savings rate.

### Expense insights and filters

The insights section works on the categorized expense transactions of the selected report currency.

- **Date range** (shared with the trend chart): quick ranges All time, YTD, Current year, Last year, or explicit From/To dates. Insights never look past today; an empty or reversed range selects nothing.
- **Month** filter: keep only one calendar month in every year of the range.
- **Classification**: all, essential, discretionary (not essential), recurring, non-recurring.
- **Parent categories** and **categories**: checkbox menus. Both apply together (an expense must match both); an empty selection means no filter.
- From the selection the app derives the totals tiles (total, daily average over the selected days, salary, essential, discretionary, recurring), the monthly stacked category chart, the essential/discretionary/recurring charts, the savings-rate chart and the cumulative salary-versus-expenses chart. The savings rate is the month's income against the *selected* expenses.
- The **category chart** draws only groups with expenses in the selection, largest first, with 12 distinct colours; beyond 12 groups the smallest are merged into one grey series. Clicking a legend entry hides a series.
- The **moving average** chart and table are independent of the filters: they use every expense up to the end of the previous month and a window of 1 or more days.
- The **historical expenses** chart follows one category or one parent category month by month, optionally next to salary.

### Failure handling

- Workbook or market-data errors on `/` show the error message instead of the dashboard.
- On `/networth`, a missing price or FX rate becomes a `—` cell plus a warning. If the cashflow side or the benchmark prices cannot be loaded, the growth table, rankings and benchmark comparison degrade on their own and a single warning is added, while the report itself still renders.

## Frontend

- **Net worth.** Header with the current net worth in the selected currency; trend chart with currency buttons, date-range filters and the change since the first period; the asset table (instruments, cash and other assets with subtotals, totals in every report currency, absolute and percentage change, a year selector that picks the year of its fixed January–December columns, and the YTD column); the benchmark comparison with contribution markers and the methodology dialog; the growth sources chart with an optional summary table; the hall of fame; net worth in all currencies on one axis. The range filter applies to the charts, not to the table (its own year selector) or the hall of fame.
- **Cashflow.** Currency buttons and the date range at the top; monthly income, expenses and salary trend; the summary table; the expense insights; the historical expenses chart.
- **Conventions** (STYLE.MD): plain numbers without currency symbols (the currency appears in headings, total rows and tooltips), `—` for missing values, grey-bordered tables with a light-grey header, no CSS animations, restrained hover tooltips.
- **Responsive behaviour.** Charts use Recharts `ResponsiveContainer`. Wide tables have a minimum width per period column and scroll horizontally inside their frame on narrow screens. The server passes the reporting date to the cashflow dashboard so the first render and hydration agree.

## Google Sheets Structure

The Google Sheet serves as both the database and the manual data-entry interface. Tab names are lowercase and fixed: `cashflow`, `assets`, `categories`, `metadata`, `saa`, `costants` (intentional spelling).

### Tab 1: cashflow

Contains all income, expenses and investment contributions. One row represents one transaction.

#### Structure

| DATE | TYPE | NAME | AMOUNT | CURRENCY | CATEGORY | SUBCATEGORY | NOTES |
| --- | --- | --- | ---: | --- | --- | --- | --- |

`TYPE` is one of `income`, `expense` or `contribution`. Amounts are non-negative; the type determines the direction. Expense categories must exactly match an entry in `categories`; leave uncertain categories blank until they are assigned. Use `tax` as an `expense` category and `withdrawal` as an `income` category.

#### Investment cash flows

Use `contribution` when money enters the invested portfolio from outside it. Contributions are external cash flows for performance calculations but balance transfers, not expenses: they are excluded from spending, income, savings-rate and category reports.

Record money leaving the invested portfolio as an `income` transaction with the `withdrawal` category. Performance calculations treat it as an external withdrawal while income reporting counts it as income. Purchases, sales, dividends, fees and taxes remain internal to the investment platform and are not recorded in `cashflow`.

### Tab 2: assets

Each row is one asset or account; each date column is a reporting period (ascending dates). The reported value is interpreted by `DATATYPE`:

- `quantity`: units held. The backend values them with the historical market price of the reporting period (quantity × price).
- `cash`: reported cash balance.
- `value`: reported value of a non-ticker or manually valued asset.

#### Structure

| ASSET | DATATYPE | CURRENCY | ACCOUNT | Reporting Period | Reporting Period | ... |
| --- | --- | --- | --- | --- | --- | --- |

#### Example

| Asset | Datatype | Currency | Account | 01-01-2026 |
| --- | --- | --- | --- | --- |
| VT | quantity | USD | IB | 24 |
| Cash | cash | EUR | Unicredit Bank | 20000 |
| Cae | value | EUR | - | 1000 |

Every value is converted with the historical FX rate of its date. Use ISO 4217 codes such as `USD`. Columns after the latest period that has any value are ignored.

### Tab 3: metadata

Instrument reference data. `TICKER` must match the `ASSET` of a `quantity` row in `assets`. `DISPLAY_NAME` is optional: the net-worth table uses it when present, otherwise `FULL_NAME`. Instrument names link to their Yahoo Finance quote page.

| TICKER | DISPLAY_NAME | FULL_NAME | CURRENCY | TER | ISSUER |
| --- | --- | --- | --- | --- | --- |

### Tab 4: categories

A reference table for organizing expenses (and the income categories used in `cashflow`).

| CATEGORY | PARENT_CATEGORY | IS_ESSENTIAL | IS_RECURRING |
| --- | --- | --- | --- |
| Grocery | Food | TRUE | TRUE |
| Restaurants | Food |  |  |
| Rent | Housing | TRUE | TRUE |
| Flights | Travel |  |  |

`IS_ESSENTIAL` and `IS_RECURRING` accept `TRUE` or blank (blank means false). `CATEGORY` values are unique.

### Tab 5: saa

Historical target allocations: one time series per instrument, so the policy can change over time. Targets do not need to total $100\%$; drift is calculated against each target independently. The SAA page is not built yet.

| ASSET_CLASS | INSTRUMENT | 01-01-2020 | 01-01-2021 |
| --- | --- | ---: | ---: |
| equities | VT | 0.9 | 0.8 |
| equities | VTI | 0.1 | 0.2 |

### Tab 6: costants

System-wide constants. Each row has a key in column A and its value in column B; there is no header row. `CURRENCY_1` is required; `CURRENCY_2` and `CURRENCY_3` are optional.

| Key | Value |
| --- | --- |
| CURRENCY_1 | CHF |
| CURRENCY_2 | EUR |
| CURRENCY_3 | USD |

## Tests and validation

```bash
npm test            # node:test suite through tsx
npm run test:sheets # live workbook contract check
```

`npm test` runs 17 test files in `tests/`. It needs no environment variables and never touches Google Sheets, the real `data/market-data` files or the network: tab parsers take plain arrays, market-data tests use a temporary directory and a stubbed `fetch`, and the dashboards are rendered from synthetic reports. It covers parsing, validation, valuation, analytics, the benchmark, the hall of fame, the filters, the page loaders and the dashboard render.

`npm run test:sheets` checks, per tab:

- `cashflow`: required columns; required values; allowed types; non-negative amounts; three-letter currency codes; known categories.
- `assets`: required columns; ascending Google Sheets dates; allowed datatypes; numeric values.
- `metadata`: required columns; every field except `DISPLAY_NAME` is required.
- `categories`: required columns and values; boolean `TRUE`/blank flags; no duplicates.
- `saa`: required columns; ascending dates; non-negative targets.
- `costants`: no header row; a non-empty key and value on every row.

## Libraries

| Library | Role |
| --- | --- |
| Next.js 16 | App Router, server rendering |
| React 19 | UI composition and client chart components |
| TypeScript | Typed boundaries between parsing, analytics and UI |
| Tailwind CSS 4 | Styling |
| Recharts | Every interactive chart |
| googleapis | Service-account Google Sheets client |
| tsx | Test runner and script runner |
| ESLint | Static code-quality checks |

## Planned

Not built yet; see [CLAUDE.md](CLAUDE.md) for the full product scope and [TODO.md](TODO.md) for the backlog.

- Google OAuth restricted to an `ALLOWED_EMAILS` allowlist, plus a demo mode that blurs cashflow and shows only relative data elsewhere, enforced in the backend.
- Home overview, SAA allocation and drift, Monte Carlo and FIRE analysis, admin and data-quality pages.
- Read-only JSON API routes (portfolio, net-worth history, spending, allocation, performance), if they are wanted.

## Design principles

- Google Sheets is the single source of truth, and each piece of information is entered once.
- All aggregation and calculation happens on the server, in pure analytics functions.
- The dashboards are read-only: nothing derived by the app is written back to the workbook.
- Market data comes from local files refreshed by an explicit command.
- Asset-allocation targets are stored historically as a time series.
- The code stays small and linear so it remains maintainable for decades with little effort.
