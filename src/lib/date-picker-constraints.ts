import { formatApiDate, parseApiDate } from "@/lib/persian-date";

type DateBounds = {
  minDate?: string;
  maxDate?: string;
  minExclusiveDate?: string;
  maxExclusiveDate?: string;
  withTime?: boolean;
};

function moveDate(value: string, amount: number, withTime: boolean): string | undefined {
  const parsed = parseApiDate(value);
  if (!parsed) return undefined;
  const moved = new Date(parsed.getTime() + amount * (withTime ? 60_000 : 86_400_000));
  return formatApiDate(moved, withTime ? undefined : "effectiveDate");
}

export function effectiveDateBounds(bounds: DateBounds): { minDate?: string; maxDate?: string } {
  const exclusiveMinimum = bounds.minExclusiveDate
    ? moveDate(bounds.minExclusiveDate, 1, Boolean(bounds.withTime))
    : undefined;
  const exclusiveMaximum = bounds.maxExclusiveDate
    ? moveDate(bounds.maxExclusiveDate, -1, Boolean(bounds.withTime))
    : undefined;
  const minimum = [bounds.minDate, exclusiveMinimum].filter((value): value is string => Boolean(value));
  const maximum = [bounds.maxDate, exclusiveMaximum].filter((value): value is string => Boolean(value));
  const order = (left: string, right: string) => (parseApiDate(left)?.getTime() ?? 0) - (parseApiDate(right)?.getTime() ?? 0);
  return {
    minDate: minimum.sort(order).at(-1),
    maxDate: maximum.sort(order)[0],
  };
}

export function dateWithinBounds(value: string, bounds: DateBounds): boolean {
  const selected = parseApiDate(value)?.getTime();
  if (selected == null) return false;
  const { minDate, maxDate } = effectiveDateBounds(bounds);
  const minimum = minDate ? parseApiDate(minDate)?.getTime() : undefined;
  const maximum = maxDate ? parseApiDate(maxDate)?.getTime() : undefined;
  return (minimum == null || selected >= minimum) && (maximum == null || selected <= maximum);
}
