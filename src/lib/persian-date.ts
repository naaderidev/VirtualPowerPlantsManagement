import DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import gregorianEn from "react-date-object/locales/gregorian_en";
import persianEn from "react-date-object/locales/persian_en";
import persianFa from "react-date-object/locales/persian_fa";

const PERSIAN_DATE_PATTERN = /^([۱1][۲-۵2-5][۰-۹0-9]{2})[/-]([۰-۹0-9]{1,2})[/-]([۰-۹0-9]{1,2})(?:[T\s]([۰-۹0-9]{1,2}):([۰-۹0-9]{1,2})(?::([۰-۹0-9]{1,2}))?)?$/;

const DATE_ONLY_FIELDS = new Set([
  "connectionDate",
  "deferredUntil",
  "disputeDeadline",
  "dueDate",
  "effectiveDate",
  "endDate",
  "existingContractEnd",
  "existingContractStart",
  "expirationDate",
  "installDate",
  "issueDate",
  "operationalDate",
  "paymentDate",
  "periodEnd",
  "periodStart",
  "startDate",
  "terminationDate",
  "validFrom",
  "validTo",
  "validUntil",
]);

function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function createPersianDateObject(value: string): DateObject | null {
  const normalized = toEnglishDigits(value.trim());
  const match = PERSIAN_DATE_PATTERN.exec(normalized);
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const date = new DateObject({
    calendar: persian,
    locale: persianEn,
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  });
  return date.isValid ? date : null;
}

export function parseApiDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const persianDate = createPersianDateObject(value);
  if (persianDate) {
    const includesTime = /[T\s]\d{1,2}:\d{1,2}/.test(toEnglishDigits(value));
    if (includesTime) return persianDate.toDate();
    const converted = persianDate.convert(gregorian, gregorianEn);
    return new Date(Date.UTC(converted.year, converted.month.number - 1, converted.day));
  }

  // Compatibility for persisted ISO values and internal server calls during migration.
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPersianDateObject(value: string | Date): DateObject | null {
  if (typeof value === "string") {
    const persianDate = createPersianDateObject(value);
    if (persianDate) return persianDate.convert(persian, persianFa);
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new DateObject(parsed).convert(persian, persianFa);
}

export function formatPersianDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return toPersianDateObject(value)?.format("YYYY/MM/DD") ?? "—";
}

export function formatPersianDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return toPersianDateObject(value)?.format("YYYY/MM/DD HH:mm") ?? "—";
}

export function formatPersianMonth(value: string | null | undefined): string {
  if (!value) return "—";
  const normalized = toEnglishDigits(value).replace("-", "/");
  return createPersianDateObject(`${normalized}/01`)?.convert(persian, persianFa).format("YYYY/MM") ?? "—";
}

export function formatApiDate(date: Date, fieldName?: string): string {
  const dateObject = new DateObject(date).convert(persian, persianEn);
  return dateObject.format(fieldName && DATE_ONLY_FIELDS.has(fieldName) ? "YYYY/MM/DD" : "YYYY/MM/DD HH:mm:ss");
}

export function toPersianMonthKey(date: Date): string {
  return formatApiDate(date, "effectiveDate").slice(0, 7).replace("/", "-");
}

export function addPersianMonths(date: Date, months: number): Date {
  const converted = new DateObject(date)
    .convert(persian, persianEn)
    .add(months, "month")
    .convert(gregorian, gregorianEn);
  return new Date(Date.UTC(converted.year, converted.month.number - 1, converted.day));
}

export function serializeApiDates(value: unknown, fieldName?: string): unknown {
  if (value instanceof Date) return formatApiDate(value, fieldName);
  if (Array.isArray(value)) return value.map((item) => serializeApiDates(item, fieldName));
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeApiDates(item, key)]),
  );
}
