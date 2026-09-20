import assert from "node:assert/strict";
import test from "node:test";
import { remainingPaymentAmount, suggestedAllocationAmount } from "./payment-amount";

test("suggests outstanding balance for a partially paid document", () => {
  assert.equal(remainingPaymentAmount("1000000", "250000"), "750000");
  assert.equal(remainingPaymentAmount(1000000, "0"), "1000000");
  assert.equal(remainingPaymentAmount("1000000", "1000000"), null);
});

test("allocation suggestion never exceeds payment or document balance", () => {
  assert.equal(suggestedAllocationAmount("400000", "750000"), "400000");
  assert.equal(suggestedAllocationAmount("1000000", "750000"), "750000");
});
