import type { InvoiceStatus } from "@prisma/client";

const MANUAL_TRANSITIONS: Partial<Record<InvoiceStatus, readonly InvoiceStatus[]>> = {
  ISSUED: ["SENT", "OVERDUE", "CANCELLED"],
  SENT: ["OVERDUE", "CANCELLED"],
  OVERDUE: ["CANCELLED"],
};

export function canManuallyTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return MANUAL_TRANSITIONS[from]?.includes(to) ?? false;
}
