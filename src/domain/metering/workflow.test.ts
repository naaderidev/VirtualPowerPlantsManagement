import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionReading } from "./workflow";

test("requires validation before accepting a reading", () => {
  assert.equal(canTransitionReading("RAW", "ACCEPTED"), false);
  assert.equal(canTransitionReading("RAW", "VALIDATED"), true);
  assert.equal(canTransitionReading("VALIDATED", "ACCEPTED"), true);
});

test("does not reopen a settled reading", () => {
  assert.equal(canTransitionReading("ACCEPTED", "RAW"), false);
  assert.equal(canTransitionReading("REJECTED", "VALIDATED"), false);
});
