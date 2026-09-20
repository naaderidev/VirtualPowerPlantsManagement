import assert from "node:assert/strict";
import test from "node:test";
import {
  canSettleContractPeriod,
  currentTerminationBoundary,
  isContractOperational,
  nextTerminationBoundary,
} from "./termination";

test("a termination request does not stop current operations", () => {
  assert.equal(isContractOperational("ACTIVE"), true);
  assert.equal(isContractOperational("TERMINATION_PENDING"), true);
  assert.equal(isContractOperational("TERMINATED"), false);
});

test("terminated contracts can settle only completed periods before termination", () => {
  const boundary = new Date("2026-09-23T00:00:00.000Z");
  assert.equal(canSettleContractPeriod("TERMINATION_PENDING", new Date("2026-10-23T00:00:00.000Z"), null), true);
  assert.equal(canSettleContractPeriod("TERMINATED", boundary, boundary), true);
  assert.equal(canSettleContractPeriod("TERMINATED", new Date("2026-10-23T00:00:00.000Z"), boundary), false);
});

test("final termination is limited to a Persian monthly boundary", () => {
  assert.equal(currentTerminationBoundary(new Date("2026-09-19T12:00:00.000Z")), null);
  assert.equal(nextTerminationBoundary(new Date("2026-09-19T12:00:00.000Z")), "1405/07/01");
  assert.equal(currentTerminationBoundary(new Date("2026-09-23T12:00:00.000Z"))?.toISOString(), "2026-09-23T00:00:00.000Z");
});
