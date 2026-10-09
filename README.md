# Personal Wealth Management Platform

## Objective

Create a fully customizable personal-finance platform comprising:

- A Google Sheets workbook as the single source of truth and manual data-entry layer.
- A Next.js (or React) web application for visualization, analytics, reporting, and portfolio monitoring.
- Market-data APIs that enrich the portfolio with current prices, historical performance, exchange rates, and asset metadata.
- A private web interface accessible only to the owner.

### Design philosophy

Enter data manually once, store it in a simple and transparent format, and let the application calculate everything else automatically.

## High-Level Architecture

```text
┌──────────────────┐
│  Google Sheets   │
│ (Data Entry DB)  │
└────────┬─────────┘
         │ Google Sheets API
         ▼
┌──────────────────┐
│ Next.js Backend  │
│   API Routes     │
└────────┬─────────┘
         │
┌────────┼───────────────┐
│        │               │
▼        ▼               ▼
Market    FX Rates API   Asset Metadata
Data API
│
▼
┌──────────────────┐
│ Analytics Layer  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ React Dashboard  │
└──────────────────┘
```

## Google Sheets Structure

The Google Sheet serves as both the database and the manual data-entry interface. It stores all information required by the system.

### Tab 1: cashflow

Contains all income, expenses, and investment contributions. One row represents one transaction.

#### Structure

| DATE | TYPE | NAME | AMOUNT | CURRENCY | CATEGORY | SUBCATEGORY | NOTES |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |

`Type` is one of `income`, `expense`, or `contribution`. Amounts are always positive; type determines the cash-flow direction. Use `tax` as an `expense` category and `withdrawal` as an `income` category.

#### Investment cash flows

Use `contribution` when money enters the invested portfolio from outside it. Record the transaction date, amount, and currency. Contributions are used as external cash flows for performance calculations, but are balance transfers rather than expenses: exclude them from spending, income, savings-rate, and category reports.

Record money leaving the invested portfolio as an `income` transaction with the `withdrawal` category. The performance calculation treats this category as an external portfolio withdrawal, while income reporting includes it as income. Purchases, sales, dividends, fees, and taxes remain internal to the investment platform and are not recorded in `cashflow`.

#### Purpose

- Expense tracking
- Income tracking
- Savings-rate calculation
- Monthly cash-flow analysis
- Investment cash-flow tracking
- Spending categories
- Historical trends
- Sankey visualizations


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

### Tab 3: categories

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

### Tab 4: saa

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

### Tab 5: costants

Contains system-wide constants and settings.

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

## Workbook Validation

Run the Google Sheets validation after changing workbook data:

```bash
npm run test:sheets
```

The command requires `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` in `.env.local`. It validates all five tabs:

- `cashflow`: required column names (case-insensitive); required values; allowed types; positive numeric amounts; three-letter uppercase currency codes.
- `assets`: required columns; ascending Google Sheets reporting-period dates; allowed datatypes; non-negative values.
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
