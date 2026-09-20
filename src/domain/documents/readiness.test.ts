import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_REQUEST_DOCUMENT_TYPES,
  canCustomerUploadRequestDocuments,
  getRequestDocumentReadiness,
  shouldResumeOwnershipReviewAfterDocumentVerification,
} from "./index";

test("requires every required document to belong to and be verified for the same request", () => {
  const firstRequestDocuments = REQUIRED_REQUEST_DOCUMENT_TYPES.map((type) => ({
    requestId: "request-a",
    type,
    verified: true,
  }));
  const ready = getRequestDocumentReadiness("request-a", firstRequestDocuments);
  const otherRequest = getRequestDocumentReadiness("request-b", firstRequestDocuments);

  assert.equal(ready.ready, true);
  assert.equal(ready.submitted, true);
  assert.equal(otherRequest.ready, false);
  assert.equal(otherRequest.submitted, false);
  assert.deepEqual(otherRequest.missingTypes, REQUIRED_REQUEST_DOCUMENT_TYPES);
});

test("reports missing and unverified document categories independently", () => {
  const [ownership, representation] = REQUIRED_REQUEST_DOCUMENT_TYPES;
  const result = getRequestDocumentReadiness("request-a", [
    { requestId: "request-a", type: ownership, verified: false },
    { requestId: "request-a", type: representation, verified: true },
  ]);

  assert.equal(result.ready, false);
  assert.equal(result.submitted, false);
  assert.deepEqual(result.unverifiedTypes, [ownership]);
  assert.equal(result.missingTypes.includes(representation), false);
});

test("distinguishes fully uploaded documents from fully verified documents", () => {
  const uploadedDocuments = REQUIRED_REQUEST_DOCUMENT_TYPES.map((type) => ({
    requestId: "request-a",
    type,
    verified: false,
  }));

  const result = getRequestDocumentReadiness("request-a", uploadedDocuments);

  assert.equal(result.submitted, true);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missingTypes, []);
  assert.deepEqual(result.unverifiedTypes, REQUIRED_REQUEST_DOCUMENT_TYPES);
});

test("defers connection and meter evidence for a non-operational plant", () => {
  const result = getRequestDocumentReadiness("request-a", [], {
    operationalStatus: "UNDER_CONSTRUCTION",
    hasExistingContract: false,
  });
  assert.equal(result.missingTypes.includes("CONNECTION"), false);
  assert.equal(result.missingTypes.includes("METER"), false);
});

test("requires legal evidence when an existing sales contract is declared", () => {
  const result = getRequestDocumentReadiness("request-a", [], {
    operationalStatus: "PLANNING",
    hasExistingContract: true,
  });
  assert.equal(result.missingTypes.includes("LEGAL"), true);
});

test("blocks customer document uploads until supply completes the initial review", () => {
  assert.equal(canCustomerUploadRequestDocuments([]), false);
  assert.equal(
    canCustomerUploadRequestDocuments([
      {
        action: "START_REVIEW",
        fromStatus: "SUBMITTED",
        toStatus: "INITIAL_REVIEW",
      },
    ]),
    false,
  );
  assert.equal(
    canCustomerUploadRequestDocuments([
      {
        action: "REJECT",
        fromStatus: "INITIAL_REVIEW",
        toStatus: "REJECTED",
      },
    ]),
    false,
  );
});

test("allows document uploads when initial review requests more information", () => {
  assert.equal(
    canCustomerUploadRequestDocuments([
      {
        action: "NEED_INFO",
        fromStatus: "INITIAL_REVIEW",
        toStatus: "NEEDS_INFORMATION",
      },
      {
        action: "SUBMIT_INFORMATION",
        fromStatus: "NEEDS_INFORMATION",
        toStatus: "INFORMATION_SUBMITTED",
      },
    ]),
    true,
  );
});

test("keeps document uploads available after a completed initial approval", () => {
  assert.equal(
    canCustomerUploadRequestDocuments([
      {
        action: "APPROVE",
        fromStatus: "INITIAL_REVIEW",
        toStatus: "APPROVED",
      },
      {
        action: "NEED_INFO",
        fromStatus: "OWNERSHIP_REVIEW",
        toStatus: "NEEDS_INFORMATION",
      },
    ]),
    true,
  );
});

test("resumes ownership review after the last corrected document is verified", () => {
  const latestNeedInformationReview = {
    action: "NEED_INFO",
    fromStatus: "OWNERSHIP_REVIEW",
    toStatus: "NEEDS_INFORMATION",
  };

  assert.equal(
    shouldResumeOwnershipReviewAfterDocumentVerification({
      requestStatus: "NEEDS_INFORMATION",
      latestNeedInformationReview,
      documentsReady: true,
      documentIsBeingVerified: true,
    }),
    true,
  );
  assert.equal(
    shouldResumeOwnershipReviewAfterDocumentVerification({
      requestStatus: "INFORMATION_SUBMITTED",
      latestNeedInformationReview,
      documentsReady: true,
      documentIsBeingVerified: true,
    }),
    true,
  );
});

test("does not resume ownership review for incomplete or initial-review corrections", () => {
  const baseInput = {
    requestStatus: "NEEDS_INFORMATION",
    latestNeedInformationReview: {
      action: "NEED_INFO",
      fromStatus: "OWNERSHIP_REVIEW",
      toStatus: "NEEDS_INFORMATION",
    },
    documentsReady: true,
    documentIsBeingVerified: true,
  };

  assert.equal(
    shouldResumeOwnershipReviewAfterDocumentVerification({
      ...baseInput,
      documentsReady: false,
    }),
    false,
  );
  assert.equal(
    shouldResumeOwnershipReviewAfterDocumentVerification({
      ...baseInput,
      documentIsBeingVerified: false,
    }),
    false,
  );
  assert.equal(
    shouldResumeOwnershipReviewAfterDocumentVerification({
      ...baseInput,
      latestNeedInformationReview: {
        action: "NEED_INFO",
        fromStatus: "INITIAL_REVIEW",
        toStatus: "NEEDS_INFORMATION",
      },
    }),
    false,
  );
});
