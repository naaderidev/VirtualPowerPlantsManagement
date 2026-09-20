// VPP — Pricing Domain Types

export type PricingStatus =
  | "DRAFT"
  | "REVIEW"
  | "APPROVED"
  | "ACTIVE"
  | "DEPRECATED";

export type PricingModel = "FIXED" | "MARKET_INDEX" | "HYBRID" | "FLOOR";

export interface PricingPlan {
  id: string;
  name: string;
  code: string;
  version: number;
  status: PricingStatus;
  model: PricingModel;
  currency: string;
  energyUnit: string;
  roundingMethod: string;
  roundingDigits: number;

  // Fixed pricing
  fixedRate?: number | null;
  escalationMethod?: string | null;

  // Market Index pricing
  marketName?: string | null;
  indexName?: string | null;
  indexSource?: string | null;
  indexTimeframe?: string | null;
  averagingMethod?: string | null;
  multiplier: number;
  differential: number;
  missingIndexPolicy?: string | null;

  // Hybrid pricing
  fixedSharePct?: number | null;
  fixedRateHybrid?: number | null;
  marketSharePct?: number | null;

  // Floor pricing
  baseFormula?: string | null;
  basePricingId?: string | null;
  floorValue?: number | null;
  ceilingValue?: number | null;

  // Validity
  validFrom: Date;
  validTo?: Date | null;

  // Audit
  createdBy?: string | null;
  approvedBy?: string | null;
  versionNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Pricing calculation result
export interface PricingResult {
  unitPrice: number;
  baseAmount: number;
  formula: string;
  inputs: Record<string, unknown>;
}

// Pricing status customer-facing mapping
export const PRICING_STATUS_MAP: Record<
  PricingStatus,
  { display: string }
> = {
  DRAFT: { display: "پیش‌نویس" },
  REVIEW: { display: "در حال بررسی" },
  APPROVED: { display: "تأیید شده" },
  ACTIVE: { display: "فعال" },
  DEPRECATED: { display: "منقضی" },
};
