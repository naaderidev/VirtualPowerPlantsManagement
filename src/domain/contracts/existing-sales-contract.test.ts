import assert from "node:assert/strict";
import test from "node:test";
import { getExistingContractConflicts } from "./existing-sales-contract";

const base = {
  hasExistingContract: true,
  existingContractStart: new Date("2026-01-01"),
  existingContractEnd: new Date("2026-12-31"),
  existingContractCommittedCapacity: 60,
  existingContractExclusive: false,
  existingContractRightToSellConfirmed: true,
  assetId: "asset-1",
  assetName: "نیروگاه نمونه",
  capacityNominal: 100,
  capacitySellable: 40,
};

test("allows a non-exclusive overlap when only residual capacity is offered", () => {
  assert.deepEqual(getExistingContractConflicts({
    ...base,
    schedules: [{ startDate: new Date("2026-09-01"), endDate: new Date("2027-09-01") }],
  }), []);
});

test("blocks an exclusive overlapping sales contract", () => {
  const conflicts = getExistingContractConflicts({
    ...base,
    existingContractExclusive: true,
    schedules: [{ startDate: new Date("2026-09-01"), endDate: new Date("2027-09-01") }],
  });
  assert.match(conflicts.join(" "), /انحصاری/);
});

test("allows a new schedule after the existing contract ends", () => {
  assert.deepEqual(getExistingContractConflicts({
    ...base,
    existingContractExclusive: true,
    schedules: [{ startDate: new Date("2027-01-01"), endDate: new Date("2027-12-31") }],
  }), []);
});
