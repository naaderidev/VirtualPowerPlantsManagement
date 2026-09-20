import assert from "node:assert/strict";
import test from "node:test";
import { resolveRequestStatusFromSettlements } from "./financial-progress";

test("derives customer request progress from settlement lifecycle", () => {
  assert.equal(resolveRequestStatusFromSettlements("ACTIVE", ["CALCULATED"]), "SETTLEMENT_PENDING");
  assert.equal(resolveRequestStatusFromSettlements("SETTLEMENT_PENDING", ["CONFIRMED"]), "SETTLED");
  assert.equal(resolveRequestStatusFromSettlements("ACTIVE", ["PAID"]), "COMPLETED");
});

test("does not overwrite terminal request outcomes", () => {
  assert.equal(resolveRequestStatusFromSettlements("CANCELLED", ["PAID"]), "CANCELLED");
  assert.equal(resolveRequestStatusFromSettlements("REJECTED", ["PAID"]), "REJECTED");
});
