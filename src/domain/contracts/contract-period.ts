import { calendarMonthPeriod } from "@/domain/settlement/calendar-month";
import { addPersianMonths, formatApiDate, parseApiDate, toPersianMonthKey } from "@/lib/persian-date";

export type ContractPeriod = {
  effectiveDate: string;
  expirationDate: string;
};

export type ContractPeriodIssue = {
  field: "effectiveDate" | "expirationDate";
  message: string;
};

function parseDateInput(value: string): Date | null {
  return parseApiDate(value);
}

export function toLocalDateInput(date: Date): string {
  return formatApiDate(date, "effectiveDate");
}

export function fullSettlementMonths(period: ContractPeriod): string[] {
  const start = parseDateInput(period.effectiveDate);
  const end = parseDateInput(period.expirationDate);
  if (!start || !end || end <= start) return [];

  const months: string[] = [];
  let month = toPersianMonthKey(start);
  for (let count = 0; count < 240; count += 1) {
    const bounds = calendarMonthPeriod(month);
    if (!bounds) break;
    const monthStart = parseApiDate(bounds.periodStart)!;
    const monthEnd = parseApiDate(bounds.periodEnd)!;
    if (monthStart >= start && monthEnd <= end) months.push(month);
    if (monthEnd >= end) break;
    month = toPersianMonthKey(monthEnd);
  }
  return months;
}

export function alignContractPeriodToFullMonths(period: ContractPeriod): ContractPeriod | null {
  const start = parseDateInput(period.effectiveDate);
  const end = parseDateInput(period.expirationDate);
  if (!start || !end || end <= start) return null;
  const [startYear, startMonth] = toPersianMonthKey(start).split("-").map(Number);
  const [endYear, endMonth] = toPersianMonthKey(end).split("-").map(Number);
  const durationMonths = Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth);
  const month = calendarMonthPeriod(toPersianMonthKey(start));
  if (!month) return null;
  const alignedStart = parseDateInput(period.effectiveDate.endsWith("/01") ? month.periodStart : month.periodEnd);
  if (!alignedStart) return null;
  return {
    effectiveDate: toLocalDateInput(alignedStart),
    expirationDate: toLocalDateInput(addPersianMonths(alignedStart, durationMonths)),
  };
}

export function suggestContractPeriod(input: {
  today?: Date;
  durationMonths?: number | null;
  operationalDates?: readonly (string | null | undefined)[];
}): ContractPeriod {
  const today = input.today ?? new Date();
  let suggestedStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const value of input.operationalDates ?? []) {
    if (!value) continue;
    const operationalDate = parseDateInput(value);
    if (operationalDate && operationalDate > suggestedStart) suggestedStart = operationalDate;
  }

  const durationMonths = Math.max(1, Math.trunc(input.durationMonths ?? 12));
  return {
    effectiveDate: toLocalDateInput(suggestedStart),
    expirationDate: toLocalDateInput(addPersianMonths(suggestedStart, durationMonths)),
  };
}

export function getContractPeriodIssue(
  period: ContractPeriod,
  today = new Date(),
): ContractPeriodIssue | null {
  const effectiveDate = parseDateInput(period.effectiveDate);
  const expirationDate = parseDateInput(period.expirationDate);
  if (!effectiveDate) return { field: "effectiveDate", message: "تاریخ شروع معتبر را انتخاب کنید." };
  if (!expirationDate) return { field: "expirationDate", message: "تاریخ پایان معتبر را انتخاب کنید." };
  if (expirationDate <= effectiveDate) {
    return { field: "expirationDate", message: "تاریخ پایان باید بعد از تاریخ شروع باشد." };
  }

  const todayStart = parseApiDate(formatApiDate(today, "effectiveDate")) ?? today;
  if (expirationDate < todayStart) {
    return { field: "expirationDate", message: "تاریخ پایان قرارداد نمی‌تواند گذشته باشد." };
  }
  return null;
}
