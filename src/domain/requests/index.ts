// VPP — Request Domain Types

export type PlantType =
  | "SOLAR"
  | "WIND"
  | "GAS_TURBINE"
  | "STEAM_TURBINE"
  | "CHP"
  | "HYDRO"
  | "BIOGAS"
  | "OTHER";

export type OperationalStatus =
  | "ACTIVE"
  | "UNDER_CONSTRUCTION"
  | "PLANNING"
  | "TEMPORARILY_STOPPED";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type RequestStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "INITIAL_REVIEW"
  | "NEEDS_INFORMATION"
  | "INFORMATION_SUBMITTED"
  | "APPROVED"
  | "OWNERSHIP_REVIEW"
  | "PROPOSAL_PENDING"
  | "PROPOSAL_READY"
  | "PROPOSAL_ACCEPTED"
  | "PROPOSAL_REJECTED"
  | "CONTRACT_PENDING"
  | "CONTRACT_SIGNED"
  | "ACTIVE"
  | "SETTLEMENT_PENDING"
  | "SETTLED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "DEFERRED";

export type ReviewAction =
  | "APPROVE"
  | "REJECT"
  | "NEED_INFO"
  | "DEFER"
  | "ASSIGN"
  | "ESCALATE";

export interface Request {
  id: string;
  caseNumber: string;
  partyId: string;
  assetId?: string | null;
  status: RequestStatus;
  plantType: PlantType;
  capacity: number;
  province: string;
  city: string;
  operationalStatus: OperationalStatus;
  avgMonthlyGeneration?: number | null;
  hasExistingContract: boolean;
  existingContractEnd?: Date | null;
  contactMobile: string;
  notes?: string | null;
  assignedTo?: string | null;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestReview {
  id: string;
  requestId: string;
  reviewerId: string;
  action: ReviewAction;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  reason?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface RequestDocument {
  id: string;
  requestId: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  verified: boolean;
  verifiedBy?: string | null;
  createdAt: Date;
}

// Request status customer-facing mapping
export const REQUEST_STATUS_CUSTOMER_MAP: Record<
  RequestStatus,
  { display: string; cta?: string }
> = {
  DRAFT: { display: "پیش‌نویس", cta: "تکمیل و ارسال" },
  SUBMITTED: { display: "ارسال شد", cta: "انتظار بررسی" },
  INITIAL_REVIEW: { display: "در حال بررسی", cta: "انتظار" },
  NEEDS_INFORMATION: { display: "نیاز به اطلاعات", cta: "تکمیل اطلاعات" },
  INFORMATION_SUBMITTED: { display: "اطلاعات ارسال شد", cta: "انتظار" },
  APPROVED: { display: "تأیید شده", cta: "انتظار بررسی مالکیت" },
  DEFERRED: { display: "پیگیری در آینده", cta: "انتظار" },
  REJECTED: { display: "رد شده" },
  OWNERSHIP_REVIEW: { display: "بررسی مالکیت", cta: "تکمیل مدارک" },
  PROPOSAL_PENDING: { display: "در حال تهیه پیشنهاد", cta: "انتظار" },
  PROPOSAL_READY: { display: "پیشنهاد آماده", cta: "مشاهده پیشنهاد" },
  PROPOSAL_ACCEPTED: { display: "پذیرفته شده", cta: "انتظار قرارداد" },
  PROPOSAL_REJECTED: { display: "نیازمند بازنگری پیشنهاد", cta: "تهیه پیشنهاد جدید" },
  CONTRACT_PENDING: { display: "قرارداد در حال تنظیم", cta: "انتظار" },
  CONTRACT_SIGNED: { display: "امضا شده", cta: "مشاهده قرارداد" },
  ACTIVE: { display: "فعال", cta: "مشاهده جزئیات" },
  SETTLEMENT_PENDING: { display: "تسویه در حال محاسبه", cta: "مشاهده" },
  SETTLED: { display: "تسویه شده", cta: "مشاهده جزئیات" },
  COMPLETED: { display: "تکمیل شده" },
  CANCELLED: { display: "لغو شده" },
};
