import type { ContractStatus } from "@prisma/client";
import { calendarMonthPeriod } from "@/domain/settlement/calendar-month";
import { formatApiDate, parseApiDate, toPersianMonthKey } from "@/lib/persian-date";

export function isContractOperational(status: ContractStatus): boolean {
  return status === "ACTIVE" || status === "TERMINATION_PENDING";
}

export function canSettleContractPeriod(
  status: ContractStatus,
  periodEnd: Date,
  terminationDate: Date | null,
): boolean {
  if (isContractOperational(status)) return true;
  return status === "TERMINATED" && terminationDate !== null && periodEnd <= terminationDate;
}

export function currentTerminationBoundary(now: Date): Date | null {
  const month = calendarMonthPeriod(toPersianMonthKey(now));
  if (!month || formatApiDate(now, "terminationDate") !== month.periodStart) return null;
  return parseApiDate(month.periodStart);
}

export function nextTerminationBoundary(now: Date): string | null {
  return calendarMonthPeriod(toPersianMonthKey(now))?.periodEnd ?? null;
}
