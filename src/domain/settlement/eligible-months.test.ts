import assert from "node:assert/strict";
import test from "node:test";
import { eligibleSettlementMonths, firstCoveredSettlementMonth } from "./eligible-months";

test("excludes a partial contract month and an unfinished current month", () => {
  const window = {
    contractStart: "1405/06/24",
    contractEnd: "1406/05/10",
    scheduleStart: "1405/06/24",
    scheduleEnd: "1406/05/10",
    pricingStart: "1405/05/10",
    pricingEnd: "1406/05/10",
    pricingActive: true,
    now: new Date("2026-09-19T12:00:00Z"),
  };
  assert.deepEqual(eligibleSettlementMonths(window), []);
  assert.equal(firstCoveredSettlementMonth(window), "1405-07");
});

test("offers only complete months within contract, schedule and pricing validity", () => {
  assert.deepEqual(eligibleSettlementMonths({
    contractStart: "1405/06/24",
    contractEnd: "1405/10/10",
    scheduleStart: "1405/06/24",
    scheduleEnd: "1405/10/10",
    pricingStart: "1405/07/15",
    pricingEnd: "1405/09/15",
    pricingActive: true,
    now: new Date("2027-01-01T00:00:00Z"),
  }), ["1405-08"]);
});
