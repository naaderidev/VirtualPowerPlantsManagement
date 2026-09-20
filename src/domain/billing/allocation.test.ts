import assert from "node:assert/strict";
import test from "node:test";
import { calculatePaymentAllocation, PaymentAllocationError } from "./allocation";

test("calculates partial and complete invoice allocation", () => {
  const partial = calculatePaymentAllocation({ paymentAmount: 1000, paymentAllocated: 0, invoiceAmount: 1500, invoicePaid: 0, allocationAmount: 1000, paymentCurrency: "IRR", invoiceCurrency: "IRR" });
  assert.equal(partial.invoiceStatus, "PARTIALLY_PAID");
  assert.equal(partial.paymentFullyAllocated, true);

  const complete = calculatePaymentAllocation({ paymentAmount: 500, paymentAllocated: 0, invoiceAmount: 1500, invoicePaid: 1000, allocationAmount: 500, paymentCurrency: "IRR", invoiceCurrency: "IRR" });
  assert.equal(complete.invoiceStatus, "PAID");
  assert.equal(complete.invoicePaid.toString(), "1500");
});

test("rejects allocation above payment or invoice balance", () => {
  assert.throws(() => calculatePaymentAllocation({ paymentAmount: 1000, paymentAllocated: 800, invoiceAmount: 2000, invoicePaid: 0, allocationAmount: 300, paymentCurrency: "IRR", invoiceCurrency: "IRR" }), PaymentAllocationError);
  assert.throws(() => calculatePaymentAllocation({ paymentAmount: 1000, paymentAllocated: 0, invoiceAmount: 1000, invoicePaid: 900, allocationAmount: 200, paymentCurrency: "IRR", invoiceCurrency: "IRR" }), PaymentAllocationError);
});

test("rejects mismatched currencies", () => {
  assert.throws(() => calculatePaymentAllocation({ paymentAmount: 1000, paymentAllocated: 0, invoiceAmount: 1000, invoicePaid: 0, allocationAmount: 100, paymentCurrency: "IRR", invoiceCurrency: "USD" }), PaymentAllocationError);
});
