"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, FileText, Receipt, CreditCard } from "lucide-react";
import { RoleGate } from "@/components/shared/role-gate";
import { PAYMENT_WRITE_ROLES } from "@/lib/access-control";

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
    energyRegistered: number;
    energyAccepted: number;
    unitPrice: number;
    baseAmount: number;
    taxAmount: number;
    netAmount: number;
    contract: {
      contractNumber: string;
      parties: Array<{ party: { displayName: string } }>;
    };
    asset: {
      name: string;
      capacity: number | null;
    };
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

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
        return response.json();
      })
      .then((data) => { if (active) setInvoice(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "خطای ناشناخته"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "صورتحساب یافت نشد"}
      </div>
    );
  }

  const status = statusConfig[invoice.status] || { label: getStatusLabel(invoice.status), variant: "secondary" as const };
  const canPay = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <Badge status={invoice.status} variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">جزئیات صورتحساب</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canPay && <RoleGate allowedRoles={PAYMENT_WRITE_ROLES}>
            <Button onClick={() => router.push(`/admin/payments?invoiceId=${encodeURIComponent(invoice.id)}`)}>
              <CreditCard className="h-4 w-4 ml-2" />
              ثبت و تخصیص پرداخت
            </Button>
          </RoleGate>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              اطلاعات صورتحساب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">شماره صورتحساب</p>
              <p className="font-medium font-mono">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تاریخ صدور</p>
              <p className="font-medium">{formatPersianDate(invoice.issueDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تاریخ سررسید</p>
              <p className="font-medium">{formatPersianDate(invoice.dueDate)}</p>
            </div>
            {invoice.notes && (
              <div>
                <p className="text-sm text-muted-foreground">توضیحات</p>
                <p className="font-medium">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              اطلاعات تسویه
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">شماره تسویه</p>
              <p className="font-medium font-mono">{invoice.settlement?.settlementNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">نیروگاه</p>
              <p className="font-medium">{invoice.settlement?.asset?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">دوره</p>
              <p className="font-medium">
                {formatPersianDate(invoice.settlement?.periodStart)} تا{" "}
                {formatPersianDate(invoice.settlement?.periodEnd)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              جزئیات مالی
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">انرژی پذیرفته شده:</span>
              <span className="font-medium">{invoice.settlement?.energyAccepted?.toLocaleString()} kWh</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">قیمت واحد:</span>
              <span className="font-medium">{invoice.settlement?.unitPrice?.toLocaleString()} ریال</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">مبلغ پایه:</span>
              <span className="font-medium">{invoice.settlement?.baseAmount?.toLocaleString()} ریال</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">مالیات (9%):</span>
              <span className="font-medium">{invoice.settlement?.taxAmount?.toLocaleString()} ریال</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-3">
              <span>مبلغ نهایی:</span>
              <span className="text-primary">{invoice.amount?.toLocaleString()} ریال</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
