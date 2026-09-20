"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatPersianDate } from "@/lib/persian-date";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus, FileText, Loader2, Search } from "lucide-react";
import type { RequestStatus } from "@/domain/requests";
import { getRequiredRequestDocumentTypes } from "@/domain/documents";

interface Request {
  id: string;
  caseNumber: string;
  status: RequestStatus;
  plantType: string;
  capacity: number;
  province: string;
  city: string;
  operationalStatus: string;
  hasExistingContract: boolean;
  createdAt: string;
  party: { displayName: string };
  asset: { name: string } | null;
  _count: { documents: number };
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

export default function CustomerRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/requests");
      if (!response.ok) throw new Error("خطا در دریافت درخواست‌ها");
      const data = await response.json();
      setRequests(data.requests);
      setCanCreate(data.permissions?.canCreate === true);
    } catch {
      console.error("خطا در دریافت درخواست‌ها");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRequests = requests.filter(
    (r) =>
      !search || r.caseNumber.includes(search) || r.province.includes(search),
  );

  const submittedCount = requests.filter(
    (r) => r.status === "SUBMITTED",
  ).length;
  const reviewCount = requests.filter((r) =>
    ["INITIAL_REVIEW", "NEEDS_INFORMATION"].includes(r.status),
  ).length;
  const activeCount = requests.filter((r) => r.status === "ACTIVE").length;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست‌های من</h1>
          <p className="text-muted-foreground">مدیریت درخواست‌های فروش برق</p>
        </div>
        {canCreate && <Link href="/customer/requests/new">
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            درخواست جدید
          </Button>
        </Link>}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل درخواست‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {requests.length}
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
                <p className="text-sm text-muted-foreground">ارسال شده</p>
                <p className="text-2xl font-bold text-teal-600">
                  {submittedCount}
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">در حال بررسی</p>
                <p className="text-2xl font-bold text-amber-600">
                  {reviewCount}
                </p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فعال</p>
                <p className="text-2xl font-bold text-pink-700">
                  {activeCount}
                </p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="">
          <div className="w-full md:w-96">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="جستجوی شماره درخواست یا استان..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
        </CardContent>

        <CardContent className="">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>هنوز درخواستی ثبت نکرده‌اید</p>
              {canCreate && <Link href="/customer/requests/new">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 ml-2" />
                  ثبت اولین درخواست
                </Button>
              </Link>}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredRequests.map((request) => (
                <Link
                  key={request.id}
                  href={`/customer/requests/${request.id}`}
                >
                  <div className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-cyan-800/10 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-cyan-800" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium font-mono">
                              {request.caseNumber}
                            </p>
                            <StatusBadge status={request.status} />
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {request.asset?.name ??
                              plantTypeLabels[request.plantType] ??
                              request.plantType}{" "}
                            • {request.capacity.toLocaleString()} kW • {request._count.documents.toLocaleString("fa-IR")} از {getRequiredRequestDocumentTypes({ operationalStatus: request.operationalStatus, hasExistingContract: request.hasExistingContract }).length.toLocaleString("fa-IR")} مدرک الزامی
                          </p>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-sm text-muted-foreground">
                          {request.province}، {request.city}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatPersianDate(request.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
