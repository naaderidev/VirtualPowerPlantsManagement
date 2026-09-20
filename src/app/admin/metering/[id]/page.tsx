"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Zap, Building2, CheckCircle2,
  FileText, Loader2, ArrowRightIcon
} from "lucide-react";
import { RoleGate } from "@/components/shared/role-gate";
import { TECHNICAL_ROLES } from "@/lib/access-control";
import { getApiErrorMessage } from "@/lib/api-client";

interface MeterReading {
  id: string;
  meterId: string | null;
  periodStart: string;
  periodEnd: string;
  rawEnergy: number;
  rawPeak: number | null;
  rawOffPeak: number | null;
  acceptedEnergy: number | null;
  rejectedEnergy: number | null;
  rejectionReason: string | null;
  source: string;
  qualityFlag: string | null;
  status: string;
  submittedBy: string | null;
  validatedBy: string | null;
  createdAt: string;
  asset: {
    id: string;
    name: string;
    type: string;
    capacityNominal: number;
    province: string;
    city: string;
  };
  meter: {
    id: string;
    serialNumber: string;
  } | null;
  settlements: Array<{
    id: string;
    settlementNumber: string;
    grossAmount: number;
    status: string;
  }>;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  RAW: { label: "خام", variant: "outline" },
  VALIDATED: { label: "اعتبارسنجی شده", variant: "secondary" },
  ACCEPTED: { label: "پذیرفته نهایی", variant: "default" },
  REJECTED: { label: "رد شده", variant: "destructive" },
  ADJUSTED: { label: "اصلاح‌شده", variant: "secondary" },
};

const assetTypeLabels: Record<string, string> = {
  SOLAR: "خورشیدی",
  WIND: "بادی",
  GAS_TURBINE: "گازی",
  STEAM_TURBINE: "بخاری",
  CHP: "تولید هم‌زمان",
  HYDRO: "آبی",
  BIOGAS: "بیوگاز",
  OTHER: "سایر",
};

async function getMeterReading(id: string): Promise<MeterReading> {
  const response = await fetch(`/api/meter-readings/${id}`);
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getApiErrorMessage(body, "خطا در دریافت قرائت"));
  return body as MeterReading;
}

export default function MeteringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reading, setReading] = useState<MeterReading | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchReading = useCallback(async () => {
    try {
      setReading(await getMeterReading(id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در دریافت قرائت");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadReading() {
      try {
        const data = await getMeterReading(id);
        if (active) setReading(data);
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "خطا در دریافت قرائت");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadReading();
    return () => { active = false; };
  }, [id]);

  const handleValidate = async (status: "VALIDATED" | "ACCEPTED" | "REJECTED") => {
    if (!reading) return;
    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/meter-readings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "خطا در بروزرسانی وضعیت"));
      await fetchReading();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در بروزرسانی وضعیت");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reading) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "قرائت یافت نشد"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/metering" className="text-muted-foreground hover:text-foreground">
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{reading.meter?.serialNumber || "بدون کنتور"}</h1>
            <Badge status={reading.status} variant={statusConfig[reading.status]?.variant || "secondary"}>
              {statusConfig[reading.status]?.label || getStatusLabel(reading.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">جزئیات قرائت کنتور</p>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">اطلاعات کلی</TabsTrigger>
              <TabsTrigger value="settlements">تسویه‌ها</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    اطلاعات قرائت
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">شماره کنتور</p>
                      <p className="font-medium font-mono">{reading.meter?.serialNumber || "-"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">دوره</p>
                      <p className="font-medium">
                        {formatPersianDate(reading.periodStart)} تا{" "}
                        {formatPersianDate(reading.periodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">منبع</p>
                      <p className="font-medium">{reading.source}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">انرژی خام</p>
                      <p className="text-2xl font-bold">{reading.rawEnergy.toLocaleString()} kWh</p>
                    </div>
                    {reading.rawPeak && (
                      <div>
                        <p className="text-sm text-muted-foreground">اوج بار</p>
                        <p className="font-medium">{reading.rawPeak.toLocaleString()} kW</p>
                      </div>
                    )}
                    {reading.rawOffPeak && (
                      <div>
                        <p className="text-sm text-muted-foreground">بار غیراوج</p>
                        <p className="font-medium">{reading.rawOffPeak.toLocaleString()} kW</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    اطلاعات نیروگاه
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">نام نیروگاه</p>
                      <p className="font-medium">{reading.asset.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">نوع نیروگاه</p>
                      <Badge variant="secondary">{assetTypeLabels[reading.asset.type] || "نوع نیروگاه نامشخص"}</Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">ظرفیت</p>
                      <p className="font-medium">{reading.asset.capacityNominal.toLocaleString()} kW</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">مکان</p>
                      <p className="font-medium">{reading.asset.province}، {reading.asset.city}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {reading.acceptedEnergy !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      اطلاعات تأیید
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">انرژی تأیید شده</p>
                        <p className="font-medium text-green-600">{reading.acceptedEnergy.toLocaleString()} kWh</p>
                      </div>
                      {reading.rejectedEnergy && (
                        <div>
                          <p className="text-sm text-muted-foreground">انرژی رد شده</p>
                          <p className="font-medium text-destructive">{reading.rejectedEnergy.toLocaleString()} kWh</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {reading.validatedBy && (
                        <div>
                          <p className="text-sm text-muted-foreground">تأیید کننده</p>
                          <p className="font-medium">{reading.validatedBy}</p>
                        </div>
                      )}
                      {reading.rejectionReason && (
                        <div>
                          <p className="text-sm text-muted-foreground">دلیل رد</p>
                          <p className="font-medium text-destructive">{reading.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Settlements Tab */}
            <TabsContent value="settlements" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    تسویه‌های مرتبط
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reading.settlements.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">هنوز تسویه‌ای ثبت نشده</p>
                  ) : (
                    <div className="space-y-3">
                      {reading.settlements.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium font-mono">{s.settlementNumber}</p>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{s.grossAmount.toLocaleString()} ریال</p>
                            <Badge status={s.status} variant={s.status === "PAID" ? "default" : "secondary"}>
                              {getStatusLabel(s.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Validation Info */}
          <Card>
            <CardHeader>
              <CardTitle>اطلاعات بررسی</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">وضعیت</p>
                <Badge status={reading.status} variant={statusConfig[reading.status]?.variant || "secondary"}>
                  {statusConfig[reading.status]?.label || getStatusLabel(reading.status)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">تاریخ ثبت</p>
                <p className="font-medium">{formatPersianDate(reading.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <RoleGate allowedRoles={TECHNICAL_ROLES}><Card>
            <CardHeader>
              <CardTitle>عملیات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {reading.status === "RAW" && (
                <>
                  <Button
                    className="w-full justify-start"
                    onClick={() => handleValidate("VALIDATED")}
                    disabled={isUpdating}
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                    اعتبارسنجی قرائت
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive"
                    onClick={() => handleValidate("REJECTED")}
                    disabled={isUpdating}
                  >
                    رد قرائت
                  </Button>
                </>
              )}
              {reading.status === "VALIDATED" && (
                <Button className="w-full justify-start" onClick={() => handleValidate("ACCEPTED")} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                  پذیرش نهایی قرائت
                </Button>
              )}
              {reading.status === "ACCEPTED" && (
                <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                  این قرائت برای محاسبه تسویه آماده است.
                </p>
              )}
            </CardContent>
          </Card></RoleGate>
        </div>
      </div>
    </div>
  );
}
