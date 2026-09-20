import { Badge } from "@/components/ui/badge";
import { getStatusLabel } from "@/lib/status-labels";
import type { RequestStatus, ContractStatus, SettlementStatus, InvoiceStatus } from "@/domain";

type StatusType = "request" | "contract" | "settlement" | "invoice";

interface StatusBadgeProps {
  status: RequestStatus | ContractStatus | SettlementStatus | InvoiceStatus;
  type?: StatusType;
  className?: string;
}

const requestStatusConfig: Record<
  RequestStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  SUBMITTED: { label: "ارسال شد", variant: "secondary" },
  INITIAL_REVIEW: { label: "در حال بررسی", variant: "secondary" },
  NEEDS_INFORMATION: { label: "نیاز به اطلاعات", variant: "destructive" },
  INFORMATION_SUBMITTED: { label: "اطلاعات ارسال شد", variant: "secondary" },
  APPROVED: { label: "تأیید شده", variant: "default" },
  OWNERSHIP_REVIEW: { label: "بررسی مالکیت", variant: "secondary" },
  PROPOSAL_PENDING: { label: "در حال تهیه پیشنهاد", variant: "secondary" },
  PROPOSAL_READY: { label: "پیشنهاد آماده", variant: "default" },
  PROPOSAL_ACCEPTED: { label: "پذیرفته شده", variant: "default" },
  PROPOSAL_REJECTED: { label: "نیازمند بازنگری پیشنهاد", variant: "secondary" },
  CONTRACT_PENDING: { label: "قرارداد در حال تنظیم", variant: "secondary" },
  CONTRACT_SIGNED: { label: "امضا شده", variant: "default" },
  ACTIVE: { label: "فعال", variant: "default" },
  SETTLEMENT_PENDING: { label: "تسویه در حال محاسبه", variant: "secondary" },
  SETTLED: { label: "تسویه شده", variant: "default" },
  COMPLETED: { label: "تکمیل شده", variant: "default" },
  REJECTED: { label: "رد شده", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
  DEFERRED: { label: "پیگیری در آینده", variant: "outline" },
};

const contractStatusConfig: Record<
  ContractStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  CONFIGURED: { label: "پیکربندی شده", variant: "secondary" },
  INTERNAL_REVIEW: { label: "در حال بررسی", variant: "secondary" },
  NEEDS_CHANGES: { label: "نیاز به اصلاح", variant: "destructive" },
  PENDING_SIGNATURE: { label: "منتظر امضا", variant: "secondary" },
  SIGNED: { label: "امضا شده", variant: "default" },
  ACTIVE: { label: "فعال", variant: "default" },
  AMENDMENT_PENDING: { label: "الحاقیه در حال بررسی", variant: "secondary" },
  TERMINATION_PENDING: { label: "در حال فسخ", variant: "destructive" },
  TERMINATED: { label: "فسخ شده", variant: "destructive" },
  EXPIRED: { label: "منقضی شده", variant: "outline" },
  REJECTED: { label: "رد شده", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
};

const settlementStatusConfig: Record<
  SettlementStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  CALCULATED: { label: "محاسبه شده", variant: "secondary" },
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  UNDER_REVIEW: { label: "در حال بررسی", variant: "secondary" },
  CONFIRMED: { label: "تأیید شده", variant: "default" },
  DISPUTED: { label: "مورد اعتراض", variant: "destructive" },
  ADJUSTED: { label: "اصلاح شده", variant: "secondary" },
  INVOICED: { label: "صورتحساب صادر شده", variant: "default" },
  PAID: { label: "پرداخت شده", variant: "default" },
};

const invoiceStatusConfig: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  ISSUED: { label: "صادر شده", variant: "secondary" },
  SENT: { label: "ارسال شده", variant: "secondary" },
  PAID: { label: "پرداخت شده", variant: "default" },
  PARTIALLY_PAID: { label: "پرداخت جزئی", variant: "secondary" },
  OVERDUE: { label: "سررسید گذشته", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
};

export function StatusBadge({ status, type = "request", className }: StatusBadgeProps) {
  let config;
  
  switch (type) {
    case "contract":
      config = contractStatusConfig[status as ContractStatus];
      break;
    case "settlement":
      config = settlementStatusConfig[status as SettlementStatus];
      break;
    case "invoice":
      config = invoiceStatusConfig[status as InvoiceStatus];
      break;
    default:
      config = requestStatusConfig[status as RequestStatus];
  }

  if (!config) return <Badge status={status} className={className}>{getStatusLabel(status)}</Badge>;

  return (
    <Badge status={status} variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function ContractStatusBadge({ status, className }: { status: ContractStatus; className?: string }) {
  const config = contractStatusConfig[status];
  if (!config) return <Badge status={status} className={className}>{getStatusLabel(status)}</Badge>;

  return (
    <Badge status={status} variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
