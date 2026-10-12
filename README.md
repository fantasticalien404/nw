# Personal Wealth Management Platform

## Objective

Create a fully customizable personal-finance platform comprising:

- A Google Sheets workbook as the single source of truth and manual data-entry layer.
- A Next.js (or React) web application for visualization, analytics, reporting, and portfolio monitoring.
- Market-data APIs that enrich the portfolio with current prices, historical performance, exchange rates, and asset metadata.
- A private web interface accessible only to the owner.

### Design philosophy

Enter data manually once, store it in a simple and transparent format, and let the application calculate everything else automatically.

## Implemented Architecture

```text
Google Sheets (read-only from the app)
  ├── cashflow, categories, costants
  │       ↓ Sheets parsers + historical FX conversion
  │       ↓ pure cashflow analytics
  │       └── /cashflow server page → Recharts dashboard
  │
  └── assets, metadata, costants
          ↓ Sheets parsers + Yahoo historical/current prices and FX
          ↓ pure net-worth analytics
          └── /nw server page → table and trend chart
```

The application is a Next.js App Router project. Route pages are server components: they load and validate workbook data, call market-data adapters where necessary, build serializable reports, and pass those reports to small client chart components. React components never call Google Sheets or Yahoo Finance directly.

### Current implementation

| Route | Server workflow | UI |
| --- | --- | --- |
| `/nw` | Parse `assets`, `metadata`, and `costants`; price ticker holdings with Yahoo Finance; convert historical and current values to three reporting currencies | Net-worth trend, instrument/cash/other-assets table, totals, absolute and percentage changes |
| `/cashflow` | Parse `cashflow`, `categories`, and `costants`; convert transactions into `CURRENCY_1` using historical FX; aggregate in pure analytics | Income/expense trend, annual income and spending tables, category area chart, savings rate, and cumulative cashflow |

### Module boundaries

- `src/lib/sheets`: Google Sheets I/O, workbook header validation, parsing, and normalization.
- `src/lib/market-data`: Yahoo Finance adapter and cached historical/current price and FX lookup.
- `src/lib/analytics`: deterministic calculations only; no external I/O.
- `src/app`: server pages that compose loaders, market-data conversion, analytics, and views.
- `src/components`: presentational tables and client-side Recharts visualizations.
- `scripts/test-google-sheets.ts`: executable workbook-contract validation.

### Libraries

| Library | Role |
| --- | --- |
| Next.js 16 | App Router, server rendering, request caching |
| React 19 | UI composition and client chart components |
| TypeScript | Typed boundaries between parsing, analytics, and UI |
| Tailwind CSS 4 | Utility-first styling |
| Recharts | Interactive line and area charts |
| googleapis | Service-account Google Sheets client |
| TSX | TypeScript workbook-validation script runner |
| ESLint | Static code-quality checks |

## Google Sheets Structure

The Google Sheet serves as both the database and the manual data-entry interface. It stores all information required by the system.

### Tab 1: cashflow

Contains all income, expenses, and investment contributions. One row represents one transaction.

#### Structure

| DATE | TYPE | NAME | AMOUNT | CURRENCY | CATEGORY | SUBCATEGORY | NOTES |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |

`Type` is one of `income`, `expense`, or `contribution`. Amounts are non-negative; type determines the cash-flow direction. Expense categories must exactly match an entry in the `categories` tab; leave uncertain categories blank until they are assigned. Use `tax` as an `expense` category and `withdrawal` as an `income` category.

#### Investment cash flows

Use `contribution` when money enters the invested portfolio from outside it. Record the transaction date, amount, and currency. Contributions are used as external cash flows for performance calculations, but are balance transfers rather than expenses: exclude them from spending, income, savings-rate, and category reports.

Record money leaving the invested portfolio as an `income` transaction with the `withdrawal` category. The performance calculation treats this category as an external portfolio withdrawal, while income reporting includes it as income. Purchases, sales, dividends, fees, and taxes remain internal to the investment platform and are not recorded in `cashflow`.

#### Dashboard workflow

1. The app reads the transactions and excludes `contribution` rows from income, expense, savings, and category reporting.
2. Every transaction is converted to `CURRENCY_1` at the historical FX rate for its date.
3. The dashboard reports the latest transaction year and includes every January–December month. Missing or future months display as `—` and chart as gaps.
4. Income and expenses are aggregated monthly. Expense category aggregation uses `CATEGORY → PARENT_CATEGORY`; blank categories remain unclassified rather than being guessed.
5. Savings are $income - expenses$ and the monthly savings rate is $savings / income$ when income is non-zero.


