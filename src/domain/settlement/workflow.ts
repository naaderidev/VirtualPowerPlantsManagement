import type { SettlementStatus, UserRole } from "@prisma/client";

type Decision = { allowed: true } | { allowed: false; reason: string };

export function evaluateSettlementTransition(input: {
  from: SettlementStatus;
  to: SettlementStatus;
  actorRole: UserRole;
  disputeReason?: string | null;
  disputeDeadline?: Date | null;
  now?: Date;
}): Decision {
  if (input.from === input.to) return { allowed: true };
  const financial = ["ADMIN", "STAFF_FINANCIAL", "MANAGER"].includes(input.actorRole);
  const customer = ["CUSTOMER", "CUSTOMER_REPRESENTATIVE"].includes(input.actorRole);
  if (input.from === "CALCULATED" && input.to === "UNDER_REVIEW" && financial) return { allowed: true };
  if (input.from === "UNDER_REVIEW" && input.to === "CONFIRMED" && financial) return { allowed: true };
  if (["CONFIRMED", "INVOICED"].includes(input.from) && input.to === "DISPUTED" && customer) {
    if (!input.disputeReason?.trim()) return { allowed: false, reason: "برای اعتراض درج دلیل الزامی است." };
    if (!input.disputeDeadline || input.disputeDeadline < (input.now ?? new Date())) {
      return { allowed: false, reason: "مهلت اعتراض به این تسویه پایان یافته است." };
    }
    return { allowed: true };
  }
  return { allowed: false, reason: "تغییر وضعیت درخواستی در گردش تسویه مجاز نیست." };
}
