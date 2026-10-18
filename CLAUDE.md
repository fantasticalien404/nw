# Agent Instructions

## Product

Build a private personal-wealth dashboard. Google Sheets is the single source of truth and manual data-entry layer. The Next.js application is read-only for financial data: it loads Sheets data, enriches it with cached market data and FX rates, performs analytics in the backend, and renders dashboards.

Do not add alternative databases or modify workbook data unless explicitly requested.

## Code standards

- Keep code minimal, linear, and readable. Prefer direct solutions over abstractions, fallbacks, or indirection.
- Keep modules small and scoped to one responsibility. Use explicit names and typed public boundaries.
- Add short English comments for non-obvious logic only. Comments must explain intent, inputs/outputs, source, scope, or important constraints when code alone does not make them clear.
- Do not add comments that merely restate the code.
- Preserve existing behavior unless the requested change explicitly alters it.

## Workbook contract

Tab names are lowercase and fixed:

- `cashflow`
- `assets`
- `categories`
- `metadata`
- `saa`
- `costants` (intentional spelling)

### `cashflow`

Header row, in this order:

`DATE`, `TYPE`, `NAME`, `AMOUNT`, `CURRENCY`, `CATEGORY`, `SUBCATEGORY`, `NOTES`.

The seventh header may be `CITY` as a legacy alias for `SUBCATEGORY`.

- `TYPE`: `income`, `expense`, or `contribution`.
- Amounts are non-negative. Type determines direction.
- `contribution` is an external inflow into the invested portfolio. Exclude it from income, spending, savings-rate, and category reporting; include it in performance cash-flow calculations.
- An investment withdrawal is `income` with category `withdrawal`. It is income for cashflow reports but an external portfolio outflow for performance calculations.
- `tax` is an `expense` category.
- Non-empty `CATEGORY` values must exactly match `categories.CATEGORY`; uncertain values stay blank and are counted as unclassified expenses.
- Purchases, sales, dividends, fees, and taxes managed inside the investment platform are not cashflow rows.

### `assets`

The first four headers are `ASSET`, `DATATYPE`, `CURRENCY`, `ACCOUNT`; remaining columns are ascending reporting-period dates.

- `DATATYPE` is `quantity`, `cash`, or `value`.
- `quantity`: units held. Value using the historical market price on the reporting period.
- `cash`: reported cash balance.
- `value`: reported value for non-ticker or manually valued assets.
- Convert every reporting-period value with the historical FX rate for that date.

### `categories`

Headers: `CATEGORY`, `PARENT_CATEGORY`, `IS_ESSENTIAL`, `IS_RECURRING`. `IS_ESSENTIAL` and `IS_RECURRING` are `TRUE` or blank. `CATEGORY` values are unique and are the only valid non-empty expense categories in `cashflow`.

### `metadata`

Headers: `TICKER`, `DISPLAY_NAME`, `FULL_NAME`, `CURRENCY`, `TER`, `ISSUER`.

`TICKER` identifies the corresponding `assets.ASSET` ticker. Every field except `DISPLAY_NAME` is required. Net-worth displays `DISPLAY_NAME` when supplied, otherwise `FULL_NAME`; it uses Yahoo Finance metadata only as a final fallback. Ticker symbols remain in a dedicated table column.

### `saa`

First headers: `ASSET_CLASS`, `INSTRUMENT`; remaining columns are ascending reporting-period dates. Values are non-negative target percentages. Targets do not need to total 100%; calculate drift independently for each target.

### `costants`

No header row. Column A is the key and column B is the value.

## Architecture and Methodology

### Data flow

```text
Google Sheets + data/market-data → lib/sheets + lib/market-data → lib/analytics → app route → components
```

- `lib/sheets` is the only location for Google Sheets I/O, schemas, date parsing, and workbook normalization.
- `lib/market-data` reads local price and FX files from `data/market-data`; it must not make runtime market-data requests.
- `lib/analytics` contains pure, deterministic report builders. Do not put I/O, React code, or environment access there.
- `src/app` pages are server components that compose loaders, market-data conversion, and analytics, then provide serializable reports to UI components.
- `src/components` renders the reports. Client components may own Recharts interaction state but never fetch financial data.

