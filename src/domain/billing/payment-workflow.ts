import type { PaymentStatus } from "@prisma/client";

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return from === "PENDING" && (to === "CONFIRMED" || to === "REJECTED");
}
