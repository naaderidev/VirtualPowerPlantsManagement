import assert from "node:assert/strict";
import test from "node:test";
import { canEditContractConfiguration, evaluateContractTransition } from "./workflow";

const complete = {
  actorRole: "STAFF_SUPPLY" as const,
  configurationComplete: true,
  allRequiredPartiesSigned: false,
  effectiveDate: new Date("2026-09-01T00:00:00Z"),
  now: new Date("2026-09-12T00:00:00Z"),
};

test("contract follows configuration and review stages", () => {
  assert.deepEqual(evaluateContractTransition({ from: "DRAFT", to: "CONFIGURED", ...complete }), { allowed: true });
  assert.equal(evaluateContractTransition({ from: "DRAFT", to: "PENDING_SIGNATURE", ...complete }).allowed, false);
});

test("legal review is required before signature", () => {
  assert.deepEqual(evaluateContractTransition({
    from: "INTERNAL_REVIEW",
    to: "PENDING_SIGNATURE",
    ...complete,
    actorRole: "STAFF_LEGAL",
  }), { allowed: true });
});

test("supply can revise a contract returned by legal and resubmit it", () => {
  const returned = evaluateContractTransition({
    from: "INTERNAL_REVIEW",
    to: "NEEDS_CHANGES",
    ...complete,
    actorRole: "STAFF_LEGAL",
    note: "بند پرداخت نیاز به اصلاح دارد.",
  });
  assert.deepEqual(returned, { allowed: true });
  assert.equal(canEditContractConfiguration("NEEDS_CHANGES"), true);
  assert.deepEqual(evaluateContractTransition({ from: "NEEDS_CHANGES", to: "CONFIGURED", ...complete }), { allowed: true });
  assert.deepEqual(evaluateContractTransition({ from: "CONFIGURED", to: "INTERNAL_REVIEW", ...complete }), { allowed: true });
  assert.equal(evaluateContractTransition({
    from: "NEEDS_CHANGES",
    to: "CONFIGURED",
    ...complete,
    actorRole: "STAFF_LEGAL",
  }).allowed, false);
});

test("activation requires both signatures and effective date", () => {
  assert.equal(evaluateContractTransition({
    from: "SIGNED",
    to: "ACTIVE",
    ...complete,
    actorRole: "ADMIN",
  }).allowed, false);
  assert.deepEqual(evaluateContractTransition({
    from: "SIGNED",
    to: "ACTIVE",
    ...complete,
    actorRole: "ADMIN",
    allRequiredPartiesSigned: true,
  }), { allowed: true });
});

test("signed contracts are immutable", () => {
  assert.equal(canEditContractConfiguration("SIGNED"), false);
  assert.equal(canEditContractConfiguration("ACTIVE"), false);
  assert.equal(canEditContractConfiguration("NEEDS_CHANGES"), true);
});

test("reviewers can complete or withdraw a reasoned termination request", () => {
  const request = {
    from: "ACTIVE" as const,
    to: "TERMINATION_PENDING" as const,
    ...complete,
    actorRole: "STAFF_LEGAL" as const,
  };
  assert.equal(evaluateContractTransition(request).allowed, false);
  assert.deepEqual(evaluateContractTransition({ ...request, note: "درخواست فسخ به دلیل نقض تعهدات" }), { allowed: true });
  assert.deepEqual(evaluateContractTransition({
    ...complete,
    from: "TERMINATION_PENDING",
    to: "TERMINATED",
    actorRole: "MANAGER",
    note: "تأیید نهایی فسخ",
  }), { allowed: true });
  assert.deepEqual(evaluateContractTransition({
    ...complete,
    from: "TERMINATION_PENDING",
    to: "ACTIVE",
    actorRole: "MANAGER",
    note: "دلایل فسخ احراز نشد",
  }), { allowed: true });
});