### Implemented routes

- `/networth`: parses `assets`, `metadata`, and `costants`; prices quantity rows with local historical/current prices; converts values using local historical/current FX; renders the net-worth trend and full reporting-period table.
- `/` (`/cashflow` redirects to it): parses `cashflow`, `categories`, and `costants`; converts each transaction to `CURRENCY_1` at its local historical FX rate; excludes contributions; reports the latest transaction year from January through December. Missing/future months are `null`, displayed as `—`, and charted as gaps.

### Calculation rules

- `quantity` assets are valued as quantity × downloaded local price; `cash` and `value` assets use reported values.
- Net-worth tables calculate totals independently in `CURRENCY_1`, `CURRENCY_2`, and `CURRENCY_3`; missing local prices are `—` and surface a warning.
- Cashflow expense aggregation is `CATEGORY → PARENT_CATEGORY`. Blank categories are never inferred.
- Cashflow savings are $income - expenses$ and saving rate is $savings / income$ when income is non-zero.
- Cashflow monthly averages include every month in the latest report year, including missing/future months as zero for the average, while the table continues to show those months as `—`.

### Libraries

- Next.js 16 App Router and React 19 for server/client UI boundaries.
- TypeScript for typed module boundaries.
- Tailwind CSS 4 for styling.
- Recharts for all interactive charts.
- `googleapis` for the service-account Google Sheets client.
- Yahoo Finance chart endpoint through the explicit downloader script; the application consumes only the downloaded JSON price store.
- `tsx` for the test runner and workbook validation, and ESLint for static checks.

### Required workflow

1. Update the workbook manually; never persist app-derived data back to Sheets.
2. Run `npm run download:market-data` after workbook changes and before running or deploying the application. It stores raw and dividend-adjusted daily prices, including required FX pairs, in `data/market-data`.
3. Run `npm run test:sheets` after any workbook/schema/parser change.
4. Keep downloader-only external I/O, calculations, and rendering in their respective layers.
5. Run `npm run lint`, `npx tsc --noEmit`, and `npm test` after code changes.
6. Do not print, commit, or expose environment values, spreadsheet identifiers, or service-account credentials.

## Authentication

Use Google OAuth. Do not implement a custom password flow.

Allow one or more approved accounts through a comma-separated `ALLOWED_EMAILS` value in `.env.local`. Normalize sign-in emails to lowercase and grant access only when the email is present in this allowlist. Never commit the allowlist or other environment values.

Unauthenticated users may access a privacy-preserving demo mode only:

- Blur all data on the income, expenses, and cashflow dashboard.
- Never expose real financial amounts, transaction rows, account names, asset quantities, or personally identifying information.
- Render other dashboards with relative/demo data. Use a fixed total portfolio value of $100{,}000$ solely to demonstrate allocation, charts, Monte Carlo scenarios, and risk analysis.
- Keep demo data separate from authenticated data, and enforce this separation in backend/API routes rather than only in the frontend.

## Backend and market data

- Keep Sheets parsing, market-data providers, analytics, and API routes separate.
- Download market-data and FX files with `npm run download:market-data`; do not fetch external data per frontend render.
- Use local historical prices and FX rates for reporting-period analytics.
- Keep the Yahoo download logic isolated in the script so its provider can be replaced without changing workbook schemas.

## Suggested project structure

```text
src/
  app/                    # Next.js routes, layouts, and API route handlers
    (dashboard)/          # Authenticated dashboard pages
    admin/                # Settings and data-quality views
    api/                  # Read-only JSON endpoints
  components/
    charts/               # Reusable chart components
    dashboard/            # Page-specific dashboard components
    ui/                   # Small generic UI primitives
  features/
    cashflow/             # Domain UI and view models
    net-worth/
    portfolio/
    simulations/
  lib/
    sheets/               # Google Sheets client, schema parsing, validation
    market-data/          # Local price and FX retrieval
    analytics/            # Pure financial calculations
    auth/                 # OAuth and allowlist checks
  types/                  # Shared domain and API types
scripts/                  # Workbook checks and market-data downloader
data/market-data/         # Downloaded ticker and FX price files
public/                   # Static assets
STYLE.MD                  # Frontend visual-system decisions
CLAUDE.md                 # Agent instructions and technical constraints
README.md                 # Product and workbook documentation
```

