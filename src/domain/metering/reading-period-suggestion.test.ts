import assert from "node:assert/strict";
import test from "node:test";
import { suggestReadingPeriod } from "./reading-period-suggestion";

test("suggests the first partial month after a mid-month contract start without calling it settleable", () => {
  assert.deepEqual(suggestReadingPeriod({
    scheduleStart: new Date("2026-09-15T00:00:00.000Z"),
    scheduleEnd: new Date("2027-08-01T00:00:00.000Z"),
    lastReadingEnd: null,
    interval: "MONTHLY",
    now: new Date("2026-09-19T00:00:00.000Z"),
  }), {
    periodStart: "1405/06/24",
    periodEnd: "1405/07/01",
    ready: false,
    fullSettlementMonth: false,
  });
});

test("moves to a full completed month after the previous reading", () => {
  assert.deepEqual(suggestReadingPeriod({
    scheduleStart: new Date("2026-09-15T00:00:00.000Z"),
    scheduleEnd: new Date("2027-08-01T00:00:00.000Z"),
    lastReadingEnd: new Date("2026-09-23T00:00:00.000Z"),
    interval: "MONTHLY",
    now: new Date("2026-10-24T00:00:00.000Z"),
  }), {
    periodStart: "1405/07/01",
    periodEnd: "1405/08/01",
    ready: true,
    fullSettlementMonth: true,
  });
});

test("stops a final partial interval at the schedule end", () => {
  assert.deepEqual(suggestReadingPeriod({
    scheduleStart: new Date("2026-09-15T00:00:00.000Z"),
    scheduleEnd: new Date("2026-09-20T00:00:00.000Z"),
    lastReadingEnd: null,
    interval: "MONTHLY",
    now: new Date("2026-10-24T00:00:00.000Z"),
  }), {
    periodStart: "1405/06/24",
    periodEnd: "1405/06/29",
    ready: true,
    fullSettlementMonth: false,
  });
});
