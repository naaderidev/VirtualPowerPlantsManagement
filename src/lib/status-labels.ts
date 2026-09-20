/** Human-readable labels for persisted workflow states. API and database values stay unchanged. */
export const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  SUBMITTED: "ارسال‌شده",
  INITIAL_REVIEW: "در حال بررسی اولیه",
  NEEDS_INFORMATION: "نیاز به اطلاعات",
  INFORMATION_SUBMITTED: "اطلاعات ارسال‌شده",
  APPROVED: "تأییدشده",
  OWNERSHIP_REVIEW: "در حال بررسی مالکیت",
  PROPOSAL_PENDING: "در حال تهیه پیشنهاد",
  PROPOSAL_READY: "پیشنهاد آماده",
  PROPOSAL_ACCEPTED: "پیشنهاد پذیرفته‌شده",
  PROPOSAL_REJECTED: "پیشنهاد ردشده",
  CONTRACT_PENDING: "در حال تنظیم قرارداد",
  CONTRACT_SIGNED: "قرارداد امضاشده",
  ACTIVE: "فعال",
  SETTLEMENT_PENDING: "در انتظار تسویه",
  SETTLED: "تسویه‌شده",
  COMPLETED: "تکمیل‌شده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
  DEFERRED: "موکول‌شده",
  CONFIGURED: "پیکربندی‌شده",
  INTERNAL_REVIEW: "در حال بررسی داخلی",
  NEEDS_CHANGES: "نیاز به اصلاح",
  PENDING_SIGNATURE: "در انتظار امضا",
  SIGNED: "امضاشده",
  AMENDMENT_PENDING: "در انتظار اصلاحیه",
  TERMINATION_PENDING: "در انتظار فسخ",
  TERMINATED: "فسخ‌شده",
  EXPIRED: "منقضی‌شده",
  CALCULATED: "محاسبه‌شده",
  UNDER_REVIEW: "در حال بررسی",
  CONFIRMED: "تأییدشده",
  DISPUTED: "مورد اعتراض",
  ADJUSTED: "اصلاح‌شده",
  INVOICED: "صورتحساب صادرشده",
  ISSUED: "صادرشده",
  SENT: "ارسال‌شده",
  PAID: "پرداخت‌شده",
  PARTIALLY_PAID: "پرداخت جزئی",
  OVERDUE: "سررسیدگذشته",
  PENDING: "در انتظار",
  REVIEW: "در حال بررسی",
  DEPRECATED: "منسوخ‌شده",
  RAW: "خام",
  VALIDATED: "اعتبارسنجی‌شده",
  ACCEPTED: "پذیرفته‌شده",
  SUPERSEDED: "جایگزین‌شده",
  PENDING_APPROVAL: "در انتظار تأیید",
  FINANCIAL_REVIEW: "در حال بررسی مالی",
  LEGAL_REVIEW: "در حال بررسی حقوقی",
  POSTED: "ثبت نهایی‌شده",
  PLANNING: "در حال برنامه‌ریزی",
  UNDER_CONSTRUCTION: "در حال ساخت",
  INACTIVE: "غیرفعال",
  DECOMMISSIONED: "خارج از بهره‌برداری",
  TEMPORARILY_STOPPED: "توقف موقت",
  SUSPENDED: "تعلیق‌شده",
} as const;

export function getStatusLabel(status: string): string {
  return statusLabels[status] ?? "وضعیت نامشخص";
}

export type StatusTone = "positive" | "negative" | "pending";

const positiveStatuses = new Set([
  "ACTIVE", "APPROVED", "ACCEPTED", "VALIDATED", "CONFIRMED",
  "SIGNED", "CONTRACT_SIGNED", "PROPOSAL_ACCEPTED", "SETTLED",
  "COMPLETED", "PAID", "POSTED", "CURRENT",
]);

const negativeStatuses = new Set([
  "REJECTED", "PROPOSAL_REJECTED", "CANCELLED", "TERMINATED",
  "EXPIRED", "DEPRECATED", "SUPERSEDED", "DISPUTED", "OVERDUE",
  "INACTIVE", "DECOMMISSIONED", "SUSPENDED", "TEMPORARILY_STOPPED", "REVOKED",
]);

export function getStatusTone(status: string): StatusTone {
  if (positiveStatuses.has(status)) return "positive";
  if (negativeStatuses.has(status)) return "negative";
  return "pending";
}
