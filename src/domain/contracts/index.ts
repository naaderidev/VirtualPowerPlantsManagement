// VPP — Contract Domain Types

export type ContractType = "PPA";

export type ContractStatus =
  | "DRAFT"
  | "CONFIGURED"
  | "INTERNAL_REVIEW"
  | "NEEDS_CHANGES"
  | "PENDING_SIGNATURE"
  | "SIGNED"
  | "ACTIVE"
  | "AMENDMENT_PENDING"
  | "TERMINATION_PENDING"
  | "TERMINATED"
  | "EXPIRED"
  | "REJECTED"
  | "CANCELLED";

export type ContractRole = "BUYER" | "SELLER" | "SIGNATORY" | "GUARANTOR";

export type VolumeType = "AS_PRODUCED" | "FIXED" | "MIN_MAX";

export type SettlementCycle = "MONTHLY" | "QUARTERLY";

export type AmendmentStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "ACTIVE"
  | "REJECTED";

export interface Contract {
  id: string;
  contractNumber: string;
  type: ContractType;
  status: ContractStatus;
  version: number;
  effectiveDate: Date;
  expirationDate?: Date | null;
  terminationDate?: Date | null;
  volumeType?: VolumeType | null;
  settlementCycle?: SettlementCycle | null;
  paymentDueDays?: number | null;
  nettingEnabled: boolean;
  nettingGroupId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractParty {
  id: string;
  contractId: string;
  partyId: string;
  role: ContractRole;
  isPrimary: boolean;
  createdAt: Date;
}

export interface ContractAsset {
  id: string;
  contractId: string;
  assetId: string;
  sharePercent?: number | null;
  volumeMWh?: number | null;
  createdAt: Date;
}

export interface CommercialSchedule {
  id: string;
  contractId: string;
  assetId: string;
  name?: string | null;
  startDate: Date;
  endDate: Date;
  volumeType: VolumeType;
  minVolume?: number | null;
  maxVolume?: number | null;
  pricingPlanId: string;
  active: boolean;
  createdAt: Date;
}

export interface Amendment {
  id: string;
  contractId: string;
  number: number;
  title: string;
  description?: string | null;
  changes: Record<string, unknown>;
  effectiveDate: Date;
  approvedBy?: string | null;
  status: AmendmentStatus;
  createdAt: Date;
}

export * from "./scenario-14-2";

// Contract status customer-facing mapping
export const CONTRACT_STATUS_CUSTOMER_MAP: Record<
  ContractStatus,
  { display: string; cta?: string }
> = {
  DRAFT: { display: "در حال تنظیم" },
  CONFIGURED: { display: "در حال بررسی", cta: "انتظار" },
  INTERNAL_REVIEW: { display: "در حال بررسی داخلی", cta: "انتظار" },
  NEEDS_CHANGES: { display: "نیاز به اصلاح" },
  PENDING_SIGNATURE: { display: "منتظر امضا", cta: "امضای قرارداد" },
  SIGNED: { display: "امضا شده", cta: "انتظار فعال‌سازی" },
  ACTIVE: { display: "فعال", cta: "مشاهده جزئیات" },
  AMENDMENT_PENDING: { display: "الحاقیه در حال بررسی", cta: "مشاهده" },
  TERMINATION_PENDING: { display: "در حال فسخ" },
  TERMINATED: { display: "فسخ شده" },
  EXPIRED: { display: "منقضی شده" },
  REJECTED: { display: "رد شده" },
  CANCELLED: { display: "لغو شده" },
};
