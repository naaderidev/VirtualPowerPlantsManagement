import { parseApiDate, toPersianMonthKey } from "@/lib/persian-date";

export type ReadingPeriod = {
  periodStart: Date;
  periodEnd: Date;
};

export type ReadingCoverageDecision =
  | { complete: true }
  | {
      complete: false;
      code: "EMPTY" | "INVALID_RANGE" | "OUT_OF_RANGE" | "GAP" | "OVERLAP";
      message: string;
    };

export function isExactUtcCalendarMonth(periodStart: Date, periodEnd: Date): boolean {
  const expected = calendarMonthPeriod(toPersianMonthKey(periodStart));
  if (!expected) return false;
  const expectedStart = parseApiDate(expected.periodStart);
  const expectedEnd = parseApiDate(expected.periodEnd);
  return expectedStart?.getTime() === periodStart.getTime()
    && expectedEnd?.getTime() === periodEnd.getTime();
}

export function calendarMonthPeriod(month: string): { periodStart: string; periodEnd: string } | null {
  const match = /^(1[2-5]\d{2})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return {
    periodStart: `${year}/${String(monthNumber).padStart(2, "0")}/01`,
    periodEnd: `${nextYear}/${String(nextMonth).padStart(2, "0")}/01`,
  };
}

export function evaluateReadingCoverage(
  periodStart: Date,
  periodEnd: Date,
  readings: readonly ReadingPeriod[]
): ReadingCoverageDecision {
  if (readings.length === 0) {
    return { complete: false, code: "EMPTY", message: "برای این ماه قرائت پذیرفته‌شده‌ای وجود ندارد." };
  }

  const orderedReadings = [...readings].sort(
    (left, right) => left.periodStart.getTime() - right.periodStart.getTime()
  );
  let coverageCursor = periodStart.getTime();
  const requiredEnd = periodEnd.getTime();

  for (const reading of orderedReadings) {
    const readingStart = reading.periodStart.getTime();
    const readingEnd = reading.periodEnd.getTime();
    if (readingEnd <= readingStart) {
      return { complete: false, code: "INVALID_RANGE", message: "حداقل یک قرائت بازه زمانی نامعتبر دارد." };
    }
    if (readingStart < periodStart.getTime() || readingEnd > requiredEnd) {
      return { complete: false, code: "OUT_OF_RANGE", message: "قرائت‌ها باید دقیقاً داخل ماه تسویه باشند." };
    }
    if (readingStart < coverageCursor) {
      return { complete: false, code: "OVERLAP", message: "قرائت‌های پذیرفته‌شده هم‌پوشانی دارند." };
    }
    if (readingStart > coverageCursor) {
      return { complete: false, code: "GAP", message: "بین قرائت‌های پذیرفته‌شده شکاف زمانی وجود دارد." };
    }
    coverageCursor = readingEnd;
  }

  if (coverageCursor !== requiredEnd) {
    return { complete: false, code: "GAP", message: "قرائت‌های پذیرفته‌شده تمام ماه را پوشش نمی‌دهند." };
  }
  return { complete: true };
}
