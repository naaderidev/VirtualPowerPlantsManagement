import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionPayment } from "./payment-workflow";

test("payment can be confirmed or rejected only once", () => {
  assert.equal(canTransitionPayment("PENDING", "CONFIRMED"), true);
  assert.equal(canTransitionPayment("PENDING", "REJECTED"), true);
  assert.equal(canTransitionPayment("CONFIRMED", "REJECTED"), false);
});
