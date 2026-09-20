// VPP — Settlement Domain Types

export type SettlementStatus =
  | "CALCULATED"
  | "DRAFT"
  | "UNDER_REVIEW"
  | "CONFIRMED"
  | "DISPUTED"
  | "ADJUSTED"
  | "INVOICED"
  | "PAID";

export type AdjustmentType =
  | "CORRECTION"
  | "PENALTY"
  | "BONUS"
  | "FEE"
  | "TAX_ADJUSTMENT"
  | "CREDIT";

export interface Settlement {
  id: string;
  settlementNumber: string;
  version: number;
  contractId: string;
  assetId: string;
  meterReadingId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  energyRegistered: number;
  energyAccepted: number;
  energyRejected?: number | null;
  energyRejectionReason?: string | null;
  pricingPlanId: string;
  pricingVersion: string;
  unitPrice: number;
  baseAmount: number;
  adjustments?: Adjustment[] | null;
  adjustmentTotal: number;
  grossAmount: number;
  deductions: number;
  taxAmount: number;
  netAmount: number;
  status: SettlementStatus;
  calculatedBy?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | null;
  disputeDeadline?: Date | null;
  disputeReason?: string | null;
  disputeResolvedBy?: string | null;
  disputeResolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Adjustment {
  type: AdjustmentType;
  amount: number;
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
}

// Settlement status display mapping
export const SETTLEMENT_STATUS_MAP: Record<
  SettlementStatus,
  { display: string; cta?: string }
> = {
  CALCULATED: { display: "در حال آماده‌سازی", cta: "مشاهده پیش‌نویس" },
  DRAFT: { display: "پیش‌نویس", cta: "بررسی" },
  UNDER_REVIEW: { display: "در حال بررسی", cta: "بررسی جزئیات" },
  CONFIRMED: { display: "تأیید شده", cta: "انتظار صورتحساب" },
  INVOICED: { display: "صورتحساب صادر شده", cta: "مشاهده صورتحساب" },
  PAID: { display: "پرداخت شده", cta: "مشاهده رسید" },
  DISPUTED: { display: "مورد اعتراض", cta: "پیگیری" },
  ADJUSTED: { display: "اصلاح شده", cta: "مشاهده نسخه جدید" },
};

// Adjustment type display mapping
export const ADJUSTMENT_TYPE_MAP: Record<
  AdjustmentType,
  { display: string; color: string }
> = {
  CORRECTION: { display: "اصلاح", color: "bg-blue-100" },
  PENALTY: { display: "جریمه", color: "bg-red-100" },
  BONUS: { display: "پاداش", color: "bg-green-100" },
  FEE: { display: "کارمزد", color: "bg-yellow-100" },
  TAX_ADJUSTMENT: { display: "اصلاح مالیات", color: "bg-purple-100" },
  CREDIT: { display: "اعتبار", color: "bg-teal-100" },
};
