// VPP — Billing Domain Types

export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "SENT"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  settlementId: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  method?: string | null;
  bankName?: string | null;
  reference?: string | null;
  notes?: string | null;
  allocated: boolean;
  allocatedAt?: Date | null;
  createdAt: Date;
}

// Invoice status display mapping
export const INVOICE_STATUS_MAP: Record<
  InvoiceStatus,
  { display: string; color: string }
> = {
  DRAFT: { display: "پیش‌نویس", color: "bg-gray-100" },
  ISSUED: { display: "صادر شده", color: "bg-blue-100" },
  SENT: { display: "ارسال شده", color: "bg-yellow-100" },
  PAID: { display: "پرداخت شده", color: "bg-green-100" },
  PARTIALLY_PAID: { display: "پرداخت جزئی", color: "bg-orange-100" },
  OVERDUE: { display: "سررسید گذشته", color: "bg-red-100" },
  CANCELLED: { display: "لغو شده", color: "bg-gray-100" },
};
