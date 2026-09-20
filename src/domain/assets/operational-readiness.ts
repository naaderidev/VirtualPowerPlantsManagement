import type { RequestStatus } from "@prisma/client";

const OPERATIONAL_READINESS_SUBMISSION_STATUSES = new Set<RequestStatus>([
  "INFORMATION_SUBMITTED",
  "OWNERSHIP_REVIEW",
  "PROPOSAL_PENDING",
  "PROPOSAL_READY",
  "PROPOSAL_ACCEPTED",
  "PROPOSAL_REJECTED",
  "CONTRACT_PENDING",
  "CONTRACT_SIGNED",
]);

export function canSubmitOperationalReadiness(status: RequestStatus): boolean {
  return OPERATIONAL_READINESS_SUBMISSION_STATUSES.has(status);
}

export type OperationalReadinessInput = {
  status: string;
  operationalDate: Date | null;
  connectionStatus: string | null;
  hasActiveMainMeter: boolean;
  verifiedDocumentTypes: readonly string[];
  now?: Date;
};

export type OperationalReadiness = {
  ready: boolean;
  blockers: string[];
};

export function evaluateOperationalReadiness(input: OperationalReadinessInput): OperationalReadiness {
  const blockers: string[] = [];
  const now = input.now ?? new Date();

  if (input.status !== "ACTIVE") blockers.push("وضعیت نیروگاه هنوز فعال نیست.");
  if (!input.operationalDate) blockers.push("تاریخ بهره‌برداری واقعی ثبت نشده است.");
  else if (input.operationalDate > now) blockers.push("تاریخ بهره‌برداری هنوز فرا نرسیده است.");
  if (input.connectionStatus !== "CONNECTED") blockers.push("اتصال نیروگاه به شبکه تأیید نشده است.");
  if (!input.hasActiveMainMeter) blockers.push("کنتور اصلی فعال ثبت نشده است.");

  const verifiedTypes = new Set(input.verifiedDocumentTypes);
  if (!verifiedTypes.has("CONNECTION")) blockers.push("مدرک اتصال نیروگاه تأیید نشده است.");
  if (!verifiedTypes.has("METER")) blockers.push("مدرک کنتور نیروگاه تأیید نشده است.");

  return { ready: blockers.length === 0, blockers };
}
