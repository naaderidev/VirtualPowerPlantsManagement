import assert from "node:assert/strict";
import test from "node:test";
import {
  NettingStatementAllocationError,
  calculateNettingStatementAllocation,
  deriveNettingStatement,
} from "./statement";

test("derives the seller-facing direction and absolute statement amount", () => {
  const receivable = deriveNettingStatement("1500");
  assert.equal(receivable.direction, "RECEIVABLE");
  assert.equal(receivable.amount.toString(), "1500");
  assert.equal(deriveNettingStatement("-300").direction, "PAYABLE");
  assert.equal(deriveNettingStatement("0").initialStatus, "PAID");
});

test("allocates a confirmed payment without exceeding either balance", () => {
  const result = calculateNettingStatementAllocation({
    paymentAmount: "1000",
    paymentAllocated: "100",
    statementAmount: "1200",
    statementPaid: "300",
    allocationAmount: "900",
    paymentCurrency: "IRR",
    statementCurrency: "IRR",
  });
  assert.equal(result.paymentFullyAllocated, true);
  assert.equal(result.statementStatus, "PAID");
});

test("rejects over-allocation and currency mismatches", () => {
  assert.throws(
    () => calculateNettingStatementAllocation({ paymentAmount: 100, paymentAllocated: 0, statementAmount: 100, statementPaid: 0, allocationAmount: 101, paymentCurrency: "IRR", statementCurrency: "IRR" }),
    NettingStatementAllocationError
  );
  assert.throws(
    () => calculateNettingStatementAllocation({ paymentAmount: 100, paymentAllocated: 0, statementAmount: 100, statementPaid: 0, allocationAmount: 50, paymentCurrency: "IRR", statementCurrency: "USD" }),
    /ارز/
  );
});
