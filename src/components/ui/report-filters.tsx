"use client";

import type { ReportRange, ReportRangeState } from "./use-report-range";

type ReportFiltersProps = {
  currencies: string[];
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  range: ReportRangeState;
  /** Earliest and latest selectable dates. */
  minDate: string;
  maxDate: string;
};

const rangeOptions: Array<{ value: ReportRange; label: string }> = [
  { value: "all", label: "All time" },
  { value: "ytd", label: "YTD" },
  { value: "current-year", label: "Current year" },
  { value: "last-year", label: "Last year" },
];

export function ReportFilters({ currencies, selectedCurrency, onCurrencyChange, range, minDate, maxDate }: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Report filters">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Display currency">
        {currencies.map((currency) => (
          <button
            key={currency}
            type="button"
            onClick={() => onCurrencyChange(currency)}
            aria-pressed={currency === selectedCurrency}
            className={`border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
              currency === selectedCurrency
                ? "border-black bg-black text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:border-black hover:text-black"
            }`}
          >
            {currency}
          </button>
        ))}
      </div>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        From
        <input
          className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black"
          type="date"
          min={minDate}
          max={range.rangeEnd}
          value={range.startDate}
          onChange={(event) => range.setStartDate(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        To
        <input
          className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black"
          type="date"
          min={range.rangeStart}
          max={maxDate}
          value={range.endDate}
          onChange={(event) => range.setEndDate(event.target.value)}
        />
      </label>
      {rangeOptions.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => range.selectRange(value)}
          className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
