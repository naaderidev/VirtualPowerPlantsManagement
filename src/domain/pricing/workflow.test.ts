import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionPricingPlan } from "./workflow";

test("requires financial approval before activation", () => {
  assert.equal(canTransitionPricingPlan("DRAFT", "ACTIVE", "ADMIN"), false);
  assert.equal(canTransitionPricingPlan("REVIEW", "APPROVED", "STAFF_FINANCIAL"), true);
  assert.equal(canTransitionPricingPlan("APPROVED", "ACTIVE", "STAFF_FINANCIAL"), true);
});

test("allows financial reviewers to return a reviewed plan to draft", () => {
  assert.equal(canTransitionPricingPlan("REVIEW", "DRAFT", "STAFF_FINANCIAL"), true);
  assert.equal(canTransitionPricingPlan("REVIEW", "DRAFT", "STAFF_SUPPLY"), false);
});
