"use client";

export type ReportRange = "all" | "ytd" | "current-year" | "last-year";

type ReportFiltersProps = {
  currencies: string[];
  selectedCurrency: string;
  startDate: string;
  endDate: string;
  rangeStart: string;
  rangeEnd: string;
  minDate: string;
  maxDate: string;
  onCurrencyChange: (currency: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onRangeSelect: (range: ReportRange) => void;
};

const rangeOptions: Array<{ value: ReportRange; label: string }> = [
  { value: "all", label: "All time" },
  { value: "ytd", label: "YTD" },
  { value: "current-year", label: "Current year" },
  { value: "last-year", label: "Last year" },
];

export function ReportFilters({
  currencies,
  selectedCurrency,
  startDate,
  endDate,
  rangeStart,
  rangeEnd,
  minDate,
  maxDate,
  onCurrencyChange,
  onStartDateChange,
  onEndDateChange,
  onRangeSelect,
}: ReportFiltersProps) {
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
          max={rangeEnd}
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        To
        <input
          className="border border-zinc-300 bg-white px-3 py-1 font-normal text-black"
          type="date"
          min={rangeStart}
          max={maxDate}
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </label>
      {rangeOptions.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onRangeSelect(value)}
          className="border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:border-black hover:text-black"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
