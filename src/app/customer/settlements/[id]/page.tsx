"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Calculator, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  taxAmount: number;
  netAmount: number;
  status: string;
  pricingPlanId: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdAt: string;
  contract: {
    contractNumber: string;
    parties: Array<{ party: { displayName: string } }>;
  };
  asset: {
    name: string;
    capacityNominal: number | null;
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

export default function CustomerSettlementDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const router = useRouter();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let active = true;
    void fetch(`/api/settlements/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("تسویه یافت نشد");
        return response.json() as Promise<Settlement>;
      })
      .then((data) => {
        if (active) setSettlement(data);
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

  if (error || !settlement) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || "تسویه یافت نشد"}</div>;
  }

  const status = statusConfig[settlement.status] ?? { label: getStatusLabel(settlement.status), variant: "secondary" as const };
  const contractParty = settlement.contract.parties[0]?.party.displayName ?? "نامشخص";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="بازگشت"><ArrowRight className="h-5 w-5" /></Button>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{settlement.settlementNumber}</h1>
            <Badge status={settlement.status} variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-muted-foreground">جزئیات تسویه دوره‌ای</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="overview">اطلاعات کلی</TabsTrigger>
              <TabsTrigger value="calculation">جزئیات محاسبه</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-4 w-4" />اطلاعات تسویه</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div><p className="text-sm text-muted-foreground">شماره تسویه</p><p className="font-mono font-medium">{settlement.settlementNumber}</p></div>
                    <div><p className="text-sm text-muted-foreground">طرف قرارداد</p><p className="font-medium">{contractParty}</p></div>
                    <div><p className="text-sm text-muted-foreground">شماره قرارداد</p><p className="font-mono font-medium">{settlement.contract.contractNumber}</p></div>
                  </div>
                  <div className="space-y-3">
                    <div><p className="text-sm text-muted-foreground">نیروگاه</p><p className="font-medium">{settlement.asset.name}</p></div>
                    {settlement.asset.capacityNominal != null && <div><p className="text-sm text-muted-foreground">ظرفیت نامی</p><p className="font-medium">{settlement.asset.capacityNominal.toLocaleString()} کیلووات</p></div>}
                    <div><p className="text-sm text-muted-foreground">دوره</p><p className="font-medium">{formatPersianDate(settlement.periodStart)} تا {formatPersianDate(settlement.periodEnd)}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />خلاصه محاسبات</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div><p className="text-sm text-muted-foreground">انرژی ثبت شده</p><p className="text-xl font-bold">{settlement.energyRegistered.toLocaleString()} کیلووات‌ساعت</p></div>
                      <div><p className="text-sm text-muted-foreground">انرژی پذیرفته شده</p><p className="font-medium">{settlement.energyAccepted.toLocaleString()} کیلووات‌ساعت</p></div>
                      {!!settlement.energyRejected && settlement.energyRejected > 0 && <div><p className="text-sm text-muted-foreground">انرژی رد شده</p><p className="font-medium text-destructive">{settlement.energyRejected.toLocaleString()} کیلووات‌ساعت</p></div>}
                    </div>
                    <div className="space-y-3">
                      <div><p className="text-sm text-muted-foreground">قیمت واحد</p><p className="font-medium">{settlement.unitPrice.toLocaleString()} ریال</p></div>
                      <div><p className="text-sm text-muted-foreground">شناسه نرخ‌نامه</p><p className="font-mono text-sm font-medium">{settlement.pricingPlanId || "ثبت نشده"}</p></div>
                    </div>
                  </div>
                  <div className="space-y-2 border-t pt-4">
                    <div className="flex justify-between gap-4"><span>مبلغ پایه:</span><span className="font-medium">{settlement.baseAmount.toLocaleString()} ریال</span></div>
                    <div className="flex justify-between gap-4"><span>مالیات (۹٪):</span><span className="font-medium">{settlement.taxAmount.toLocaleString()} ریال</span></div>
                    <div className="flex justify-between gap-4 border-t pt-2 text-lg font-bold"><span>مبلغ نهایی:</span><span className="text-primary">{settlement.netAmount.toLocaleString()} ریال</span></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="calculation">
              <Card>
                <CardHeader><CardTitle>فرمول محاسبه</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-4"><p className="mb-2 text-sm text-muted-foreground">مبلغ پایه</p><p className="font-mono text-sm">انرژی پذیرفته شده × قیمت واحد</p><p className="mt-2 font-mono text-sm">{settlement.energyAccepted.toLocaleString()} × {settlement.unitPrice.toLocaleString()} = {settlement.baseAmount.toLocaleString()}</p></div>
                  <div className="rounded-lg bg-muted p-4"><p className="mb-2 text-sm text-muted-foreground">مالیات</p><p className="font-mono text-sm">مبلغ پایه × ۹٪</p><p className="mt-2 font-mono text-sm">{settlement.baseAmount.toLocaleString()} × ۰٫۰۹ = {settlement.taxAmount.toLocaleString()}</p></div>
                  <div className="rounded-lg bg-primary/10 p-4"><p className="mb-2 text-sm text-muted-foreground">مبلغ نهایی</p><p className="font-mono text-sm">مبلغ پایه + مالیات</p><p className="mt-2 font-mono text-sm">{settlement.baseAmount.toLocaleString()} + {settlement.taxAmount.toLocaleString()} = {settlement.netAmount.toLocaleString()}</p></div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>وضعیت</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><p className="text-sm text-muted-foreground">وضعیت فعلی</p><Badge status={settlement.status} variant={status.variant}>{status.label}</Badge></div>
              <div><p className="text-sm text-muted-foreground">تاریخ محاسبه</p><p className="font-medium">{formatPersianDate(settlement.createdAt)}</p></div>
              {settlement.confirmedAt && <div><p className="text-sm text-muted-foreground">تاریخ تأیید</p><p className="font-medium">{formatPersianDate(settlement.confirmedAt)}</p></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>عملیات</CardTitle></CardHeader>
            <CardContent><Button variant="outline" className="w-full justify-start" onClick={() => router.push("/customer/settlements")}><ArrowRight className="ml-2 h-4 w-4" />بازگشت به لیست</Button></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
