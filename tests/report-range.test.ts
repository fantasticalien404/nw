import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRange } from "@/components/ui/use-report-range";
import { toggleInSet } from "@/lib/sets";

describe("resolveRange", () => {
  const today = "2026-10-18";

  it("clears the dates for all time, so the full data range applies", () => {
    assert.deepEqual(resolveRange("all", today), { startDate: "", endDate: "" });
  });

  it("runs from the start of the year to today for year to date", () => {
    assert.deepEqual(resolveRange("ytd", today), { startDate: "2026-01-01", endDate: "2026-10-18" });
  });

  it("covers a whole calendar year for the current and the previous year", () => {
    assert.deepEqual(resolveRange("current-year", today), { startDate: "2026-01-01", endDate: "2026-12-31" });
    assert.deepEqual(resolveRange("last-year", today), { startDate: "2025-01-01", endDate: "2025-12-31" });
  });
});

describe("toggleInSet", () => {
  it("adds a missing value and removes a present one, without mutating the original", () => {
    const original = new Set(["a", "b"]);
    assert.deepEqual([...toggleInSet(original, "c")], ["a", "b", "c"]);
    assert.deepEqual([...toggleInSet(original, "a")], ["b"]);
    assert.deepEqual([...original], ["a", "b"]);
  });
});
