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
- `saa`
- `costants` (intentional spelling)

### `cashflow`

Header row, in this order:

`DATE`, `TYPE`, `NAME`, `AMOUNT`, `CURRENCY`, `CATEGORY`, `SUBCATEGORY`, `NOTES`.

- `TYPE`: `income`, `expense`, or `contribution`.
- Amounts are positive. Type determines direction.
- `contribution` is an external inflow into the invested portfolio. Exclude it from income, spending, savings-rate, and category reporting; include it in performance cash-flow calculations.
- An investment withdrawal is `income` with category `withdrawal`. It is income for cashflow reports but an external portfolio outflow for performance calculations.
- `tax` is an `expense` category.
- Purchases, sales, dividends, fees, and taxes managed inside the investment platform are not cashflow rows.

### `assets`

The first four headers are `ASSET`, `DATATYPE`, `CURRENCY`, `ACCOUNT`; remaining columns are ascending reporting-period dates.

- `DATATYPE` is `quantity`, `cash`, or `value`.
- `quantity`: units held. Value using the historical market price on the reporting period.
- `cash`: reported cash balance.
- `value`: reported value for non-ticker or manually valued assets.
- Convert every reporting-period value with the historical FX rate for that date.

### `categories`

Headers: `CATEGORY`, `PARENT_CATEGORY`.

### `saa`

First headers: `ASSET_CLASS`, `INSTRUMENT`; remaining columns are ascending reporting-period dates. Values are non-negative target percentages. Targets do not need to total 100%; calculate drift independently for each target.

### `costants`

No header row. Column A is the key and column B is the value.

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
- Cache market-data and FX requests; do not fetch external data per frontend render.
- Use historical prices and FX rates for reporting-period analytics.
- Use provider adapters so Yahoo Finance or another provider can be replaced without changing workbook schemas.

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
    market-data/          # Provider adapters, cache, price and FX retrieval
    analytics/            # Pure financial calculations
    auth/                 # OAuth and allowlist checks
  types/                  # Shared domain and API types
scripts/                  # Workbook checks and maintenance scripts
public/                   # Static assets
STYLE.MD                  # Frontend visual-system decisions
CLAUDE.md                 # Agent instructions and technical constraints
README.md                 # Product and workbook documentation
```

Keep external I/O in `lib/sheets`, `lib/market-data`, and route handlers. Keep calculations in pure `lib/analytics` functions. Do not put Google Sheets or market-data calls in React components.

## Frontend style

Follow [STYLE.MD](/Users/giacomomaggiore/Desktop/coding/nw/STYLE.MD) when it exists. It will define visual direction, typography, color, spacing, chart conventions, responsive behavior, and component patterns. Until then, keep UI choices simple, consistent, and accessible.

Use Recharts for every interactive data visualization.

## Dashboard scope

Primary pages:

1. Home overview: net worth, monthly cash flow, savings rate, portfolio value, allocation drift, FIRE progress.
2. Income, expenses, and cashflow dashboard: keep contributions separate from income and expenses.
3. Net worth dashboard (`/nw`): show financial instruments, cash assets, and other assets in separate table sections. First columns are asset and currency; subsequent columns are every assets reporting period plus a final current period. The current period uses latest Yahoo Finance prices; cash and manually valued assets use their latest reported values. Use historical Yahoo prices and FX rates for historical periods. Show missing values as `—`; show a data-quality warning if Yahoo data is unavailable. Add totals in `CURRENCY_1`, `CURRENCY_2`, and `CURRENCY_3`; if either secondary currency is absent or invalid, fill in order from `EUR`, `CHF`, and `USD`, excluding `CURRENCY_1`. Display plain numeric values without currency symbols; identify currency only in total-row labels and the current-net-worth heading. Under totals, display the absolute change for every reporting period in `CURRENCY_1`, calculated as the period total minus the immediately preceding period total. 
4. Portfolio performance and allocation: benchmark comparison, contributions, returns, target versus actual allocation, drift, and eventual look-through exposure.
5. Monte Carlo: FIRE success probability, terminal-value distribution, sequence-of-returns scenarios, Value at Risk, and configurable assumptions.
6. Admin/settings outside the main navbar: data refresh, constants, benchmark, cache, and data-quality checks.

## Validation and commands

- Required environment variables in `.env.local`: `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- Run `npm run test:sheets` after changes to Sheets parsing or workbook validation.
- Run `npm run lint` for code changes.
- Do not print or commit environment values, service-account keys, or spreadsheet identifiers.
