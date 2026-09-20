import type { PricingStatus, UserRole } from "@prisma/client";

const TRANSITIONS: Partial<Record<PricingStatus, Partial<Record<PricingStatus, readonly UserRole[]>>>> = {
  DRAFT: { REVIEW: ["ADMIN", "STAFF_SUPPLY"] },
  REVIEW: {
    APPROVED: ["ADMIN", "STAFF_FINANCIAL", "MANAGER"],
    DRAFT: ["ADMIN", "STAFF_FINANCIAL", "MANAGER"],
  },
  APPROVED: { ACTIVE: ["ADMIN", "STAFF_FINANCIAL", "MANAGER"] },
  ACTIVE: { DEPRECATED: ["ADMIN", "STAFF_FINANCIAL", "MANAGER"] },
};

export function canTransitionPricingPlan(from: PricingStatus, to: PricingStatus, role: UserRole): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.[to]?.includes(role) ?? false;
}
