import assert from "node:assert/strict";
import test from "node:test";
import { canCompleteRequestInformation, evaluateRequestTransition, nextStatusAfterInformationSubmission } from "./workflow";

test("allows supply staff to start initial review", () => {
  assert.deepEqual(
    evaluateRequestTransition({
      from: "SUBMITTED",
      to: "INITIAL_REVIEW",
      actorRole: "STAFF_SUPPLY",
      hasAsset: false,
    }),
    { allowed: true, action: "START_REVIEW" }
  );
});

test("rejects state skipping", () => {
  const decision = evaluateRequestTransition({
    from: "SUBMITTED",
    to: "PROPOSAL_PENDING",
    actorRole: "ADMIN",
    hasAsset: true,
  });

  assert.equal(decision.allowed, false);
});

test("requires a reason for rejection", () => {
  const decision = evaluateRequestTransition({
    from: "INITIAL_REVIEW",
    to: "REJECTED",
    actorRole: "STAFF_SUPPLY",
    hasAsset: false,
  });

  assert.deepEqual(decision, { allowed: false, reason: "برای این تصمیم درج دلیل الزامی است." });
});

test("requires a linked asset before ownership review", () => {
  const decision = evaluateRequestTransition({
    from: "APPROVED",
    to: "OWNERSHIP_REVIEW",
    actorRole: "STAFF_TECHNICAL",
    hasAsset: false,
  });

  assert.equal(decision.allowed, false);
});

test("requires verified documents of the request before starting its proposal", () => {
  const denied = evaluateRequestTransition({
    from: "OWNERSHIP_REVIEW",
    to: "PROPOSAL_PENDING",
    actorRole: "STAFF_TECHNICAL",
    hasAsset: true,
    documentsReady: false,
  });
  const allowed = evaluateRequestTransition({
    from: "OWNERSHIP_REVIEW",
    to: "PROPOSAL_PENDING",
    actorRole: "STAFF_TECHNICAL",
    hasAsset: true,
    documentsReady: true,
  });

  assert.equal(denied.allowed, false);
  assert.deepEqual(allowed, { allowed: true, action: "START_PROPOSAL" });
});

test("requires all mandatory uploads before supply refers information to technical review", () => {
  const denied = evaluateRequestTransition({
    from: "INFORMATION_SUBMITTED",
    to: "OWNERSHIP_REVIEW",
    actorRole: "STAFF_SUPPLY",
    hasAsset: true,
    documentsSubmitted: false,
  });
  const allowed = evaluateRequestTransition({
    from: "INFORMATION_SUBMITTED",
    to: "OWNERSHIP_REVIEW",
    actorRole: "STAFF_SUPPLY",
    hasAsset: true,
    documentsSubmitted: true,
  });

  assert.equal(denied.allowed, false);
  assert.deepEqual(allowed, { allowed: true, action: "START_OWNERSHIP_REVIEW" });
  assert.equal(
    evaluateRequestTransition({
      from: "INFORMATION_SUBMITTED",
      to: "OWNERSHIP_REVIEW",
      actorRole: "STAFF_TECHNICAL",
      hasAsset: true,
      documentsSubmitted: true,
    }).allowed,
    false,
  );
});

test("allows supply to request missing documents after information submission", () => {
  const decision = evaluateRequestTransition({
    from: "INFORMATION_SUBMITTED",
    to: "NEEDS_INFORMATION",
    actorRole: "STAFF_SUPPLY",
    hasAsset: true,
    note: "مدارک مالکیت و فنی را بارگذاری کنید.",
  });

  assert.deepEqual(decision, { allowed: true, action: "NEED_INFO" });
});

test("allows supply to refer a document follow-up directly to technical review", () => {
  const decision = evaluateRequestTransition({
    from: "NEEDS_INFORMATION",
    to: "OWNERSHIP_REVIEW",
    actorRole: "STAFF_SUPPLY",
    hasAsset: true,
    documentsSubmitted: true,
    resumingAfterSupplyDocumentRequest: true,
  });

  assert.deepEqual(decision, { allowed: true, action: "START_OWNERSHIP_REVIEW" });
});

test("keeps technical referral blocked until all required documents are uploaded", () => {
  const decision = evaluateRequestTransition({
    from: "NEEDS_INFORMATION",
    to: "OWNERSHIP_REVIEW",
    actorRole: "STAFF_SUPPLY",
    hasAsset: true,
    documentsSubmitted: false,
    resumingAfterSupplyDocumentRequest: true,
  });

  assert.equal(decision.allowed, false);
});

test("does not bypass initial information submission or allow a seller to refer technical review", () => {
  const input = {
    from: "NEEDS_INFORMATION" as const,
    to: "OWNERSHIP_REVIEW" as const,
    hasAsset: true,
    documentsSubmitted: true,
  };

  assert.equal(evaluateRequestTransition({
    ...input,
    actorRole: "STAFF_SUPPLY",
    resumingAfterSupplyDocumentRequest: false,
  }).allowed, false);
  assert.equal(evaluateRequestTransition({
    ...input,
    actorRole: "CUSTOMER",
    resumingAfterSupplyDocumentRequest: true,
  }).allowed, false);
});

test("returns a rejected proposal to a new negotiation round", () => {
  const decision = evaluateRequestTransition({
    from: "PROPOSAL_REJECTED",
    to: "PROPOSAL_PENDING",
    actorRole: "STAFF_SUPPLY",
    hasAsset: true,
  });

  assert.deepEqual(decision, { allowed: true, action: "START_PROPOSAL" });
});

test("routes completed approved requests to supply follow-up", () => {
  assert.equal(nextStatusAfterInformationSubmission("APPROVED"), "INFORMATION_SUBMITTED");
  assert.equal(nextStatusAfterInformationSubmission("NEEDS_INFORMATION"), "INFORMATION_SUBMITTED");
  assert.equal(nextStatusAfterInformationSubmission("INFORMATION_SUBMITTED"), "INFORMATION_SUBMITTED");
  assert.equal(nextStatusAfterInformationSubmission("OWNERSHIP_REVIEW"), "OWNERSHIP_REVIEW");
});

test("requires a future follow-up date when deferring", () => {
  const decision = evaluateRequestTransition({
    from: "INITIAL_REVIEW",
    to: "DEFERRED",
    actorRole: "STAFF_SUPPLY",
    hasAsset: false,
    note: "پیگیری پس از تکمیل اتصال",
    deferredUntil: new Date("2026-01-01T00:00:00.000Z"),
    now: new Date("2026-01-02T00:00:00.000Z"),
  });

  assert.equal(decision.allowed, false);
});

test("locks complete plant information after it is submitted", () => {
  assert.equal(canCompleteRequestInformation("APPROVED"), true);
  assert.equal(canCompleteRequestInformation("NEEDS_INFORMATION"), true);
  assert.equal(canCompleteRequestInformation("INFORMATION_SUBMITTED"), false);
  assert.equal(canCompleteRequestInformation("OWNERSHIP_REVIEW"), false);
  assert.equal(canCompleteRequestInformation("CONTRACT_SIGNED"), false);
  assert.equal(canCompleteRequestInformation("ACTIVE"), false);
});
