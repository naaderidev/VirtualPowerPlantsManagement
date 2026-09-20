import assert from "node:assert/strict";
import test from "node:test";
import { dateWithinBounds, effectiveDateBounds } from "./date-picker-constraints";

test("locks the start day itself when an end must strictly follow it", () => {
  const bounds = { minExclusiveDate: "1405/06/24" };
  assert.equal(effectiveDateBounds(bounds).minDate, "1405/06/25");
  assert.equal(dateWithinBounds("1405/06/24", bounds), false);
  assert.equal(dateWithinBounds("1405/06/25", bounds), true);
});

test("respects both sides of a parent validity window", () => {
  const bounds = { minDate: "1405/07/01", maxDate: "1406/07/01", maxExclusiveDate: "1405/08/01" };
  assert.deepEqual(effectiveDateBounds(bounds), { minDate: "1405/07/01", maxDate: "1405/07/30" });
  assert.equal(dateWithinBounds("1405/08/01", bounds), false);
});

test("honors inclusive same-day representation validity", () => {
  assert.equal(dateWithinBounds("1405/07/01", { minDate: "1405/07/01" }), true);
});