### Tab 2: assets

The tab is divided into financial assets and accounts. Each row represents one asset or account, and each date column represents a reporting period.

The value in each reporting-period cell is interpreted according to `Datatype`:

- `quantity`: number of units held. For ticker-based financial products, the backend retrieves the historical market price for the reporting period and calculates market value as quantity × price.
- `cash`: reported cash balance.
- `value`: reported market value for non-ticker assets or manually valued assets.

#### Structure

| ASSET | DATATYPE | CURRENCY | ACCOUNT | Reporting Period | Reporting Period | ... |
| --- | --- | --- | --- | --- | --- | --- |

#### Example

| Asset | Datatype | Currency | Account | 01-01-2026 |
| --- | --- | --- | --- | --- |
| VT | quantity | USD | IB | 24 |
| Cash | cash | EUR | Unicredit Bank | 20000 |
| Cae | value | EUR | - | 1000 |

Historical FX rates are used to convert every reporting-period value to the base currency. The corresponding historical price is also used for `quantity` assets. Use ISO 4217 currency codes such as `USD`; `DOL` is accepted as a legacy alias for `USD`.



#### Purpose

- Cash allocation
- Net-worth reconstruction and trend tracking across reporting periods
- Liquidity monitoring
- Asset allocation
- Asset grouping
- Exposure reports
- Portfolio analytics

### Tab 3: metadata

Provides financial-instrument reference data. `TICKER` must match the `ASSET` value for a `quantity` row in `assets`. `DISPLAY_NAME` is optional; the net-worth table uses it when present, otherwise `FULL_NAME`, and falls back to Yahoo Finance only when neither is supplied. Instrument names link to the Yahoo Finance quote page.

| TICKER | DISPLAY_NAME | FULL_NAME | CURRENCY | TER | ISSUER |
| --- | --- | --- | --- | --- | --- |

### Tab 4: categories

A reference table for organizing expenses.

#### Structure

| CATEGORY | PARENT_CATEGORY |
| --- | --- |

#### Examples

| CATEGORY | PARENT_CATEGORY |
| --- | --- |
| Grocery | Food |
| Restaurants | Food |
| Rent | Housing |
| Utilities | Housing |
| Flights | Travel |

#### Purpose

- Expense reports
- Category breakdowns
- Budget analysis
- Long-term spending statistics

### Tab 5: saa

Contains historical target allocations. Unlike a static target, this time series allows the investment policy to evolve over time. Each reporting-period column contains the target percentage for the corresponding asset or instrument.

Targets do not need to total $100\%$. The allocation dashboard calculates drift against each target independently.

#### Structure

| ASSET_CLASS | INSTRUMENT | Reporting Period | Reporting Period | ... |
| --- | --- | --- | --- | --- |

#### Example

| ASSET_CLASS | INSTRUMENT | 01-01-2020 | 01-01-2021 |
| --- | --- | ---: | ---: |
| equities | VT | 0.9 | 0.8 |
| equities | VTI | 0.1 | 0.2 |

#### Purpose

- Drift analysis
- Rebalancing monitoring
- Historical policy tracking
- Portfolio governance

The dashboard always uses the latest target configuration applicable on each date.

### Tab 6: costants

Contains system-wide constants and settings. `CURRENCY_1` is required and drives cashflow reporting; `CURRENCY_2` and `CURRENCY_3` are optional secondary net-worth totals.

#### Structure

Each row has a constant key in column A and its value in column B; this tab has no header row.

#### Examples

| Key | Value |
| --- | --- |
| Base Currency | CHF |
| FIRE Target | 1,500,000 |
| Safe Withdrawal Rate | 0.04 |
| Inflation Assumption | 0.02 |

#### Purpose

Centralizes configuration and avoids hardcoded application parameters.

## Development Workflow

1. Enter or correct data in Google Sheets. The app never writes financial data to the workbook.
2. Keep `cashflow.CATEGORY` equal to a `categories.CATEGORY` value. Leave an uncertain category blank; do not guess a mapping.
3. Maintain instrument names and reference data in `metadata`; use `DISPLAY_NAME` only when a shorter dashboard label is desired.
4. Run workbook validation before working on dependent calculations or UI.
5. Keep external I/O in Sheets/market-data modules, calculations in analytics modules, and rendering in pages/components.
6. Validate code changes with linting and TypeScript before release.

## Workbook Validation

Run the Google Sheets validation after changing workbook data:

