import type { ContractStatus, UserRole } from "@prisma/client";

type TransitionRule = {
  roles: readonly UserRole[];
  requiresCompleteConfiguration?: boolean;
  requiresNote?: boolean;
  requiresAllSignatures?: boolean;
  requiresEffectiveDate?: boolean;
};

const SUPPLY = ["ADMIN", "STAFF_SUPPLY"] as const satisfies readonly UserRole[];
const REVIEWERS = ["ADMIN", "STAFF_LEGAL", "MANAGER"] as const satisfies readonly UserRole[];

const TRANSITIONS: Partial<Record<ContractStatus, Partial<Record<ContractStatus, TransitionRule>>>> = {
  DRAFT: {
    CONFIGURED: { roles: SUPPLY, requiresCompleteConfiguration: true },
    CANCELLED: { roles: SUPPLY, requiresNote: true },
  },
  CONFIGURED: {
    INTERNAL_REVIEW: { roles: SUPPLY, requiresCompleteConfiguration: true },
    CANCELLED: { roles: SUPPLY, requiresNote: true },
  },
  INTERNAL_REVIEW: {
    NEEDS_CHANGES: { roles: REVIEWERS, requiresNote: true },
    PENDING_SIGNATURE: { roles: REVIEWERS, requiresCompleteConfiguration: true },
    REJECTED: { roles: REVIEWERS, requiresNote: true },
  },
  NEEDS_CHANGES: {
    CONFIGURED: { roles: SUPPLY, requiresCompleteConfiguration: true },
    CANCELLED: { roles: SUPPLY, requiresNote: true },
  },
  PENDING_SIGNATURE: {
    SIGNED: { roles: ["ADMIN"], requiresAllSignatures: true },
  },
  SIGNED: {
    ACTIVE: {
      roles: ["ADMIN"],
      requiresCompleteConfiguration: true,
      requiresAllSignatures: true,
      requiresEffectiveDate: true,
    },
  },
  ACTIVE: {
    AMENDMENT_PENDING: { roles: ["ADMIN", "STAFF_SUPPLY", "STAFF_LEGAL", "MANAGER"] },
    TERMINATION_PENDING: { roles: REVIEWERS, requiresNote: true },
  },
  AMENDMENT_PENDING: { ACTIVE: { roles: REVIEWERS } },
  TERMINATION_PENDING: {
    TERMINATED: { roles: REVIEWERS, requiresNote: true },
    ACTIVE: { roles: REVIEWERS, requiresNote: true },
  },
};

export type ContractTransitionInput = {
  from: ContractStatus;
  to: ContractStatus;
  actorRole: UserRole;
  configurationComplete: boolean;
  allRequiredPartiesSigned: boolean;
  effectiveDate: Date;
  note?: string | null;
  now?: Date;
};

export type ContractTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export function evaluateContractTransition(input: ContractTransitionInput): ContractTransitionDecision {
  if (input.from === input.to) return { allowed: true };
  const rule = TRANSITIONS[input.from]?.[input.to];
  if (!rule) return { allowed: false, reason: "تغییر وضعیت درخواستی در گردش کار قرارداد مجاز نیست." };
  if (!rule.roles.includes(input.actorRole)) {
    return { allowed: false, reason: "نقش کاربر اجازه این تغییر وضعیت قرارداد را ندارد." };
  }
  if (rule.requiresCompleteConfiguration && !input.configurationComplete) {
    return { allowed: false, reason: "پیکربندی قرارداد هنوز کامل نیست." };
  }
  if (rule.requiresAllSignatures && !input.allRequiredPartiesSigned) {
    return { allowed: false, reason: "امضای همه طرف‌های اصلی قرارداد ثبت نشده است." };
  }
  if (rule.requiresEffectiveDate && input.effectiveDate > (input.now ?? new Date())) {
    return { allowed: false, reason: "پیش از تاریخ مؤثر قرارداد امکان فعال‌سازی وجود ندارد." };
  }
  if (rule.requiresNote && !input.note?.trim()) {
    return { allowed: false, reason: "برای این تصمیم درج دلیل الزامی است." };
  }
  return { allowed: true };
}

export function canRoleTransitionContract(
  from: ContractStatus,
  to: ContractStatus,
  role: UserRole
): boolean {
  return TRANSITIONS[from]?.[to]?.roles.includes(role) ?? false;
}

export function canEditContractConfiguration(status: ContractStatus): boolean {
  return ["DRAFT", "CONFIGURED", "NEEDS_CHANGES"].includes(status);
}
