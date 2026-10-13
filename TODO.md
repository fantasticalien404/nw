# Product backlog

## Cashflow and planning

- Add scenario analysis with income and expense forecasts and a Monte Carlo simulation.
- Add one-year expected shortfall at the 99% confidence level.
- Add best- and worst-month metrics.
- Add a monthly stacked bar chart that decomposes net-worth growth into:
  - active savings (income less expenses); and
  - market returns.
- Stop the cumulative cashflow chart at the previous month and omit future months.

## Portfolio analytics

- Add rolling 12-month Sharpe and Sortino ratio charts.
- Add a dynamic correlation heatmap for portfolio instruments.
- Add target versus actual asset allocation on `/nw`.
- Add a fund look-through capability for stock, country, sector, and related exposures.
- Add portfolio leverage over time, including embedded ETF leverage and explicit Interactive Brokers leverage. => probably better with a dedicated skill
- Design a multi-year view:
  - an all-time historical summary; and
  - year filters for `/cashflow` and `/nw`.

## Completed benchmark comparison

- Compare the portfolio with a selectable 60/40 or 100% equities benchmark.
- Apply the same `contribution` and `withdrawal` cashflows to the benchmark.
- Show annualized money-weighted IRR, growth, Sharpe ratio, volatility, maximum drawdown, and best/worst month.
- Support benchmark currency and rebalancing-period selection.

## Navigation and information architecture

- Add navigation for cashflow and net worth.
- Add a dedicated backlog page.
- Add an information page.

## Expense

- expense dashboard and expense graph with filters:
  - by currency
  - by category 
  - by 