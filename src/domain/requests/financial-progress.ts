import type { RequestStatus, SettlementStatus } from "@prisma/client";

const TERMINAL_REQUEST_STATUSES = new Set<RequestStatus>(["COMPLETED", "REJECTED", "CANCELLED"]);

export function resolveRequestStatusFromSettlements(
  currentStatus: RequestStatus,
  settlementStatuses: readonly SettlementStatus[],
): RequestStatus {
  if (TERMINAL_REQUEST_STATUSES.has(currentStatus)) return currentStatus;
  if (settlementStatuses.includes("PAID")) return "COMPLETED";
  if (settlementStatuses.some((status) => ["CONFIRMED", "INVOICED", "DISPUTED", "ADJUSTED"].includes(status))) {
    return "SETTLED";
  }
  if (settlementStatuses.some((status) => ["CALCULATED", "UNDER_REVIEW"].includes(status))) {
    return "SETTLEMENT_PENDING";
  }
  return currentStatus;
}
