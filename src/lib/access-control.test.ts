import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessParty,
  canSignForParty,
  hasAnyRole,
  INTERNAL_ROLES,
  isAppRole,
  isCustomerUser,
  isInternalUser,
  type AccessUser,
} from "./access-control";

const customer: AccessUser = { id: "customer", role: "CUSTOMER", partyId: "party-a" };
const representative: AccessUser = {
  id: "representative",
  role: "CUSTOMER_REPRESENTATIVE",
  partyId: "party-a",
  accessiblePartyIds: ["party-company"],
  authorizedSignatoryPartyIds: ["party-company"],
  actingPartyId: "party-company",
};
const financialStaff: AccessUser = {
  id: "financial",
  role: "STAFF_FINANCIAL",
  partyId: null,
};

test("recognizes only supported roles", () => {
  assert.equal(isAppRole("ADMIN"), true);
  assert.equal(isAppRole("LEGAL"), false);
  assert.equal(isAppRole(undefined), false);
});

test("separates internal and customer roles", () => {
  assert.equal(isCustomerUser(customer), true);
  assert.equal(isCustomerUser(representative), true);
  assert.equal(isInternalUser(financialStaff), true);
  assert.equal(hasAnyRole(customer, INTERNAL_ROLES), false);
});

test("limits customers to their party and representatives to valid relationship scope", () => {
  assert.equal(canAccessParty(customer, "party-a"), true);
  assert.equal(canAccessParty(representative, "party-a"), false);
  assert.equal(canAccessParty(representative, "party-company"), true);
  assert.equal(
    canAccessParty({ ...representative, actingPartyId: null }, "party-company"),
    false
  );
  assert.equal(canAccessParty(customer, "party-b"), false);
  assert.equal(canAccessParty(financialStaff, "party-b"), true);
  assert.equal(
    canAccessParty(
      {
        ...representative,
        actingPartyId: "party-a",
        accessiblePartyIds: ["party-a"],
      },
      "party-a"
    ),
    true
  );
});

test("requires independent signatory authority for representatives", () => {
  assert.equal(canSignForParty(customer, "party-a"), true);
  assert.equal(canSignForParty(representative, "party-company"), true);
  assert.equal(
    canSignForParty({ ...representative, actingPartyId: null }, "party-company"),
    false
  );
  assert.equal(
    canSignForParty({ ...representative, authorizedSignatoryPartyIds: [] }, "party-company"),
    false
  );
  assert.equal(canSignForParty(financialStaff, "party-b"), true);
  assert.equal(
    canSignForParty(
      {
        ...representative,
        actingPartyId: "party-a",
        accessiblePartyIds: ["party-a"],
        authorizedSignatoryPartyIds: ["party-a"],
      },
      "party-a"
    ),
    true
  );
});
