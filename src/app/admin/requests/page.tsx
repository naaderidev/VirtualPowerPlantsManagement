"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import {
  FileText,
  Eye,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
} from "lucide-react";

interface Request {
  id: string;
  caseNumber: string;
  status: string;
  plantType: string;
  capacity: number;
  province: string;
  city: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  contactMobile: string;
  party: {
    id: string;
    displayName: string;
    phone: string | null;
    type: string;
  };
  asset: {
    id: string;
    name: string;
    type: string;
  } | null;
  _count: {
    documents: number;
    reviews: number;
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

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      const response = await fetch(`/api/requests?${params.toString()}`);
      if (!response.ok) {
        throw new Error("خطا در دریافت درخواست‌ها");
      }
      const data = await response.json();
      setRequests(data.requests);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const filteredRequests = search
    ? requests.filter(
        (r) =>
          r.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
          r.party.displayName.toLowerCase().includes(search.toLowerCase()),
      )
    : requests;

  const columns = [
    {
      key: "caseNumber",
      header: "شماره درخواست",
      render: (item: Request) => (
        <span className="font-medium font-mono">{item.caseNumber}</span>
      ),
    },
    {
      key: "party",
      header: "متقاضی",
      render: (item: Request) => (
        <div>
          <p className="font-medium">{item.party.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {item.party.type === "PERSON" ? "حقیقی" : "حقوقی"}
          </p>
        </div>
      ),
    },
    {
      key: "plantType",
      header: "نوع نیروگاه",
      render: (item: Request) => (
        <Badge variant="secondary">{plantTypeLabels[item.plantType]}</Badge>
      ),
    },
    {
      key: "capacity",
      header: "ظرفیت",
      render: (item: Request) => `${item.capacity.toLocaleString()} kW`,
    },
    {
      key: "location",
      header: "مکان",
      render: (item: Request) => `${item.province}، ${item.city}`,
    },
    {
      key: "documents",
      header: "مدارک",
      render: (item: Request) => (
        <span className="text-muted-foreground">
          {item._count.documents} فایل
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "تاریخ ثبت",
      render: (item: Request) => (
        <span className="text-sm text-muted-foreground">
          {formatPersianDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Request) => <StatusBadge status={item.status as any} />,
    },
    {
      key: "actions",
      header: "عملیات",
      className: "w-12",
      render: (item: Request) => (
        <Link href={`/admin/requests/${item.id}`}>
          <Button variant="ghost" size="icon">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">صف درخواست‌ها</h1>
        <p className="text-muted-foreground">
          بررسی و مدیریت درخواست‌های فروش برق
        </p>
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
                <p className="text-sm text-muted-foreground">منتظر بررسی</p>
                <p className="text-2xl font-bold text-amber-600">
                  {
                    requests.filter(
                      (r) =>
                        r.status === "SUBMITTED" ||
                        r.status === "INITIAL_REVIEW",
                    ).length
                  }
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
                <p className="text-sm text-muted-foreground">نیاز به اطلاعات</p>
                <p className="text-2xl font-bold text-rose-800">
                  {
                    requests.filter((r) => r.status === "NEEDS_INFORMATION")
                      .length
                  }
                </p>
              </div>
              <div className="bg-rose-800 p-2 rounded-full">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تأیید شده</p>
                <p className="text-2xl font-bold text-teal-800">
                  {
                    requests.filter(
                      (r) =>
                        r.status === "ACTIVE" || r.status === "CONTRACT_SIGNED",
                    ).length
                  }
                </p>
              </div>
               <div className="bg-teal-800 p-2 rounded-full">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجوی شماره درخواست یا نام متقاضی..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v || "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="همه وضعیت‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="SUBMITTED">ارسال شده</SelectItem>
                  <SelectItem value="INITIAL_REVIEW">در حال بررسی</SelectItem>
                  <SelectItem value="NEEDS_INFORMATION">
                    نیاز به اطلاعات
                  </SelectItem>
                  <SelectItem value="ACTIVE">تأیید شده</SelectItem>
                  <SelectItem value="REJECTED">رد شده</SelectItem>
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={filteredRequests}
            pageSize={10}
            onRowClick={(item) => {
              window.location.href = `/admin/requests/${item.id}`;
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
