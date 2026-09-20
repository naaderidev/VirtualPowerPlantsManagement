import assert from "node:assert/strict";
import test from "node:test";
import { canManuallyTransitionInvoice } from "./invoice-workflow";

test("paid states are controlled only by allocation", () => {
  assert.equal(canManuallyTransitionInvoice("ISSUED", "PAID"), false);
  assert.equal(canManuallyTransitionInvoice("ISSUED", "PARTIALLY_PAID"), false);
  assert.equal(canManuallyTransitionInvoice("ISSUED", "SENT"), true);
});
