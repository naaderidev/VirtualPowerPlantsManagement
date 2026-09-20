import { calendarMonthPeriod, isExactUtcCalendarMonth } from "@/domain/settlement/calendar-month";
import { formatApiDate, parseApiDate, toPersianMonthKey } from "@/lib/persian-date";

export type ReadingInterval = "MONTHLY" | "DAILY" | "HOURLY";

type SuggestionInput = {
  scheduleStart: Date;
  scheduleEnd: Date;
  lastReadingEnd: Date | null;
  interval: ReadingInterval;
  now: Date;
};

export type ReadingPeriodSuggestion = {
  periodStart: string;
  periodEnd: string;
  ready: boolean;
  fullSettlementMonth: boolean;
};

function nextMonthBoundary(date: Date): Date | null {
  const month = calendarMonthPeriod(toPersianMonthKey(date));
  return month ? parseApiDate(month.periodEnd) : null;
}

export function suggestReadingPeriod(input: SuggestionInput): ReadingPeriodSuggestion | null {
  const start = new Date(Math.max(input.scheduleStart.getTime(), input.lastReadingEnd?.getTime() ?? 0));
  if (start >= input.scheduleEnd) return null;

  const nextEnd = input.interval === "MONTHLY"
    ? nextMonthBoundary(start)
    : new Date(start.getTime() + (input.interval === "DAILY" ? 86_400_000 : 3_600_000));
  if (!nextEnd) return null;
  const end = new Date(Math.min(nextEnd.getTime(), input.scheduleEnd.getTime()));

  const withTime = input.interval === "HOURLY";
  const completedUntil = withTime
    ? input.now
    : new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth(), input.now.getUTCDate()));

  return {
    periodStart: formatApiDate(start, withTime ? undefined : "periodStart"),
    periodEnd: formatApiDate(end, withTime ? undefined : "periodEnd"),
    ready: end <= completedUntil,
    fullSettlementMonth: isExactUtcCalendarMonth(start, end),
  };
}
