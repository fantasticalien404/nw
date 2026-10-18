import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, daysBetween, eachDay, isIsoDate, monthStart, monthStarts, monthsBetween, serialToIsoDate } from "@/lib/dates";

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
  });

  it("finds the first day of a month with an offset, without day overflow", () => {
    assert.equal(monthStart("2026-03-17"), "2026-03-01");
    assert.equal(monthStart("2026-03-31", -1), "2026-02-01");
    assert.equal(monthStart("2026-12-31", 1), "2027-01-01");
  });

  it("lists month starts inclusively, normalising both ends to their month", () => {
    assert.deepEqual(monthStarts("2025-11-20", "2026-02-03"), ["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
    assert.deepEqual(monthStarts("2026-05-31", "2026-05-01"), ["2026-05-01"]);
    assert.deepEqual(monthStarts("2026-06-01", "2026-05-01"), []);
  });

  it("counts calendar months ignoring days", () => {
    assert.equal(monthsBetween("2025-12-31", "2026-01-01"), 1);
    assert.equal(monthsBetween("2026-01-01", "2026-01-31"), 0);
    assert.equal(monthsBetween("2025-01-15", "2026-04-02"), 15);
  });

  it("measures day differences and lists every day inclusively", () => {
    assert.equal(daysBetween("2026-02-27", "2026-03-02"), 3);
    assert.deepEqual(eachDay("2026-02-27", "2026-03-01"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
    assert.deepEqual(eachDay("2026-03-02", "2026-03-01"), []);
  });

  it("recognises real calendar dates only", () => {
    assert.equal(isIsoDate("2026-02-28"), true);
    assert.equal(isIsoDate("0002-01-01"), true);
    assert.equal(isIsoDate("2026-02-30"), false);
    for (const invalid of ["", "2026-02", "20260-03-01", "26-03-01", "2026-3-1", "yesterday"]) assert.equal(isIsoDate(invalid), false, invalid);
  });

  it("returns nothing for malformed dates instead of throwing, as when a date input holds a 5-digit year", () => {
    assert.deepEqual(monthStarts("2023-01-01", "20260-03-01"), []);
    assert.deepEqual(monthStarts("", "2026-03-01"), []);
    assert.deepEqual(eachDay("2026-01-01", "20260-03-01"), []);
    assert.deepEqual(eachDay("soon", "2026-03-01"), []);
  });

  it("converts Google Sheets serial dates", () => {
    assert.equal(serialToIsoDate(25_569), "1970-01-01");
    assert.equal(serialToIsoDate(46_023), "2026-01-01");
    assert.equal(serialToIsoDate(46_023.75), "2026-01-01");
  });
});
