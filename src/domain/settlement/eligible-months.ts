import { calendarMonthPeriod } from "@/domain/settlement/calendar-month";
import { parseApiDate, toPersianMonthKey } from "@/lib/persian-date";

type SettlementWindow = {
  contractStart: string;
  contractEnd: string | null;
  scheduleStart: string;
  scheduleEnd: string;
  pricingStart: string;
  pricingEnd: string | null;
  pricingActive: boolean;
  now: Date;
};

function coveredSettlementMonths(window: SettlementWindow, cutoff: Date): string[] {
  if (!window.pricingActive) return [];
  const requiredDates = [window.contractStart, window.scheduleStart, window.scheduleEnd, window.pricingStart]
    .map(parseApiDate);
  if (requiredDates.some((value) => !value)) return [];
  const optionalEndDates = [window.contractEnd, window.pricingEnd]
    .filter((value): value is string => Boolean(value))
    .map(parseApiDate);
  if (optionalEndDates.some((value) => !value)) return [];

  const beginning = new Date(Math.max(requiredDates[0]!.getTime(), requiredDates[1]!.getTime(), requiredDates[3]!.getTime()));
  const ending = new Date(Math.min(requiredDates[2]!.getTime(), cutoff.getTime(), ...optionalEndDates.map((value) => value!.getTime())));
  const result: string[] = [];
  let monthKey = toPersianMonthKey(beginning);

  for (let count = 0; count < 240; count += 1) {
    const period = calendarMonthPeriod(monthKey);
    if (!period) break;
    const periodStart = parseApiDate(period.periodStart)!;
    const periodEnd = parseApiDate(period.periodEnd)!;
    if (periodStart >= beginning && periodEnd <= ending) result.push(monthKey);
    if (periodEnd > ending) break;
    monthKey = toPersianMonthKey(periodEnd);
  }
  return result;
}

export function eligibleSettlementMonths(window: SettlementWindow): string[] {
  const completedUntil = new Date(Date.UTC(window.now.getUTCFullYear(), window.now.getUTCMonth(), window.now.getUTCDate()));
  return coveredSettlementMonths(window, completedUntil);
}

export function firstCoveredSettlementMonth(window: SettlementWindow): string | null {
  const scheduleEnd = parseApiDate(window.scheduleEnd);
  return scheduleEnd ? coveredSettlementMonths(window, scheduleEnd)[0] ?? null : null;
}
