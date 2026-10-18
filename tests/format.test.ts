import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAxisValue,
  formatFullDate,
  formatInteger,
  formatMoney,
  formatMonthDash,
  formatMonthName,
  formatMonthYear,
  formatPercent,
  formatPercentPoints,
} from "@/lib/format";

describe("format", () => {
  it("shows missing values as an em dash and rounds money to integers", () => {
    assert.equal(formatMoney(null), "—");
    assert.equal(formatMoney(1234.56), "1,235");
    assert.equal(formatInteger(1_000_000), "1,000,000");
  });

  it("formats fractions and percentage points", () => {
    assert.equal(formatPercent(null), "—");
    assert.equal(formatPercent(0.256), "26%");
    assert.equal(formatPercent(0.256, { digits: 1 }), "25.6%");
    assert.equal(formatPercent(0.05, { digits: 1, signed: true }), "+5%");
    assert.equal(formatPercent(-0.05, { signed: true }), "-5%");
    assert.equal(formatPercentPoints(null), "—");
    assert.equal(formatPercentPoints(12.345), "12.3%");
  });

  it("compacts axis ticks with k and m suffixes, keeping the sign", () => {
    assert.equal(formatAxisValue(950), "950");
    assert.equal(formatAxisValue(1_500), "2k");
    assert.equal(formatAxisValue(-2_500), "-3k");
    assert.equal(formatAxisValue(1_500_000), "2m");
    assert.equal(formatAxisValue(0), "0");
  });

  it("formats dates in UTC regardless of the host time zone", () => {
    assert.equal(formatMonthDash("2026-01-31"), "Jan-26");
    assert.equal(formatMonthYear("2026-02-01"), "Feb 26");
    assert.equal(formatFullDate("2026-03-05"), "05 Mar 2026");
    assert.equal(formatMonthName("03"), "March");
  });
});