Keep Google Sheets I/O in `lib/sheets`, local price reads in `lib/market-data`, and Yahoo download I/O in `scripts/download-market-data.ts`. Keep calculations in pure `lib/analytics` functions. Do not put Google Sheets or market-data calls in React components.

## Frontend style

Follow [STYLE.MD](/Users/giacomomaggiore/Desktop/coding/nw/STYLE.MD) when it exists. It will define visual direction, typography, color, spacing, chart conventions, responsive behavior, and component patterns. Until then, keep UI choices simple, consistent, and accessible.

Use Recharts for every interactive data visualization.

## Dashboard scope

Primary pages:

1. Home overview: net worth, monthly cash flow, savings rate, portfolio value, allocation drift, FIRE progress.
2. Cashflow dashboard (`/cashflow`): keep contributions separate from income and expenses. Show all January–December months of the latest transaction year; missing/future values are `—`. Include income, parent-category expense, savings, and savings-rate tables with total and monthly-average columns. Monthly averages end at the previous month. Show monthly income/expense, parent-category area, savings-rate, and current-year cumulative income-versus-expense charts.
3. Net worth dashboard (`/nw`): show financial instruments, cash assets, and other assets in separate table sections. The first columns are asset name, ticker, and currency; subsequent columns are every assets reporting period up to the latest one with reported values (later columns are still empty and are omitted), plus a final current period that is compared with that latest valued period. The current period uses the latest downloaded prices; cash and manually valued assets use their latest reported values. Quantity rows use `metadata.DISPLAY_NAME`, then `metadata.FULL_NAME`. Use local historical prices and FX rates for historical periods. Show missing values as `—`; show a data-quality warning if local market data is unavailable. Add totals in `CURRENCY_1`, `CURRENCY_2`, and `CURRENCY_3`; if either secondary currency is absent or invalid, fill in order from `EUR`, `CHF`, and `USD`, excluding `CURRENCY_1`. Display plain numeric values without currency symbols; identify currency only in total-row labels and the current-net-worth heading. Under totals, display absolute and percentage period-over-period changes in `CURRENCY_1`. Include a benchmark comparison using financial instruments only (quantity assets): cash and manually valued assets are excluded. This assumes income distributions are reinvested in the tracked instruments; distributing ETF dividends held as broker cash understate portfolio returns. Missing local prices can understate financial totals, so refresh market data and review data-quality warnings before relying on results. Provide selectable 60/40 or 100% stocks, reporting currency and rebalancing interval, contributions invested at the start of the following month, withdrawals from `cashflow`, contribution markers, and annualized money-weighted IRR. Cashflows dated after the latest reported holdings are not replayed into the benchmark, because the current portfolio value still uses those holdings.
4. Portfolio performance and allocation: benchmark comparison, contributions, returns, target versus actual allocation, drift, and eventual look-through exposure.
5. Monte Carlo: FIRE success probability, terminal-value distribution, sequence-of-returns scenarios, Value at Risk, and configurable assumptions.
6. Admin/settings outside the main navbar: data refresh, constants, benchmark, cache, and data-quality checks.

## Validation and commands

- Required environment variables in `.env.local`: `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- Run `npm run download:market-data` after workbook changes and before running or deploying the app.
- Run `npm run test:sheets` after changes to Sheets parsing or workbook validation.
- Run `npm run lint` and `npm test` for code changes. Tests live in `tests/*.test.ts(x)` (`node:test` through `tsx`), use synthetic data only, and need no environment variables. Add or update a test with every parser, analytics, or market-data change.
- Do not print or commit environment values, service-account keys, or spreadsheet identifiers.
