"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-client";
import { CheckCircle2, Clock, Loader2, Receipt, Shield } from "lucide-react";

type Statement = {
  id: string;
  statementNumber: string;
  direction: "RECEIVABLE" | "PAYABLE";
  amount: string;
  paidAmount: string;
  currency: string;
  status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  issueDate: string;
  dueDate: string;
  party: { displayName: string };
  batch: {
    batchNumber: string;
    periodStart: string;
    periodEnd: string;
    totalReceivable: string;
    totalPayable: string;
    netAmount: string;
    group: { name: string; code: string };
    approvals: Array<{
      id: string;
      type: "FINANCIAL" | "LEGAL";
      decision: "APPROVED" | "REJECTED";
      reviewer: { name: string };
    }>;
    items: Array<{
      id: string;
      direction: "RECEIVABLE" | "PAYABLE";
      amount: string;
      settlement: {
        settlementNumber: string;
        netAmount: number;
        asset: { name: string };
        contract: { contractNumber: string };
        schedule: null | { pricingPlan: { name: string; model: string } };
      };
    }>;
  };
  allocations: Array<{
    id: string;
    amount: string;
    payment: { paymentNumber: string; paymentDate: string; status: string; reference: string | null };
  }>;
};

const statusLabels = {
  ISSUED: "صادرشده",
  PARTIALLY_PAID: "پرداخت جزئی",
  PAID: "پرداخت‌شده",
  CANCELLED: "لغوشده",
} as const;

const pricingLabels: Record<string, string> = {
  FIXED: "قیمت ثابت",
  MARKET_INDEX: "شاخص بازار",
  HYBRID: "ترکیبی",
  FLOOR: "کف قیمت",
};

function money(value: string | number) {
  return `${Number(value).toLocaleString("fa-IR")} ریال`;
}

export default function CustomerNettingPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/netting/statements?limit=100")
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(getApiErrorMessage(body, "دریافت نتایج خالص‌سازی ناموفق بود"));
        if (active) setStatements(body);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Shield className="h-6 w-6" />نتایج خالص‌سازی</h1><p className="text-muted-foreground">مشاهده نتیجه خالص، ریز تسویه نیروگاه‌ها و وضعیت پرداخت شرکت انتخاب‌شده</p></div>
      {error && <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {!error && statements.length === 0 && <Card><CardContent className="py-12 text-center"><Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">نتیجه خالص نهایی وجود ندارد</p><p className="mt-1 text-sm text-muted-foreground">پس از تأیید مالی و حقوقی و صدور سند، نتیجه شرکت در این بخش نمایش داده می‌شود.</p></CardContent></Card>}
      {statements.map((statement) => {
        const remaining = Number(statement.amount) - Number(statement.paidAmount);
        return <Card key={statement.id}>
          <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="font-mono">{statement.statementNumber}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{statement.party.displayName} · گروه {statement.batch.group.name}</p></div><Badge status={statement.status} variant={statement.status === "PAID" ? "default" : statement.status === "CANCELLED" ? "destructive" : "secondary"}>{statusLabels[statement.status]}</Badge></div></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">دوره مشترک</p><p className="font-medium">{formatPersianDate(statement.batch.periodStart)} تا {formatPersianDate(statement.batch.periodEnd)}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">نتیجه خالص</p><p className="font-bold">{money(statement.amount)}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">پرداخت‌شده</p><p className="font-bold">{money(statement.paidAmount)}</p></div><div className="rounded-lg bg-primary/10 p-3"><p className="text-xs text-muted-foreground">مانده</p><p className="font-bold text-primary">{money(remaining)}</p></div></div>
            <div><h2 className="mb-3 flex items-center gap-2 font-semibold"><Receipt className="h-4 w-4" />ریز تسویه‌های مبنا</h2><Table><TableHeader><TableRow><TableHead>تسویه</TableHead><TableHead>قرارداد مادر</TableHead><TableHead>نیروگاه</TableHead><TableHead>برنامه تجاری</TableHead><TableHead>مبلغ snapshot</TableHead></TableRow></TableHeader><TableBody>{statement.batch.items.map((item) => <TableRow key={item.id}><TableCell className="font-mono">{item.settlement.settlementNumber}</TableCell><TableCell className="font-mono">{item.settlement.contract.contractNumber}</TableCell><TableCell>{item.settlement.asset.name}</TableCell><TableCell>{item.settlement.schedule ? `${item.settlement.schedule.pricingPlan.name} (${pricingLabels[item.settlement.schedule.pricingPlan.model] ?? item.settlement.schedule.pricingPlan.model})` : "نامشخص"}</TableCell><TableCell>{money(item.amount)}</TableCell></TableRow>)}</TableBody></Table></div>
            <div className="grid gap-3 md:grid-cols-2">{(["FINANCIAL", "LEGAL"] as const).map((type) => { const approval = statement.batch.approvals.find((item) => item.type === type); return <div key={type} className="rounded-lg border p-3"><p className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{type === "FINANCIAL" ? "تأیید مالی" : "تأیید حقوقی"}</p><p className="mt-1 text-sm text-muted-foreground">{approval?.reviewer.name ?? "نامشخص"}</p></div>; })}</div>
            <div><h2 className="mb-3 flex items-center gap-2 font-semibold"><Clock className="h-4 w-4" />سوابق پرداخت سند</h2>{statement.allocations.length === 0 ? <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">هنوز پرداختی به این سند تخصیص داده نشده است. سررسید: {formatPersianDate(statement.dueDate)}</p> : <div className="space-y-2">{statement.allocations.map((allocation) => <div key={allocation.id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm"><span>{allocation.payment.paymentNumber} · {allocation.payment.reference ?? "بدون مرجع"}</span><strong>{money(allocation.amount)}</strong></div>)}</div>}</div>
          </CardContent>
        </Card>;
      })}
    </div>
  );
}
