import assert from "node:assert/strict";
import test from "node:test";
import { notificationScopeFor } from "./notification-scope";

test("a representative sees only notifications for the selected personal party", () => {
  assert.deepEqual(notificationScopeFor({ id: "representative", role: "CUSTOMER_REPRESENTATIVE", actingPartyId: "personal" }), {
    userId: "representative",
    partyId: "personal",
  });
});

test("switching to a company excludes personal and other company notifications", () => {
  assert.deepEqual(notificationScopeFor({ id: "representative", role: "CUSTOMER_REPRESENTATIVE", actingPartyId: "company-b" }), {
    userId: "representative",
    partyId: "company-b",
  });
});

test("no acting party grants no notification access", () => {
  assert.equal(notificationScopeFor({ id: "representative", role: "CUSTOMER_REPRESENTATIVE", actingPartyId: null }), null);
});

test("internal users retain their own role notifications", () => {
  assert.deepEqual(notificationScopeFor({ id: "finance", role: "STAFF_FINANCIAL", actingPartyId: null }), {
    userId: "finance",
  });
});
