import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "@prisma/client";
import { DEMO_ACCOUNTS, getPostLoginPath } from "../src/lib/demo-accounts";
import { getSeededUsers } from "./seed-users";

const seededUsers = getSeededUsers("09190000000");

test("seed contains exactly one user for every application role", () => {
  assert.deepEqual(
    [...seededUsers.map(({ role }) => role)].sort(),
    Object.values(UserRole).sort()
  );
});

test("seed identities are unique and use the configured administrator mobile", () => {
  assert.equal(new Set(seededUsers.map(({ mobile }) => mobile)).size, seededUsers.length);
  assert.equal(new Set(seededUsers.map(({ email }) => email)).size, seededUsers.length);
  assert.equal(seededUsers.find(({ role }) => role === UserRole.ADMIN)?.mobile, "09190000000");
  assert.equal(
    getSeededUsers("09190000001").find(({ role }) => role === UserRole.ADMIN)?.mobile,
    "09190000001"
  );
  assert.throws(() => getSeededUsers("123"), /ADMIN_SEED_MOBILE/);
  assert.throws(() => getSeededUsers("09191111111"), /differ from other seeded user mobiles/);
});

test("demo cards map one-to-one to seeded users", () => {
  assert.equal(DEMO_ACCOUNTS.length, 8);
  assert.deepEqual(
    DEMO_ACCOUNTS.map(({ role }) => role),
    seededUsers.map(({ role }) => role)
  );
  for (const account of DEMO_ACCOUNTS) {
    if (account.role === UserRole.ADMIN) {
      assert.equal(account.mobile, null);
    } else {
      assert.equal(account.mobile, seededUsers.find(({ role }) => role === account.role)?.mobile);
    }
  }
});

test("login destinations separate internal and customer roles", () => {
  assert.equal(getPostLoginPath("STAFF_TECHNICAL"), "/admin/dashboard");
  assert.equal(getPostLoginPath("MANAGER"), "/admin/dashboard");
  assert.equal(getPostLoginPath("CUSTOMER"), "/customer/dashboard");
  assert.equal(getPostLoginPath("CUSTOMER_REPRESENTATIVE"), "/customer/dashboard");
});
