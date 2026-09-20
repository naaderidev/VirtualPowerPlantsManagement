"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { RoleGate } from "@/components/shared/role-gate";
import { SUPPLY_ROLES } from "@/lib/access-control";
import { Plus, Eye, Loader2, FileText, Clock, CheckCircle2, NotebookPen, Search } from "lucide-react";

interface Contract {
  id: string;
  contractNumber: string;
  type: string;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  createdAt: string;
  parties: Array<{
    party: {
      displayName: string;
    };
    role: string;
    isPrimary: boolean;
  }>;
  assets: Array<{
    asset: {
      name: string;
      capacityNominal: number;
    };
  }>;
  _count: {
    settlements: number;
    amendments: number;
  };
}

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  CONFIGURED: "پیکربندی",
  INTERNAL_REVIEW: "بررسی داخلی",
  NEEDS_CHANGES: "نیاز به اصلاح",
  PENDING_SIGNATURE: "منتظر امضا",
  SIGNED: "امضا شده",
  ACTIVE: "فعال",
  AMENDMENT_PENDING: "در انتظار الحاقیه",
  TERMINATION_PENDING: "در انتظار خاتمه",
  TERMINATED: "خاتمه یافته",
  EXPIRED: "منقضی",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
};

const typeLabels: Record<string, string> = {
  PPA: "قرارداد خرید تضمینی",
};

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchContracts = async () => {
    try {
      const response = await fetch("/api/contracts");
      if (!response.ok) throw new Error("خطا در دریافت قراردادها");
      const data = await response.json();
      setContracts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const filteredContracts = contracts
    .filter((c) => !statusFilter || c.status === statusFilter)
    .filter((c) =>
      search
        ? c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
          c.parties.some((p) => p.party.displayName.toLowerCase().includes(search.toLowerCase()))
        : true
    );

  const columns = [
    {
      key: "contractNumber",
      header: "شماره قرارداد",
      render: (item: Contract) => (
        <span className="font-medium font-mono">{item.contractNumber}</span>
      ),
    },
    {
      key: "party",
      header: "طرف قرارداد",
      render: (item: Contract) => {
        const primaryParty = item.parties.find((p) => p.isPrimary)?.party || item.parties[0]?.party;
        const primaryAsset = item.assets[0]?.asset;
        return (
          <div className="text-center">
            <p className="font-medium">{primaryParty?.displayName || "-"}</p>
            <p className="text-xs text-muted-foreground">
              {item.assets.length === 2
                ? `توافق‌نامه مادر • ۲ نیروگاه`
                : primaryAsset?.name || "-"}
            </p>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "نوع",
      render: (item: Contract) => (
        <Badge variant="secondary">{typeLabels[item.type] || "نوع قرارداد نامشخص"}</Badge>
      ),
    },
    {
      key: "assets",
      header: "ظرفیت",
      render: (item: Contract) => {
        const totalCapacity = item.assets.reduce((sum, a) => sum + a.asset.capacityNominal, 0);
        return `${totalCapacity.toLocaleString()} kW`;
      },
    },
    {
      key: "createdAt",
      header: "تاریخ ایجاد",
      render: (item: Contract) => (
        <span className="text-sm text-muted-foreground">
          {formatPersianDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "effectiveDate",
      header: "تاریخ شروع",
      render: (item: Contract) =>
        formatPersianDate(item.effectiveDate),
    },
    {
      key: "expirationDate",
      header: "تاریخ پایان",
      render: (item: Contract) =>
        item.expirationDate
          ? formatPersianDate(item.expirationDate)
          : "—",
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Contract) => (
        <Badge status={item.status} variant={item.status === "ACTIVE" ? "default" : "secondary"}>
          {statusLabels[item.status] || getStatusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "عملیات",
      render: (item: Contract) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/contracts/${item.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قراردادها</h1>
          <p className="text-muted-foreground">مدیریت قراردادهای فروش برق</p>
        </div>
        <RoleGate allowedRoles={SUPPLY_ROLES}><Link href="/admin/contracts/new">
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            قرارداد جدید
          </Button>
        </Link></RoleGate>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل قراردادها</p>
                <p className="text-2xl font-bold text-cyan-800">{contracts.length}</p>
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
                <p className="text-sm text-muted-foreground">فعال</p>
                <p className="text-2xl font-bold text-teal-600">
                  {contracts.filter((c) => c.status === "ACTIVE").length}
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">منتظر امضا</p>
                <p className="text-2xl font-bold text-amber-600">
                  {contracts.filter((c) => c.status === "PENDING_SIGNATURE").length}
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
                <p className="text-sm text-muted-foreground">پیش‌نویس</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {contracts.filter((c) => c.status === "DRAFT").length}
                </p>
              </div>
              <div className="bg-yellow-500 p-2 rounded-full">
                <NotebookPen className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجوی شماره قرارداد یا نام طرف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels value={statusFilter} onValueChange={(v) => setStatusFilter(v || "")}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="همه وضعیت‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه وضعیت‌ها</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={filteredContracts}
            pageSize={10}
            onRowClick={(item) => router.push(`/admin/contracts/${item.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
