"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator, CheckCircle2,
  FileText, Send, ArrowRight, Loader2
} from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";

interface Settlement {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  energyRegistered: number;
  energyAccepted: number;
  energyRejected: number | null;
  unitPrice: number;
  baseAmount: number;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  status: string;
  independentInvoiceRestriction: string | null;
  pricingPlanId: string;
  calculatedBy: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  contract: {
    contractNumber: string;
    parties: Array<{ party: { displayName: string } }>;
  };
  asset: {
    name: string;
    capacity: number | null;
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CALCULATED: { label: "محاسبه شده", variant: "outline" },
  DRAFT: { label: "پیش‌نویس", variant: "secondary" },
  UNDER_REVIEW: { label: "در حال بررسی", variant: "secondary" },
  CONFIRMED: { label: "تأیید شده", variant: "default" },
  DISPUTED: { label: "مورد اعتراض", variant: "destructive" },
  ADJUSTED: { label: "اصلاح شده", variant: "secondary" },
  INVOICED: { label: "صورتحساب صادر شده", variant: "default" },
  PAID: { label: "پرداخت شده", variant: "default" },
};

async function loadSettlement(id: string): Promise<Settlement> {
  const response = await fetch(`/api/settlements/${id}`);
  if (!response.ok) throw new Error("تسویه یافت نشد");
  return response.json() as Promise<Settlement>;
}

export default function SettlementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let active = true;
    void loadSettlement(id)
      .then((data) => { if (active) setSettlement(data); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "دریافت تسویه ناموفق بود"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  const handleStatusChange = async (status: "UNDER_REVIEW" | "CONFIRMED") => {
    if (!settlement) return;
    setIsUpdating(true);
    setActionError("");
    try {
      const res = await fetch(`/api/settlements/${settlement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(body, "خطا در بروزرسانی وضعیت تسویه"));
      setSettlement(await loadSettlement(id));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!settlement) return;
    setIsUpdating(true);
    setActionError("");
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementId: settlement.id }),
      });
      if (res.ok) {
        setSettlement(await loadSettlement(id));
      } else {
        const data = await res.json().catch(() => null);
        throw new Error(getApiErrorMessage(data, "خطا در صدور صورتحساب"));
      }
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !settlement) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "تسویه یافت نشد"}
      </div>
    );
  }

  const status = statusConfig[settlement.status] || { label: getStatusLabel(settlement.status), variant: "secondary" as const };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{settlement.settlementNumber}</h1>
              <Badge status={settlement.status} variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              جزئیات تسویه دوره‌ای
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {settlement.status === "CALCULATED" && (
            <Button onClick={() => handleStatusChange("UNDER_REVIEW")} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
              ارسال برای بررسی
            </Button>
          )}
          {settlement.status === "UNDER_REVIEW" && (
            <Button onClick={() => handleStatusChange("CONFIRMED")} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
              تأیید نهایی
            </Button>
          )}
          {settlement.status === "CONFIRMED" && (
            <div className="space-y-2">
              <Button onClick={handleCreateInvoice} disabled={isUpdating || Boolean(settlement.independentInvoiceRestriction)}>
                {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                صدور صورتحساب
              </Button>
              {settlement.independentInvoiceRestriction && (
                <p className="max-w-xs text-sm leading-6 text-amber-800" role="status">
                  {settlement.independentInvoiceRestriction}{" "}
                  <Link href="/admin/netting" className="font-medium underline">رفتن به خالص‌سازی</Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">اطلاعات کلی</TabsTrigger>
              <TabsTrigger value="calculation">جزئیات محاسبه</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    اطلاعات تسویه
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">شماره تسویه</p>
                      <p className="font-medium font-mono">{settlement.settlementNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">طرف قرارداد</p>
                      <p className="font-medium">{settlement.contract.parties[0]?.party?.displayName || "نامشخص"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">شماره قرارداد</p>
                      <p className="font-medium font-mono">{settlement.contract.contractNumber}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">نیروگاه</p>
                      <p className="font-medium">{settlement.asset.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">دوره</p>
                      <p className="font-medium">
                        {formatPersianDate(settlement.periodStart)} تا{" "}
                        {formatPersianDate(settlement.periodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">مدل قیمت</p>
                      <Badge variant="secondary">
                        {settlement.contract.parties[0]?.party?.displayName || "نامشخص"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    خلاصه محاسبات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">انرژی ثبت شده</p>
                        <p className="text-xl font-bold">{settlement.energyRegistered.toLocaleString()} kWh</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">انرژی پذیرفته شده</p>
                        <p className="font-medium">{settlement.energyAccepted.toLocaleString()} kWh</p>
                      </div>
                      {settlement.energyRejected && settlement.energyRejected > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground">انرژی رد شده</p>
                          <p className="font-medium text-destructive">{settlement.energyRejected.toLocaleString()} kWh</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">قیمت واحد</p>
                        <p className="font-medium">{settlement.unitPrice.toLocaleString()} ریال</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">نرخ‌نامه</p>
                        <p className="font-medium">{settlement.pricingPlanId || "نامشخص"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between">
                      <span>مبلغ پایه:</span>
                      <span className="font-medium">{settlement.baseAmount.toLocaleString()} ریال</span>
                    </div>
                    <div className="flex justify-between">
                      <span>مالیات (9%):</span>
                      <span className="font-medium">{settlement.taxAmount.toLocaleString()} ریال</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>مبلغ نهایی:</span>
                      <span className="text-primary">{settlement.netAmount.toLocaleString()} ریال</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calculation Tab */}
            <TabsContent value="calculation" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>فرمول محاسبه</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">سیستم محاسبه:</p>
                    <p className="font-mono text-sm">
                      انرژی × قیمت واحد = مبلغ پایه
                    </p>
                    <p className="font-mono text-sm mt-2">
                      {settlement.energyAccepted.toLocaleString()} × {settlement.unitPrice.toLocaleString()} = {settlement.baseAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">محاسبه مالیات:</p>
                    <p className="font-mono text-sm">
                      مبلغ پایه × 9% = مالیات
                    </p>
                    <p className="font-mono text-sm mt-2">
                      {settlement.baseAmount.toLocaleString()} × 0.09 = {settlement.taxAmount.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">مبلغ نهایی:</p>
                    <p className="font-mono text-sm">
                      مبلغ پایه + مالیات = مبلغ نهایی
                    </p>
                    <p className="font-mono text-sm mt-2">
                      {settlement.baseAmount.toLocaleString()} + {settlement.taxAmount.toLocaleString()} = {settlement.netAmount.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>وضعیت</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">وضعیت</p>
                <Badge status={settlement.status} variant={status.variant}>{status.label}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">تاریخ محاسبه</p>
                <p className="font-medium">{formatPersianDate(settlement.createdAt)}</p>
              </div>
              {settlement.confirmedAt && (
                <div>
                  <p className="text-sm text-muted-foreground">تاریخ تأیید</p>
                  <p className="font-medium">{formatPersianDate(settlement.confirmedAt)}</p>
                </div>
              )}
              {settlement.confirmedBy && (
                <div>
                  <p className="text-sm text-muted-foreground">تأیید کننده</p>
                  <p className="font-medium">{settlement.confirmedBy}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>عملیات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 ml-2" />
                گزارش تسویه
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/admin/settlements")}>
                <ArrowRight className="h-4 w-4 ml-2" />
                بازگشت به لیست
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
