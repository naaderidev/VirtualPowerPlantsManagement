import assert from "node:assert/strict";
import test from "node:test";
import { canSubmitOperationalReadiness, evaluateOperationalReadiness } from "./operational-readiness";

const now = new Date("2026-09-15T00:00:00.000Z");

test("blocks contract activation until a plant is operational and metering-ready", () => {
  const result = evaluateOperationalReadiness({
    status: "UNDER_CONSTRUCTION",
    operationalDate: new Date("2026-10-01T00:00:00.000Z"),
    connectionStatus: "PENDING",
    hasActiveMainMeter: false,
    verifiedDocumentTypes: [],
    now,
  });
  assert.equal(result.ready, false);
  assert.equal(result.blockers.length, 6);
});

test("accepts an active connected plant with an active meter and verified evidence", () => {
  const result = evaluateOperationalReadiness({
    status: "ACTIVE",
    operationalDate: new Date("2026-09-14T00:00:00.000Z"),
    connectionStatus: "CONNECTED",
    hasActiveMainMeter: true,
    verifiedDocumentTypes: ["CONNECTION", "METER"],
    now,
  });
  assert.deepEqual(result, { ready: true, blockers: [] });
});

test("allows only the restricted commissioning update after full information submission", () => {
  assert.equal(canSubmitOperationalReadiness("APPROVED"), false);
  assert.equal(canSubmitOperationalReadiness("INFORMATION_SUBMITTED"), true);
  assert.equal(canSubmitOperationalReadiness("PROPOSAL_REJECTED"), true);
  assert.equal(canSubmitOperationalReadiness("CONTRACT_SIGNED"), true);
  assert.equal(canSubmitOperationalReadiness("ACTIVE"), false);
});
