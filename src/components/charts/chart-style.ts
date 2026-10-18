// Recharts props shared by every dashboard chart, so axes, grid and cursor look the same everywhere.

export const chartMargin = { top: 12, right: 18, bottom: 4, left: 0 };

export const gridProps = { stroke: "#d4d4d4", vertical: false } as const;

export const xAxisProps = {
  axisLine: { stroke: "#171717" },
  tickLine: false,
  tick: { fill: "#525252", fontSize: 11 },
  interval: "preserveStartEnd",
} as const;

export const yAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: "#525252", fontSize: 11 },
  width: 54,
} as const;

/** Narrower axis for percentage ticks. */
export const percentAxisWidth = 46;

export const lineCursor = { stroke: "#171717", strokeDasharray: "3 3" };

/** Square-cornered tooltip box used by the net-worth charts. */
export const boxedTooltipStyle = { border: "1px solid #171717", borderRadius: 0, boxShadow: "none" };