```bash
npm run test:sheets
```

The command requires `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` in `.env.local`. The current service account needs spreadsheet **Viewer** access because the product is read-only. It validates all six tabs:

- `cashflow`: required column names (case-insensitive); required values; allowed types; non-negative numeric amounts; three-letter uppercase currency codes; non-empty categories must exist in `categories`.
- `assets`: required columns; ascending Google Sheets reporting-period dates; allowed datatypes; non-negative values.
- `metadata`: `TICKER`, `DISPLAY_NAME`, `FULL_NAME`, `CURRENCY`, `TER`, and `ISSUER` columns; all fields except `DISPLAY_NAME` are required.
- `categories`: `CATEGORY` and `PARENT_CATEGORY` columns with values in every row.
- `saa`: `ASSET_CLASS` and `INSTRUMENT` columns; ascending reporting-period dates; non-negative targets without requiring a $100\%$ total.
- `costants`: no header row; a non-empty key and value in every row.

## Market Data Layer

The backend enriches portfolio holdings through external APIs.

### Possible data providers

| Provider | Data |
| --- | --- |
| Yahoo Finance | Current prices, historical prices, dividends |
| Financial Modeling Prep | Prices, ETFs, company data |
| Alpha Vantage | Market prices, FX rates |

Additional providers can be added later without changing the database structure.

## Backend Design

### Technology

- Next.js API routes, or
- A Node.js Express server

### Core Responsibilities

- **Load Google Sheets:** Retrieve all tabs.
- **Cache results:** Avoid excessive API calls.
- **Retrieve market data:** Load data for all currently held assets.
- **Compute analytics:** Calculate net worth, asset allocation, savings rate, returns, monthly spending, and regional exposure.
- **Serve the frontend:** Expose clean API endpoints.

### Suggested API Endpoints

| Area | Endpoint | Returns |
| --- | --- | --- |
| Portfolio | `/api/portfolio/current` | Current holdings, market values, allocation |
| Net worth | `/api/networth/history` | Historical net worth, cash, investments, total assets |
| Spending | `/api/spending/monthly` | Monthly expenses |
| Spending by category | `/api/spending/categories` | Category breakdowns |
| Savings rate | `/api/savings-rate` | Monthly savings rates, rolling averages |
| Allocation | `/api/allocation` | Actual allocation, target allocation, drift |
| Performance | `/api/performance` | Cumulative returns, portfolio growth, contribution analysis |

## Frontend Dashboard

### Technology

- Next.js
- React
- TypeScript
- Tailwind CSS

### Authentication

Recommended approach: Google sign-in restricted to the approved Google account.

An alternative is a password-protected site, which is simpler to implement.

### Dashboard Sections

| Section | Displays | Charts |
| --- | --- | --- |
| Home | Net worth, monthly savings, current portfolio value, cash position | — |
| Portfolio | Holdings, allocation, exposure, performance | Pie chart, allocation trend, value evolution |
| Net Worth | Historical net worth, asset growth, capital accumulation | Net-worth evolution, cash vs. investments |
| Spending | Monthly expenses, spending categories, long-term trends | Category breakdown, monthly spending, year-over-year comparisons |
| Income | Salary, dividends, other income sources | Income history, income composition |
| Allocation | Current allocation, target allocation, allocation drift | Stacked allocation history, actual vs. target |
| Analytics | Advanced metrics | — |

### Analytics Metrics

- Savings rate
- Portfolio growth
- Net-worth growth
- Asset-allocation drift
- Dividend income
- Cash ratio
- Equity ratio
- FIRE progress
- Invested capital
- Total gain
- Gain versus contributions

## Advantages of This Architecture

- **Simplicity:** Data entry is as simple as updating Google Sheets.
- **Flexibility:** The dashboard can evolve independently of the database.
- **Low cost:** Google Sheets and Vercel are effectively free for personal use.
- **Full ownership:** There is no dependency on third-party personal-finance applications.
- **Transparency:** All data remains visible and editable.
- **Extensibility:** Future integrations can include IBKR imports, dividend tracking, tax reporting, crypto tracking, real-estate tracking, budgeting modules, and AI-assisted insights.

## Final Design Principles

- Google Sheets is the single source of truth.
- Each piece of information is entered manually only once.
- All aggregations and calculations occur in the backend.
- The dashboard is read-only from an analytics perspective.
- Market prices are retrieved automatically through APIs.
- Asset-allocation targets are stored historically as a time series.
- The architecture must remain maintainable for decades with minimal manual effort.
# nw
