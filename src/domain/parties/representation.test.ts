import assert from "node:assert/strict";
import test from "node:test";
import {
  getRepresentationState,
  parseActingPartySelection,
  representationPeriodsMatch,
  representationPeriodsOverlap,
  resolveActingPartyId,
  serializeActingPartySelection,
} from "./representation";

const at = new Date("2026-09-14T00:00:00.000Z");

test("derives current, scheduled, expired, and revoked representation states", () => {
  assert.equal(getRepresentationState({ active: true, validFrom: at }, at), "CURRENT");
  assert.equal(
    getRepresentationState({ active: true, validFrom: new Date("2026-09-15") }, at),
    "SCHEDULED"
  );
  assert.equal(
    getRepresentationState({ active: true, validFrom: new Date("2026-01-01"), validTo: new Date("2026-09-13") }, at),
    "EXPIRED"
  );
  assert.equal(getRepresentationState({ active: false, validFrom: at }, at), "REVOKED");
});

test("detects inclusive representation period overlaps", () => {
  const first = { validFrom: new Date("2026-01-01"), validTo: new Date("2026-06-30") };
  assert.equal(
    representationPeriodsOverlap(first, {
      validFrom: new Date("2026-06-30"),
      validTo: new Date("2026-12-31"),
    }),
    true
  );
  assert.equal(
    representationPeriodsOverlap(first, { validFrom: new Date("2026-07-01") }),
    false
  );
});

test("matches paired representation and signatory periods", () => {
  const period = { validFrom: new Date("2026-01-01"), validTo: null };
  assert.equal(representationPeriodsMatch(period, { ...period }), true);
  assert.equal(
    representationPeriodsMatch(period, { validFrom: new Date("2026-01-02"), validTo: null }),
    false
  );
});

test("requires representatives to explicitly select their personal or represented party", () => {
  const represented = ["company-a", "company-b"];
  assert.equal(
    resolveActingPartyId("CUSTOMER_REPRESENTATIVE", "representative-person", represented, null),
    null
  );
  assert.equal(
    resolveActingPartyId("CUSTOMER_REPRESENTATIVE", "representative-person", represented, "representative-person"),
    "representative-person"
  );
  assert.equal(
    resolveActingPartyId("CUSTOMER_REPRESENTATIVE", "representative-person", represented, "company-b"),
    "company-b"
  );
  assert.equal(
    resolveActingPartyId("CUSTOMER_REPRESENTATIVE", "representative-person", represented, "company-x"),
    null
  );
});

test("binds an acting-party selection to exactly one login session", () => {
  const value = serializeActingPartySelection("login-a", "company-a");
  assert.equal(parseActingPartySelection(value, "login-a"), "company-a");
  assert.equal(parseActingPartySelection(value, "login-b"), null);
  assert.equal(parseActingPartySelection("legacy-company-a", "login-a"), null);
  assert.equal(parseActingPartySelection(null, "login-a"), null);
});

test("uses the seller's own party for a direct customer", () => {
  assert.equal(resolveActingPartyId("CUSTOMER", "seller", [], "company-x"), "seller");
  assert.equal(resolveActingPartyId("INTERNAL", null, [], "company-x"), null);
});
