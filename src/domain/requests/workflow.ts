import type { RequestStatus, ReviewAction, UserRole } from "@prisma/client";

type RequestTransition = {
  action: ReviewAction;
  roles: readonly UserRole[];
  requiresAsset?: boolean;
  requiresVerifiedDocuments?: boolean;
  requiresSubmittedDocuments?: boolean;
  requiresNote?: boolean;
  requiresDeferredUntil?: boolean;
};

const ALL_INTERNAL_ROLES = [
  "ADMIN",
  "STAFF_SUPPLY",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
  "STAFF_FINANCIAL",
  "MANAGER",
] as const satisfies readonly UserRole[];

const SUPPLY_ROLES = ["ADMIN", "STAFF_SUPPLY", "MANAGER"] as const satisfies readonly UserRole[];
const OWNERSHIP_ROLES = [
  "ADMIN",
  "STAFF_TECHNICAL",
  "STAFF_LEGAL",
  "MANAGER",
] as const satisfies readonly UserRole[];
const CUSTOMER_ROLES = ["CUSTOMER", "CUSTOMER_REPRESENTATIVE"] as const satisfies readonly UserRole[];

const REQUEST_TRANSITIONS: Partial<
  Record<RequestStatus, Partial<Record<RequestStatus, RequestTransition>>>
