import type { DocumentType } from "@prisma/client";

export const REQUEST_DOCUMENT_TYPES = [
  { type: "OWNERSHIP", label: "مدارک مالکیت" },
  { type: "REPRESENTATION", label: "مدارک نمایندگی" },
  { type: "LICENSE", label: "مجوزها" },
  { type: "CONNECTION", label: "مدارک اتصال" },
  { type: "METER", label: "مدارک کنتور" },
  { type: "TECHNICAL", label: "مدارک فنی" },
  { type: "LEGAL", label: "مدارک حقوقی و قرارداد فروش موجود" },
] as const satisfies ReadonlyArray<{ type: DocumentType; label: string }>;

export const REQUIRED_REQUEST_DOCUMENT_TYPES = REQUEST_DOCUMENT_TYPES
  .map(({ type }) => type)
  .filter((type) => type !== "LEGAL");

export type RequestDocumentContext = {
  operationalStatus?: string;
  hasExistingContract?: boolean;
};

export function getRequiredRequestDocumentTypes(
  context: RequestDocumentContext = {},
): DocumentType[] {
  const required: DocumentType[] = context.operationalStatus && context.operationalStatus !== "ACTIVE"
    ? REQUIRED_REQUEST_DOCUMENT_TYPES.filter((type) => !["CONNECTION", "METER"].includes(type))
    : [...REQUIRED_REQUEST_DOCUMENT_TYPES];
  if (context.hasExistingContract) required.push("LEGAL");
  return required;
}

export type RequestDocumentReadiness = {
  submitted: boolean;
  ready: boolean;
  missingTypes: DocumentType[];
  unverifiedTypes: DocumentType[];
};

type InitialReviewTransition = {
  action: string;
  fromStatus: string;
  toStatus: string;
};

type ResumeOwnershipReviewInput = {
  requestStatus: string;
  latestNeedInformationReview: InitialReviewTransition | null;
  documentsReady: boolean;
  documentIsBeingVerified: boolean;
};

export function canCustomerUploadRequestDocuments(
  reviews: ReadonlyArray<InitialReviewTransition>,
): boolean {
  return reviews.some(
    ({ action, fromStatus, toStatus }) =>
      fromStatus === "INITIAL_REVIEW" &&
      ((action === "APPROVE" && toStatus === "APPROVED") ||
        (action === "NEED_INFO" && toStatus === "NEEDS_INFORMATION")),
  );
}

export function shouldResumeOwnershipReviewAfterDocumentVerification({
  requestStatus,
  latestNeedInformationReview,
  documentsReady,
  documentIsBeingVerified,
}: ResumeOwnershipReviewInput): boolean {
  if (!documentIsBeingVerified || !documentsReady) return false;
  if (!["NEEDS_INFORMATION", "INFORMATION_SUBMITTED"].includes(requestStatus)) {
    return false;
  }

  return (
    latestNeedInformationReview?.action === "NEED_INFO" &&
    latestNeedInformationReview.fromStatus === "OWNERSHIP_REVIEW" &&
    latestNeedInformationReview.toStatus === "NEEDS_INFORMATION"
  );
}

export function getRequestDocumentReadiness(
  requestId: string,
  documents: ReadonlyArray<{ requestId: string; type: DocumentType; verified: boolean }>,
  context: RequestDocumentContext = {},
): RequestDocumentReadiness {
  const documentsForRequest = documents.filter((document) => document.requestId === requestId);
  const byType = new Map(documentsForRequest.map((document) => [document.type, document]));
  const requiredTypes = getRequiredRequestDocumentTypes(context);
  const missingTypes = requiredTypes.filter((type) => !byType.has(type));
  const unverifiedTypes = requiredTypes.filter(
    (type) => byType.has(type) && !byType.get(type)?.verified
  );

  return {
    submitted: missingTypes.length === 0,
    ready: missingTypes.length === 0 && unverifiedTypes.length === 0,
    missingTypes,
    unverifiedTypes,
  };
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  OWNERSHIP: "مدارک مالکیت",
  REPRESENTATION: "مدارک نمایندگی",
  LICENSE: "مجوزها",
  CONNECTION: "مدارک اتصال",
  METER: "مدارک کنتور",
  TECHNICAL: "مدارک فنی",
  LEGAL: "مدارک حقوقی",
  FINANCIAL: "مدارک مالی",
  OTHER: "سایر مدارک",
};

export function getDocumentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as DocumentType] ?? type;
}
