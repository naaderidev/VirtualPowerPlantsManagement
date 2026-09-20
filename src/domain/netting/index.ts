export type NettingMode = "OFF" | "AUTO" | "MANUAL";

export type NettingType = "FINANCIAL" | "ENERGY";

export type NettingBatchStatus =
  | "DRAFT"
  | "FINANCIAL_REVIEW"
  | "LEGAL_REVIEW"
  | "APPROVED"
  | "POSTED"
  | "REJECTED"
  | "CANCELLED";

export type NettingDirection = "RECEIVABLE" | "PAYABLE";

export type NettingApprovalType = "FINANCIAL" | "LEGAL";

export type NettingApprovalDecision = "APPROVED" | "REJECTED";

export type NettingGroup = {
  id: string;
  partyId: string;
  name: string;
  code: string;
  mode: NettingMode;
  type: NettingType;
  currency: string;
  active: boolean;
  validFrom: Date;
  validTo?: Date | null;
};

export type NettingBatch = {
  id: string;
  batchNumber: string;
  groupId: string;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  status: NettingBatchStatus;
  totalReceivable: string;
  totalPayable: string;
  netAmount: string;
  calculationSnapshot?: Record<string, unknown> | null;
  idempotencyKey: string;
  createdById: string;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  postedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NettingItem = {
  id: string;
  batchId: string;
  settlementId: string;
  direction: NettingDirection;
  amount: string;
  currency: string;
  settlementSnapshot: Record<string, unknown>;
  eligibilityLockKey?: string | null;
  releasedAt?: Date | null;
  createdAt: Date;
};

export type NettingApproval = {
  id: string;
  batchId: string;
  type: NettingApprovalType;
  decision: NettingApprovalDecision;
  reviewerId: string;
  notes?: string | null;
  decidedAt: Date;
};