> = {
  SUBMITTED: {
    INITIAL_REVIEW: { action: "START_REVIEW", roles: SUPPLY_ROLES },
    CANCELLED: { action: "CANCEL", roles: [...SUPPLY_ROLES, ...CUSTOMER_ROLES], requiresNote: true },
  },
  INITIAL_REVIEW: {
    NEEDS_INFORMATION: { action: "NEED_INFO", roles: SUPPLY_ROLES, requiresNote: true },
    DEFERRED: {
      action: "DEFER",
      roles: SUPPLY_ROLES,
      requiresNote: true,
      requiresDeferredUntil: true,
    },
    REJECTED: { action: "REJECT", roles: SUPPLY_ROLES, requiresNote: true },
    APPROVED: { action: "APPROVE", roles: SUPPLY_ROLES },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  NEEDS_INFORMATION: {
    INFORMATION_SUBMITTED: { action: "SUBMIT_INFORMATION", roles: CUSTOMER_ROLES, requiresAsset: true },
    OWNERSHIP_REVIEW: {
      action: "START_OWNERSHIP_REVIEW",
      roles: SUPPLY_ROLES,
      requiresAsset: true,
      requiresSubmittedDocuments: true,
    },
    CANCELLED: { action: "CANCEL", roles: [...SUPPLY_ROLES, ...CUSTOMER_ROLES], requiresNote: true },
  },
  INFORMATION_SUBMITTED: {
    NEEDS_INFORMATION: { action: "NEED_INFO", roles: SUPPLY_ROLES, requiresNote: true },
    OWNERSHIP_REVIEW: {
      action: "START_OWNERSHIP_REVIEW",
      roles: SUPPLY_ROLES,
      requiresAsset: true,
      requiresSubmittedDocuments: true,
    },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  DEFERRED: {
    SUBMITTED: { action: "START_REVIEW", roles: ["ADMIN"] },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  APPROVED: {
    OWNERSHIP_REVIEW: {
      action: "START_OWNERSHIP_REVIEW",
      roles: [...SUPPLY_ROLES, ...OWNERSHIP_ROLES],
      requiresAsset: true,
    },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  OWNERSHIP_REVIEW: {
    NEEDS_INFORMATION: { action: "NEED_INFO", roles: OWNERSHIP_ROLES, requiresNote: true },
    REJECTED: { action: "REJECT", roles: OWNERSHIP_ROLES, requiresNote: true },
    PROPOSAL_PENDING: {
      action: "START_PROPOSAL",
      roles: OWNERSHIP_ROLES,
      requiresAsset: true,
      requiresVerifiedDocuments: true,
    },
    CANCELLED: { action: "CANCEL", roles: [...OWNERSHIP_ROLES, ...SUPPLY_ROLES], requiresNote: true },
  },
  PROPOSAL_PENDING: {
    PROPOSAL_READY: { action: "APPROVE", roles: ["ADMIN", "STAFF_SUPPLY"] },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  PROPOSAL_READY: {
    PROPOSAL_ACCEPTED: { action: "APPROVE", roles: CUSTOMER_ROLES },
    PROPOSAL_REJECTED: { action: "REJECT", roles: CUSTOMER_ROLES },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  PROPOSAL_ACCEPTED: {
    CONTRACT_PENDING: { action: "APPROVE", roles: ["ADMIN", "STAFF_SUPPLY"] },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  PROPOSAL_REJECTED: {
    PROPOSAL_PENDING: { action: "START_PROPOSAL", roles: SUPPLY_ROLES },
    CANCELLED: { action: "CANCEL", roles: SUPPLY_ROLES, requiresNote: true },
  },
  CONTRACT_PENDING: {
    CONTRACT_SIGNED: { action: "APPROVE", roles: ["ADMIN", "STAFF_LEGAL", "MANAGER"] },
    CANCELLED: { action: "CANCEL", roles: ["ADMIN", "STAFF_LEGAL", "MANAGER"], requiresNote: true },
  },
  CONTRACT_SIGNED: {
    ACTIVE: { action: "APPROVE", roles: ["ADMIN"] },
  },
  ACTIVE: {
    SETTLEMENT_PENDING: { action: "APPROVE", roles: ["ADMIN"] },
  },
  SETTLEMENT_PENDING: {
    SETTLED: { action: "APPROVE", roles: ["ADMIN", "STAFF_FINANCIAL", "MANAGER"] },
  },
  SETTLED: {
    COMPLETED: { action: "APPROVE", roles: ["ADMIN"] },
  },
};

export type RequestTransitionInput = {
  from: RequestStatus;
  to: RequestStatus;
  actorRole: UserRole;
  hasAsset: boolean;
  documentsReady?: boolean;
  documentsSubmitted?: boolean;
  resumingAfterSupplyDocumentRequest?: boolean;
  note?: string | null;
  deferredUntil?: Date | null;
  now?: Date;
};

export type RequestTransitionDecision =
  | { allowed: true; action: ReviewAction }
  | { allowed: false; reason: string };

export function evaluateRequestTransition(input: RequestTransitionInput): RequestTransitionDecision {
  if (input.from === input.to) return { allowed: true, action: "NOTE" };

  const transition = REQUEST_TRANSITIONS[input.from]?.[input.to];
  if (!transition) return { allowed: false, reason: "تغییر وضعیت درخواستی در گردش کار مجاز نیست." };
  if (!transition.roles.includes(input.actorRole)) {
    return { allowed: false, reason: "نقش کاربر اجازه این تغییر وضعیت را ندارد." };
  }
  if (
    input.from === "NEEDS_INFORMATION" &&
    input.to === "OWNERSHIP_REVIEW" &&
    !input.resumingAfterSupplyDocumentRequest
  ) {
    return {
      allowed: false,
      reason: "ابتدا اطلاعات نیروگاه باید ارسال شده و درخواست مدارک تکمیلی از سوی تأمین ثبت شده باشد.",
    };
  }
  if (transition.requiresAsset && !input.hasAsset) {
    return { allowed: false, reason: "پیش از این تغییر وضعیت باید اطلاعات نیروگاه تکمیل شود." };
  }
  if (transition.requiresSubmittedDocuments && !input.documentsSubmitted) {
    return {
      allowed: false,
      reason: "تمام مدارک الزامی همین پرونده باید پیش از ارجاع به بررسی فنی بارگذاری شوند.",
    };
  }
  if (transition.requiresVerifiedDocuments && !input.documentsReady) {
    return {
      allowed: false,
      reason: "تمام مدارک الزامی همین پرونده باید پیش از تهیه پیشنهاد تأیید شوند.",
    };
  }
  if (transition.requiresNote && !input.note?.trim()) {
    return { allowed: false, reason: "برای این تصمیم درج دلیل الزامی است." };
  }
  if (transition.requiresDeferredUntil) {
    const now = input.now ?? new Date();
    if (!input.deferredUntil || input.deferredUntil <= now) {
      return { allowed: false, reason: "زمان پیگیری باید در آینده باشد." };
    }
  }

  return { allowed: true, action: transition.action };
}

export function canRoleTransitionRequest(
  from: RequestStatus,
  to: RequestStatus,
  role: UserRole
): boolean {
  return REQUEST_TRANSITIONS[from]?.[to]?.roles.includes(role) ?? false;
}

export function canCompleteRequestInformation(status: RequestStatus): boolean {
  return status === "APPROVED" || status === "NEEDS_INFORMATION";
}

export function nextStatusAfterInformationSubmission(status: RequestStatus): RequestStatus {
  if (status === "APPROVED") return "INFORMATION_SUBMITTED";
  if (status === "NEEDS_INFORMATION") return "INFORMATION_SUBMITTED";
  return status;
}

export function canAddRequestNote(role: UserRole): boolean {
  return (ALL_INTERNAL_ROLES as readonly UserRole[]).includes(role);
}
