import assert from "node:assert/strict";
import test from "node:test";
import { formatApiDate, formatPersianDate, formatPersianMonth, parseApiDate, serializeApiDates } from "@/lib/persian-date";

test("converts Persian calendar API dates to canonical UTC dates", () => {
  assert.equal(parseApiDate("1405/06/24")?.toISOString(), "2026-09-15T00:00:00.000Z");
  assert.equal(parseApiDate("۱۴۰۵/۰۶/۲۴")?.toISOString(), "2026-09-15T00:00:00.000Z");
});

test("formats database dates for machine and Persian UI contracts", () => {
  const date = new Date("2026-09-15T00:00:00.000Z");
  assert.equal(formatApiDate(date, "effectiveDate"), "1405/06/24");
  assert.equal(formatPersianDate(date), "۱۴۰۵/۰۶/۲۴");
  assert.equal(formatPersianMonth("1405-06"), "۱۴۰۵/۰۶");
});

test("serializes nested API dates without changing non-date values", () => {
  assert.deepEqual(
    serializeApiDates({ effectiveDate: new Date("2026-09-15T00:00:00.000Z"), amount: 10 }),
    { effectiveDate: "1405/06/24", amount: 10 },
  );
});
