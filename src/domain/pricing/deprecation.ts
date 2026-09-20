import type { ContractStatus, PricingStatus } from "@prisma/client";

const FINISHED_CONTRACT_STATUSES: readonly ContractStatus[] = [
  "TERMINATED", "EXPIRED", "REJECTED", "CANCELLED",
];

export function hasOutstandingPricingObligation(input: {
  scheduleActive: boolean;
  scheduleEndDate: Date;
  contractStatus: ContractStatus;
  now: Date;
}): boolean {
  return input.scheduleActive
    && input.scheduleEndDate > input.now
    && !FINISHED_CONTRACT_STATUSES.includes(input.contractStatus);
}

export function isPricingPlanUsableForSettlement(input: {
  status: PricingStatus;
  deprecatedAt: Date | null;
  periodEnd: Date;
}): boolean {
  if (input.status === "ACTIVE") return true;
  return input.status === "DEPRECATED"
    && input.deprecatedAt !== null
    && input.periodEnd <= input.deprecatedAt;
}
