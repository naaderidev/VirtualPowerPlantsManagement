import assert from "node:assert/strict";
import test from "node:test";
import { financialConfigurationPeriodsOverlap } from "./financial-configuration-period";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

test("adjacent financial settings can share an exclusive boundary", () => {
  assert.equal(financialConfigurationPeriodsOverlap(
    { validFrom: date("2026-07-23"), validTo: date("2026-08-23") },
    { validFrom: date("2026-08-23"), validTo: null },
  ), false);
});

test("a partial-day or open-ended overlap is still rejected", () => {
  assert.equal(financialConfigurationPeriodsOverlap(
    { validFrom: date("2026-07-23"), validTo: date("2026-08-23") },
    { validFrom: date("2026-08-22"), validTo: null },
  ), true);
  assert.equal(financialConfigurationPeriodsOverlap(
    { validFrom: date("2026-09-19"), validTo: null },
    { validFrom: date("2027-01-01"), validTo: null },
  ), true);
});
