import assert from "node:assert/strict";
import test from "node:test";
import {
  calendarMonthPeriod,
  evaluateReadingCoverage,
  isExactUtcCalendarMonth,
} from "./calendar-month";

test("accepts only an exact Solar Hijri calendar month", () => {
  assert.equal(
    isExactUtcCalendarMonth(new Date("2026-08-23T00:00:00.000Z"), new Date("2026-09-23T00:00:00.000Z")),
    true
  );
  assert.equal(
    isExactUtcCalendarMonth(new Date("2026-09-02T00:00:00.000Z"), new Date("2026-10-02T00:00:00.000Z")),
    false
  );
});

test("derives the exclusive end of a selected Solar Hijri month", () => {
  assert.deepEqual(calendarMonthPeriod("1405-06"), {
    periodStart: "1405/06/01",
    periodEnd: "1405/07/01",
  });
  assert.equal(calendarMonthPeriod("1405-13"), null);
});

test("requires contiguous accepted readings for the whole month", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");
  const end = new Date("2026-10-01T00:00:00.000Z");
  assert.deepEqual(
    evaluateReadingCoverage(start, end, [
      { periodStart: start, periodEnd: new Date("2026-09-15T00:00:00.000Z") },
      { periodStart: new Date("2026-09-15T00:00:00.000Z"), periodEnd: end },
    ]),
    { complete: true }
  );
});

test("reports gaps and overlaps without mutating another reading set", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");
  const end = new Date("2026-10-01T00:00:00.000Z");
  const gap = evaluateReadingCoverage(start, end, [
    { periodStart: start, periodEnd: new Date("2026-09-10T00:00:00.000Z") },
    { periodStart: new Date("2026-09-11T00:00:00.000Z"), periodEnd: end },
  ]);
  const overlap = evaluateReadingCoverage(start, end, [
    { periodStart: start, periodEnd: new Date("2026-09-20T00:00:00.000Z") },
    { periodStart: new Date("2026-09-19T00:00:00.000Z"), periodEnd: end },
  ]);

  assert.equal(gap.complete, false);
  if (!gap.complete) assert.equal(gap.code, "GAP");
  assert.equal(overlap.complete, false);
  if (!overlap.complete) assert.equal(overlap.code, "OVERLAP");
});
