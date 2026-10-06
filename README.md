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

### Tab 1: Transactions

Contains all income, expenses, dividends, taxes, transfers, and cash movements. One row represents one transaction.

#### Structure

| Date | Type | Category | Subcategory | Account | Amount | Currency | Notes |
| --- | --- | --- | --- | --- | ---: | --- | --- |

#### Examples

| Date | Type | Category | Subcategory | Account | Amount |
| --- | --- | --- | --- | --- | ---: |
| 2026-10-01 | Expense | Food | Grocery | UBS | -45 |
| 2026-10-25 | Income | Salary | Salary | UBS | 4,500 |
| 2026-10-29 | Dividend | ETF Dividend | CSPX | IBKR | 38 |

#### Purpose

- Expense tracking
- Income tracking
- Savings-rate calculation
- Monthly cash-flow analysis
- Spending categories
- Historical trends
- Sankey visualizations

### Tab 2: Portfolio Snapshots

Contains portfolio holdings at each reporting date. Record a monthly, end-of-month snapshot. One row represents one instrument position.

#### Structure

| Snapshot Date | Broker | Ticker | Shares |
| --- | --- | --- | ---: |

#### Examples

| Snapshot Date | Broker | Ticker | Shares |
| --- | --- | --- | ---: |
| 2026-10-31 | IBKR | CSPX | 125 |
| 2026-10-31 | IBKR | ZPRV | 85 |
| 2026-10-31 | IBKR | AVUV | 40 |

#### Purpose

- Portfolio valuation
- Allocation analysis
- Historical net worth
- Performance charts
- Asset-class exposure

### Tab 3: Cash Snapshots

Contains balances for all bank and cash accounts. One row represents one account balance at a specific reporting date.

#### Structure

| Snapshot Date | Account | Currency | Balance |
| --- | --- | --- | ---: |

#### Examples

| Snapshot Date | Account | Balance |
| --- | --- | ---: |
| 2026-10-31 | UBS CHF | 18,000 |
| 2026-10-31 | Neon | 2,400 |
| 2026-10-31 | Wise EUR | 6,000 |

#### Purpose

- Cash allocation
- Net-worth reconstruction
- Liquidity monitoring

### Tab 4: Assets

A reference table describing each held asset.

#### Structure

| Ticker | Name | Asset Class | Region | Currency | Benchmark |
| --- | --- | --- | --- | --- | --- |

#### Examples

| Ticker | Asset Class |
| --- | --- |
| CSPX | Equity |
| ZPRV | Equity |
| AGGG | Bond |
| IGLN | Gold |

#### Purpose

- Asset allocation
- Asset grouping
- Exposure reports
- Portfolio analytics

### Tab 5: Categories

A reference table for organizing expenses.

#### Structure

| Category | Parent Category |
| --- | --- |

#### Examples

| Category | Parent Category |
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

### Tab 6: Asset Allocation Targets

Contains historical target allocations. Unlike a static target, this time series allows the investment policy to evolve over time.

#### Structure

| Effective Date | Asset Class | Target Weight |
| --- | --- | ---: |

#### Initial Policy

| Effective Date | Asset Class | Target Weight |
| --- | --- | ---: |
| 2026-01-01 | Equity | 90% |
| 2026-01-01 | Bonds | 0% |
| 2026-01-01 | Gold | 5% |
| 2026-01-01 | Cash | 5% |

#### Future Policy

| Effective Date | Asset Class | Target Weight |
| --- | --- | ---: |
| 2030-01-01 | Equity | 80% |
| 2030-01-01 | Bonds | 10% |
| 2030-01-01 | Gold | 5% |
| 2030-01-01 | Cash | 5% |

#### Purpose

- Drift analysis
- Rebalancing monitoring
- Historical policy tracking
- Portfolio governance

The dashboard always uses the latest target configuration applicable on each date.

### Tab 7: Constants

Contains system-wide constants and settings.

#### Structure

| Key | Value |
| --- | --- |

#### Examples

| Key | Value |
| --- | --- |
| Base Currency | CHF |
| FIRE Target | 1,500,000 |
| Safe Withdrawal Rate | 0.04 |
| Inflation Assumption | 0.02 |

#### Purpose

Centralizes configuration and avoids hardcoded application parameters.

### Tab 8: Summary (Auto-Generated)

This tab is not edited manually. Formulas or scripts generate it to provide convenient Google Sheets checks, such as:

- Monthly expenses
- Monthly income
- Savings rate
- Net-worth history
- Category totals

The dashboard remains the primary reporting interface.

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
