import { useState } from "react";

export type ReportRange = "all" | "ytd" | "current-year" | "last-year";

/** Start and end dates of a quick range relative to `today`; empty strings mean "the full data range". */
export function resolveRange(range: ReportRange, today: string) {
  const year = today.slice(0, 4);
  if (range === "all") return { startDate: "", endDate: "" };
  if (range === "ytd") return { startDate: `${year}-01-01`, endDate: today };

  const selectedYear = range === "current-year" ? year : String(Number(year) - 1);
  return { startDate: `${selectedYear}-01-01`, endDate: `${selectedYear}-12-31` };
}

/** Date-range selection shared by the dashboards: explicit dates fall back to the full data range. */
export function useReportRange({ today, firstDate, lastDate }: { today: string; firstDate: string; lastDate: string }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return {
    startDate,
    endDate,
    /** Effective bounds: the chosen dates, or the first and last dates of the data. */
    rangeStart: startDate || firstDate,
    rangeEnd: endDate || lastDate,
    setStartDate,
    setEndDate,
    selectRange(range: ReportRange) {
      const next = resolveRange(range, today);
      setStartDate(next.startDate);
      setEndDate(next.endDate);
    },
  };
}

export type ReportRangeState = ReturnType<typeof useReportRange>;
