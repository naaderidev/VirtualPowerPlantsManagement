// VPP — Metering Domain Types

export type ReadingStatus =
  | "RAW"
  | "VALIDATED"
  | "ACCEPTED"
  | "REJECTED"
  | "ADJUSTED";

export interface MeterReading {
  id: string;
  assetId: string;
  meterId?: string | null;
  periodStart: Date;
  periodEnd: Date;
  rawEnergy: number;
  rawPeak?: number | null;
  rawOffPeak?: number | null;
  acceptedEnergy?: number | null;
  rejectedEnergy?: number | null;
  rejectionReason?: string | null;
  source: string;
  qualityFlag?: string | null;
  status: ReadingStatus;
  submittedBy?: string | null;
  validatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Reading status display mapping
export const READING_STATUS_MAP: Record<
  ReadingStatus,
  { display: string; color: string }
> = {
  RAW: { display: "خام", color: "bg-gray-100" },
  VALIDATED: { display: "بررسی شده", color: "bg-blue-100" },
  ACCEPTED: { display: "تأیید شده", color: "bg-green-100" },
  REJECTED: { display: "رد شده", color: "bg-red-100" },
  ADJUSTED: { display: "اصلاح شده", color: "bg-yellow-100" },
};
