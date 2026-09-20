"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard, FileText, Loader2, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: string;
  notes: string | null;
  settlement: {
    settlementNumber: string;
    periodStart: string;
    periodEnd: string;
    energyAccepted: number;
    unitPrice: number;
    baseAmount: number;
    taxAmount: number;
    netAmount: number;
    contract: { contractNumber: string };
    asset: { name: string };
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  ISSUED: { label: "صادر شده", variant: "secondary" },
  SENT: { label: "ارسال شده", variant: "secondary" },
  PAID: { label: "پرداخت شده", variant: "default" },
  PARTIALLY_PAID: { label: "پرداخت جزئی", variant: "secondary" },
  OVERDUE: { label: "سررسید گذشته", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
};

export default function CustomerInvoiceDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/invoices/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("صورتحساب یافت نشد");
        return response.json() as Promise<Invoice>;
      })
      .then((data) => {
        if (active) setInvoice(data);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (error || !invoice) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || "صورتحساب یافت نشد"}</div>;
  }

  const status = statusConfig[invoice.status] ?? { label: getStatusLabel(invoice.status), variant: "secondary" as const };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="بازگشت"><ArrowRight className="h-5 w-5" /></Button>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <Badge status={invoice.status} variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">جزئیات سند مالی</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />اطلاعات صورتحساب</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-sm text-muted-foreground">شماره صورتحساب</p><p className="font-mono font-medium">{invoice.invoiceNumber}</p></div>
            <div><p className="text-sm text-muted-foreground">تاریخ صدور</p><p className="font-medium">{formatPersianDate(invoice.issueDate)}</p></div>
            <div><p className="text-sm text-muted-foreground">تاریخ سررسید</p><p className="font-medium">{formatPersianDate(invoice.dueDate)}</p></div>
            {invoice.notes && <div><p className="text-sm text-muted-foreground">توضیحات</p><p className="font-medium">{invoice.notes}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />اطلاعات تسویه</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><p className="text-sm text-muted-foreground">شماره تسویه</p><p className="font-mono font-medium">{invoice.settlement.settlementNumber}</p></div>
            <div><p className="text-sm text-muted-foreground">شماره قرارداد</p><p className="font-mono font-medium">{invoice.settlement.contract.contractNumber}</p></div>
            <div><p className="text-sm text-muted-foreground">نیروگاه</p><p className="font-medium">{invoice.settlement.asset.name}</p></div>
            <div><p className="text-sm text-muted-foreground">دوره</p><p className="font-medium">{formatPersianDate(invoice.settlement.periodStart)} تا {formatPersianDate(invoice.settlement.periodEnd)}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />جزئیات مالی</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">انرژی پذیرفته شده:</span><span className="font-medium">{invoice.settlement.energyAccepted.toLocaleString()} کیلووات‌ساعت</span></div>
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">قیمت واحد:</span><span className="font-medium">{invoice.settlement.unitPrice.toLocaleString()} ریال</span></div>
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">مبلغ پایه:</span><span className="font-medium">{invoice.settlement.baseAmount.toLocaleString()} ریال</span></div>
            <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">مالیات (۹٪):</span><span className="font-medium">{invoice.settlement.taxAmount.toLocaleString()} ریال</span></div>
            <div className="flex justify-between gap-4 border-t pt-3 text-lg font-bold"><span>مبلغ نهایی:</span><span className="text-primary">{invoice.amount.toLocaleString()} ریال</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
