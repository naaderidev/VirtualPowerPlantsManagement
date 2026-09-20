import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionGenerationProfile } from "./generation-profile-workflow";

test("requires technical approval for generation forecast", () => {
  assert.equal(canTransitionGenerationProfile("DRAFT", "REVIEW", "CUSTOMER"), true);
  assert.equal(canTransitionGenerationProfile("REVIEW", "APPROVED", "CUSTOMER"), false);
  assert.equal(canTransitionGenerationProfile("REVIEW", "APPROVED", "STAFF_TECHNICAL"), true);
});
