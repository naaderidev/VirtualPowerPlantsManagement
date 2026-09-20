"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { formatPersianDate } from "@/lib/persian-date";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Building2,
  FileSignature,
  Receipt,
  Plus,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { REQUEST_STATUS_CUSTOMER_MAP, type RequestStatus } from "@/domain/requests";

interface CustomerData {
  canCreateRequest: boolean;
  hasActingParty: boolean;
  requiresRepresentativeAssignment?: boolean;
  requiresActingPartySelection?: boolean;
  requests: Array<{
    id: string;
    caseNumber: string;
    status: RequestStatus;
    plantType: string;
    capacity: number;
    createdAt: string;
  }>;
  stats: {
    totalRequests: number;
    activeRequests: number;
    totalAssets: number;
    totalContracts: number;
  };
}

const plantTypeLabels: Record<string, string> = {
  SOLAR: "خورشیدی",
  WIND: "بادی",
  GAS_TURBINE: "گازی",
  STEAM_TURBINE: "بخاری",
  CHP: "تولید هم‌زمان",
  HYDRO: "آبی",
  BIOGAS: "بیوگاز",
  OTHER: "سایر",
};

export default function CustomerDashboard() {
  const { data: session } = useSession();
  const [data, setData] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/customer/dashboard")
      .then(async (response) => {
        if (!response.ok) throw new Error("خطا در دریافت اطلاعات");
        return response.json() as Promise<CustomerData>;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => console.error(cause))
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">داشبورد</h1>
        <p className="text-muted-foreground">
          خوش آمدید، {session?.user?.name || "کاربر"}
        </p>
      </div>

      {data?.requiresRepresentativeAssignment && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent>
            <p className="font-medium">هنوز نمایندگی فعالی برای این حساب تعریف نشده است.</p>
            <p className="mt-1 text-sm text-muted-foreground">مدیر سامانه باید رابطه نمایندگی معتبر را به یک طرف تجاری متصل کند. تا آن زمان اطلاعاتی برای نمایش وجود ندارد.</p>
          </CardContent>
        </Card>
      )}

      {data?.requiresActingPartySelection && (
        <Card className="border-cyan-300 bg-cyan-50">
          <CardContent>
            <p className="font-medium">برای ادامه، شرکت طرف فعالیت را انتخاب کنید.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              انتخاب‌گر شرکت در بالای صفحه باز است. بعد از انتخاب، اطلاعات فقط برای همان شرکت نمایش داده می‌شود.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">درخواست‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {data?.stats.totalRequests || 0}
                </p>
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
                <p className="text-sm text-muted-foreground">نیروگاه‌ها</p>
                <p className="text-2xl font-bold text-teal-600">
                  {data?.stats.totalAssets || 0}
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <Building2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قراردادها</p>
                <p className="text-2xl font-bold text-amber-600">
                  {data?.stats.totalContracts || 0}
                </p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <FileSignature className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تسویه‌ها</p>
                <p className="text-2xl font-bold text-pink-700">۰</p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <Receipt className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        data-testid="customer-dashboard-content-grid"
        className={`grid grid-cols-1 gap-4 ${
          data?.hasActingParty ? "md:grid-cols-3" : ""
        }`}
      >
        {/* Recent Requests */}
        <Card className={data?.hasActingParty ? "md:col-span-2" : undefined}>
          <CardContent className="">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">درخواست‌های اخیر</p>
              {data?.hasActingParty && (
                <Link href="/customer/requests">
                  <Button variant="ghost" size="sm">
                    مشاهده همه
                    <ArrowLeft className="h-4 w-4 mr-1" />
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {!data?.requests || data.requests.length === 0 ? (
                <div className="text-center py-3.5 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>هنوز درخواستی ارسال نکرده‌اید</p>
                  {data?.canCreateRequest && <Link href="/customer/requests/new">
                    <Button className="mt-4">
                      <Plus className="h-4 w-4 ml-2" />
                      ایجاد درخواست جدید
                    </Button>
                  </Link>}
                </div>
              ) : (
                data.requests.slice(0, 3).map((request) => (
                  <Link
                    key={request.id}
                    href={`/customer/requests/${request.id}`}
                  >
                    <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium font-mono">
                              {request.caseNumber}
                            </span>
                            <Badge status={request.status}>
                              {REQUEST_STATUS_CUSTOMER_MAP[request.status].display}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {plantTypeLabels[request.plantType] ||
                              request.plantType}{" "}
                            • {request.capacity.toLocaleString()} kW
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

        {/* Quick Links */}
        {data?.hasActingParty && <div className="col-span-1">
          <div className="flex flex-col gap-4">
            {data?.canCreateRequest && <Link href="/customer/requests/new" className="block">
              <Card className="hover:bg-muted/50 cursor-pointer">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="bg-cyan-800 p-2 rounded-full">
                      <Plus className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">درخواست جدید</p>
                      <p className="text-xs text-muted-foreground">
                        ثبت درخواست فروش برق
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>}
            <Link href="/customer/requests" className="block">
              <Card className="hover:bg-muted/50 cursor-pointer">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">درخواست‌های من</p>
                      <p className="text-xs text-muted-foreground">
                        مشاهده درخواست‌ها
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/customer/assets" className="block">
              <Card className="hover:bg-muted/50 cursor-pointer">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-600 p-2 rounded-full">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">نیروگاه‌های من</p>
                      <p className="text-xs text-muted-foreground">
                        مدیریت نیروگاه‌ها
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>}
      </div>
    </div>
  );
}
