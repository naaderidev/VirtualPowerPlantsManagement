import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSettlementTransition } from "./workflow";

test("allows only staged financial review", () => {
  assert.equal(evaluateSettlementTransition({ from: "CALCULATED", to: "CONFIRMED", actorRole: "STAFF_FINANCIAL" }).allowed, false);
  assert.deepEqual(evaluateSettlementTransition({ from: "CALCULATED", to: "UNDER_REVIEW", actorRole: "STAFF_FINANCIAL" }), { allowed: true });
  assert.deepEqual(evaluateSettlementTransition({ from: "UNDER_REVIEW", to: "CONFIRMED", actorRole: "STAFF_FINANCIAL" }), { allowed: true });
});

test("enforces dispute reason and deadline", () => {
  assert.equal(evaluateSettlementTransition({ from: "CONFIRMED", to: "DISPUTED", actorRole: "CUSTOMER", disputeDeadline: new Date("2026-09-20"), now: new Date("2026-09-13") }).allowed, false);
  assert.equal(evaluateSettlementTransition({ from: "CONFIRMED", to: "DISPUTED", actorRole: "CUSTOMER", disputeReason: "اختلاف قرائت", disputeDeadline: new Date("2026-09-20"), now: new Date("2026-09-13") }).allowed, true);
});
