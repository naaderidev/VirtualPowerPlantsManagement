"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FileSignature,
  Calculator,
  Zap,
  DollarSign,
  Loader2,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  access: { financials: boolean; metering: boolean };
  stats: {
    totalParties: number;
    totalAssets: number;
    totalContracts: number;
    activeContracts: number;
    totalSettlements: number;
    pendingSettlements: number;
    totalReadings: number;
    pendingReadings: number;
    totalRequests: number;
    pendingRequests: number;
    totalAmount: number;
    totalPaid: number;
    totalEnergy: number;
    acceptedEnergy: number;
  };
  recentRequests: Array<{
    id: string;
    caseNumber: string;
    status: string;
    createdAt: string;
    party: { displayName: string };
  }>;
  recentSettlements: Array<{
    id: string;
    settlementNumber: string;
    grossAmount: number;
    status: string;
    createdAt: string;
    contract: {
      contractNumber: string;
      parties: Array<{ party: { displayName: string } }>;
    };
  }>;
}

const requestStatusLabels: Record<string, string> = {
  SUBMITTED: "ارسال شده",
  INITIAL_REVIEW: "در حال بررسی",
  NEEDS_INFORMATION: "نیاز به اطلاعات",
  ACTIVE: "فعال",
  REJECTED: "رد شده",
};

const settlementStatusLabels: Record<string, string> = {
  CALCULATED: "محاسبه شده",
  UNDER_REVIEW: "در حال بررسی",
  CONFIRMED: "تأیید شده",
  PAID: "پرداخت شده",
};

const responsiveCardGridClass =
  "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]";

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/dashboard")
      .then(async (response) => {
        if (!response.ok) throw new Error("خطا در دریافت اطلاعات");
        return response.json() as Promise<DashboardData>;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((error: unknown) => console.error(error))
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        خطا در دریافت اطلاعات داشبورد
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">داشبورد عملیات</h1>
        <p className="text-muted-foreground">مشاهده کلی عملیات سیستم</p>
      </div>

      {/* Stats */}
      <div className={responsiveCardGridClass} data-testid="dashboard-stat-grid">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">درخواست‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">{data.stats.totalRequests}</p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قراردادها</p>
                <p className="text-2xl font-bold text-teal-600">{data.stats.activeContracts} <span className="text-sm">فعال</span></p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <FileSignature className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        {data.access.financials && <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تسویه‌ها</p>
                <p className="text-2xl font-bold text-amber-600">{data.stats.totalSettlements}</p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <Calculator className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>}
        {data.access.metering && <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قرائت‌ها</p>
                <p className="text-2xl font-bold text-pink-700">{data.stats.totalReadings}</p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <Zap className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>}
      </div>

      {/* Financial & Energy Stats */}
      {(data.access.financials || data.access.metering) && <div className={responsiveCardGridClass} data-testid="dashboard-summary-grid">
        {data.access.financials && <Card>
          <CardContent className="">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">وضعیت مالی</p>
              <div className="bg-cyan-800 p-2 rounded-full">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">کل مبالغ</span>
                <span className="font-medium">{((data.stats.totalAmount || 0) / 1000000).toFixed(1)} م.ر</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">پرداخت شده</span>
                <span className="font-medium text-green-600">{((data.stats.totalPaid || 0) / 1000000).toFixed(1)} م.ر</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">مانده</span>
                <span className="font-medium text-yellow-600">{(((data.stats.totalAmount || 0) - (data.stats.totalPaid || 0)) / 1000000).toFixed(1)} م.ر</span>
              </div>
            </div>
          </CardContent>
        </Card>}

        {data.access.metering && <Card>
          <CardContent className="">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-muted-foreground">وضعیت انرژی</p>
              <div className="bg-teal-600 p-2 rounded-full">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">کل انرژی</span>
                <span className="font-medium">{((data.stats.totalEnergy || 0) / 1000).toFixed(0)} هزار kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">تأیید شده</span>
                <span className="font-medium text-green-600">{((data.stats.acceptedEnergy || 0) / 1000).toFixed(0)} هزار kWh</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">نرخ تأیید</span>
                <span className="font-medium">
                  {data.stats.totalEnergy > 0
                    ? ((data.stats.acceptedEnergy || 0) / data.stats.totalEnergy * 100).toFixed(1)
                    : 0}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>}
      </div>}

      {/* Recent Activities */}
      <div className={responsiveCardGridClass} data-testid="dashboard-activity-grid">
        {/* Recent Requests */}
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">آخرین درخواست‌ها</p>
              <Link href="/admin/requests">
                <Button variant="ghost" size="sm">
                  مشاهده همه
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {data.recentRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">درخواستی وجود ندارد</p>
              ) : (
                data.recentRequests.slice(0, 3).map((request) => (
                  <Link key={request.id} href={`/admin/requests/${request.id}`}>
                    <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium font-mono">{request.caseNumber}</span>
                            <Badge status={request.status}>
                              {requestStatusLabels[request.status] || getStatusLabel(request.status)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {request.party.displayName}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatPersianDate(request.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Settlements */}
        {data.access.financials && <Card>
          <CardContent className="">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">آخرین تسویه‌ها</p>
              <Link href="/admin/settlements">
                <Button variant="ghost" size="sm">
                  مشاهده همه
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </Link>
            </div>
            <div className="flex flex-col gap-1">
              {data.recentSettlements.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">تسویه‌ای وجود ندارد</p>
              ) : (
                data.recentSettlements.slice(0, 3).map((settlement) => {
                  const primaryParty = settlement.contract.parties[0]?.party;
                  return (
                    <Link key={settlement.id} href={`/admin/settlements/${settlement.id}`}>
                      <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium font-mono">{settlement.settlementNumber}</span>
                              <Badge status={settlement.status}>
                                {settlementStatusLabels[settlement.status] || getStatusLabel(settlement.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {primaryParty?.displayName} • {settlement.grossAmount.toLocaleString()} ریال
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>}
      </div>

      {/* Quick Links */}
      <div className={responsiveCardGridClass} data-testid="dashboard-quick-link-grid">
        <Link href="/admin/requests" className="block">
          <Card className="hover:bg-muted/50 cursor-pointer">
            <CardContent className="">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-800 p-2 rounded-full">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">صف درخواست‌ها</p>
                  <p className="text-xs text-muted-foreground">مشاهده تمام درخواست‌ها</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/contracts" className="block">
          <Card className="hover:bg-muted/50 cursor-pointer">
            <CardContent className="">
              <div className="flex items-center gap-3">
                <div className="bg-teal-600 p-2 rounded-full">
                  <FileSignature className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">قراردادها</p>
                  <p className="text-xs text-muted-foreground">مدیریت قراردادها</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        {data.access.financials && <Link href="/admin/settlements" className="block">
          <Card className="hover:bg-muted/50 cursor-pointer">
            <CardContent className="">
              <div className="flex items-center gap-3">
                <div className="bg-amber-600 p-2 rounded-full">
                  <Calculator className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">تسویه‌ها</p>
                  <p className="text-xs text-muted-foreground">بررسی تسویه‌ها</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>}
        {data.access.metering && <Link href="/admin/metering" className="block">
          <Card className="hover:bg-muted/50 cursor-pointer">
            <CardContent className="">
              <div className="flex items-center gap-3">
                <div className="bg-pink-700 p-2 rounded-full">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">اندازه‌گیری</p>
                  <p className="text-xs text-muted-foreground">مدیریت قرائت‌ها</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>}
      </div>
    </div>
  );
}
