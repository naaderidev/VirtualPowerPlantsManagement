import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminPath, canCreateCustomerRequest } from "./ui-access";

test("technical staff never reaches proposal or financial pages", () => {
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/requests"), true);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/assets/new"), true);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/metering/reading-1"), true);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/proposals"), false);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/pricing"), false);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/market-indices"), false);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/settlements"), false);
  assert.equal(canAccessAdminPath("STAFF_TECHNICAL", "/admin/payments"), false);
});

test("legal staff sees netting review without gaining other financial pages", () => {
  assert.equal(canAccessAdminPath("STAFF_LEGAL", "/admin/netting"), true);
  assert.equal(canAccessAdminPath("STAFF_LEGAL", "/admin/market-indices"), false);
  assert.equal(canAccessAdminPath("STAFF_LEGAL", "/admin/settlements"), false);
  assert.equal(canAccessAdminPath("STAFF_LEGAL", "/admin/payments"), false);
});

test("financial staff can register market index observations", () => {
  assert.equal(canAccessAdminPath("STAFF_FINANCIAL", "/admin/market-indices"), true);
});

test("nested write pages use their action-specific roles", () => {
  assert.equal(canAccessAdminPath("MANAGER", "/admin/contracts/contract-1"), true);
  assert.equal(canAccessAdminPath("MANAGER", "/admin/contracts/contract-1/configure"), false);
  assert.equal(canAccessAdminPath("STAFF_SUPPLY", "/admin/contracts/contract-1/configure"), true);
  assert.equal(canAccessAdminPath("STAFF_LEGAL", "/admin/requests/request-1/proposal"), false);
  assert.equal(canAccessAdminPath("MANAGER", "/admin/requests/request-1/proposal"), true);
  assert.equal(canAccessAdminPath("STAFF_FINANCIAL", "/admin/settlements/new"), false);
  assert.equal(canAccessAdminPath("ADMIN", "/admin/settlements/new"), true);
});

test("admin can access every registered admin page family", () => {
  for (const pathname of [
    "/admin/dashboard",
    "/admin/proposals",
    "/admin/pricing-engine",
    "/admin/market-indices",
    "/admin/meters/new",
    "/admin/settlements",
    "/admin/audit-log",
    "/admin/users",
    "/admin/representatives",
    "/admin/settings",
  ]) {
    assert.equal(canAccessAdminPath("ADMIN", pathname), true, pathname);
  }
  assert.equal(canAccessAdminPath("STAFF_SUPPLY", "/admin/representatives"), false);
});

test("unknown admin paths are denied by default", () => {
  assert.equal(canAccessAdminPath("ADMIN", "/admin/not-registered"), false);
});

test("customer request creation follows party ownership semantics", () => {
  assert.equal(canCreateCustomerRequest("CUSTOMER", 0), true);
  assert.equal(canCreateCustomerRequest("CUSTOMER_REPRESENTATIVE", 0), false);
  assert.equal(canCreateCustomerRequest("CUSTOMER_REPRESENTATIVE", 1), true);
  assert.equal(canCreateCustomerRequest("CUSTOMER_REPRESENTATIVE", 2), false);
});
