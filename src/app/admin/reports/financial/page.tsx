"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  DollarSign,
  TrendingUp,
  Clock,
  Landmark,
  BarChart3,
  Loader2,
} from "lucide-react";

interface FinancialData {
  summary: {
    totalSettlements: number;
    totalAmount: number;
    totalPaid: number;
    totalPending: number;
    activeContracts: number;
    byStatus: Record<string, number>;
  };
  recentSettlements: Array<{
    id: string;
    settlementNumber: string;
    grossAmount: number;
    status: string;
    createdAt: string;
    contract: {
      contractNumber: string;
      parties: Array<{
        party: {
          displayName: string;
        };
      }>;
    };
  }>;
}

const statusLabels: Record<string, string> = {
  CALCULATED: "محاسبه شده",
  DRAFT: "پیش‌نویس",
  UNDER_REVIEW: "در حال بررسی",
  CONFIRMED: "تأیید شده",
  DISPUTED: "مورد اعتراض",
  ADJUSTED: "اصلاح شده",
  INVOICED: "صورتحساب صادر شده",
  PAID: "پرداخت شده",
};

export default function FinancialReportPage() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/reports/financial");
      if (!response.ok) throw new Error("خطا در دریافت گزارش");
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

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
        خطا در دریافت گزارش
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">گزارش مالی</h1>
        <p className="text-muted-foreground">خلاصه وضعیت مالی سیستم</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل مبالغ</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {((data.summary.totalAmount || 0) / 1000000).toFixed(1)} <span className="text-sm">م.ر</span>
                </p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <DollarSign className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">پرداخت شده</p>
                <p className="text-2xl font-bold text-teal-600">
                  {((data.summary.totalPaid || 0) / 1000000).toFixed(1)} <span className="text-sm">م.ر</span>
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">مانده</p>
                <p className="text-2xl font-bold text-amber-600">
                  {((data.summary.totalPending || 0) / 1000000).toFixed(1)} <span className="text-sm">م.ر</span>
                </p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <Clock className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قراردادهای فعال</p>
                <p className="text-2xl font-bold text-pink-700">{data.summary.activeContracts}</p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <Landmark className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown + Recent Settlements */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Status Breakdown */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-teal-600 p-2 rounded-full">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-medium">وضعیت تسویه‌ها</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(data.summary.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">{statusLabels[status] || getStatusLabel(status)}</span>
                  <Badge status={status} variant={status === "PAID" ? "default" : "secondary"}>
                    {count as number}
                  </Badge>
                </div>
              ))}
              {Object.keys(data.summary.byStatus || {}).length === 0 && (
                <p className="text-muted-foreground text-center py-4">داده‌ای موجود نیست</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Settlements */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-teal-600 p-2 rounded-full">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-medium">آخرین تسویه‌ها</h3>
            </div>
            <div className="space-y-3">
              {data.recentSettlements.map((settlement) => {
                const primaryParty = settlement.contract.parties.find((p) => p.party)?.party;
                return (
                  <div key={settlement.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium font-mono">{settlement.settlementNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {primaryParty?.displayName} • {settlement.contract.contractNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <p className="font-medium">{settlement.grossAmount.toLocaleString()} ریال</p>
                        <p className="text-xs text-muted-foreground">
                          {formatPersianDate(settlement.createdAt)}
                        </p>
                      </div>
                      <Badge status={settlement.status} variant={settlement.status === "PAID" ? "default" : "secondary"}>
                        {statusLabels[settlement.status] || getStatusLabel(settlement.status)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {data.recentSettlements.length === 0 && (
                <p className="text-muted-foreground text-center py-4">تسویه‌ای ثبت نشده</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
