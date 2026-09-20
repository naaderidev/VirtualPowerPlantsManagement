"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { ContractStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Loader2, Search } from "lucide-react";

interface Contract {
  id: string;
  contractNumber: string;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  parties: Array<{ party: { displayName: string } }>;
  assets: Array<{ asset: { name: string; capacityNominal: number | null; status: string } }>;
}

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  CONFIGURED: "پیکربندی‌شده",
  INTERNAL_REVIEW: "در حال بررسی داخلی",
  NEEDS_CHANGES: "نیاز به اصلاح",
  PENDING_SIGNATURE: "در انتظار امضا",
  SIGNED: "امضا شده",
  ACTIVE: "فعال",
  AMENDMENT_PENDING: "در انتظار اصلاحیه",
  TERMINATION_PENDING: "در حال بررسی فسخ",
  TERMINATED: "خاتمه یافته",
  EXPIRED: "منقضی شده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
};

export default function CustomerContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const res = await fetch("/api/contracts");
      if (!res.ok) throw new Error("خطا در دریافت قراردادها");
      const data = await res.json();
      setContracts(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error("خطا در دریافت قراردادها");
    } finally {
      setLoading(false);
    }
  };

  const filteredContracts = contracts.filter((c) => {
    const matchesStatus = !statusFilter || c.status === statusFilter;
    const matchesSearch = !search || c.contractNumber.includes(search);
    return matchesStatus && matchesSearch;
  });

  const activeCount = contracts.filter((c) => c.status === "ACTIVE").length;
  const signedCount = contracts.filter((c) => c.status === "SIGNED").length;

  const columns = [
    {
      key: "contractNumber",
      header: "شماره قرارداد",
      render: (item: Contract) => (
        <span className="font-medium font-mono">{item.contractNumber}</span>
      ),
    },
    {
      key: "asset",
      header: "نیروگاه",
      render: (item: Contract) => {
        const asset = item.assets[0]?.asset;
        return (
          <div>
            <p className="font-medium">{asset?.name || "نامشخص"}</p>
            {asset?.capacityNominal && (
              <p className="text-xs text-muted-foreground">{asset.capacityNominal.toLocaleString()} kW</p>
            )}
          </div>
        );
      },
    },
    {
      key: "party",
      header: "طرف قرارداد",
      render: (item: Contract) => (
        <span>{item.parties[0]?.party?.displayName || "نامشخص"}</span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Contract) => item.status === "SIGNED" && item.assets.some(({ asset }) => asset.status !== "ACTIVE")
        ? <Badge status="PENDING">امضاشده، در انتظار بهره‌برداری</Badge>
        : <ContractStatusBadge status={item.status as any} />,
    },
    {
      key: "effectiveDate",
      header: "تاریخ شروع",
      render: (item: Contract) =>
        item.effectiveDate ? formatPersianDate(item.effectiveDate) : "—",
    },
    {
      key: "expirationDate",
      header: "تاریخ پایان",
      render: (item: Contract) =>
        item.expirationDate ? formatPersianDate(item.expirationDate) : "—",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">قراردادهای من</h1>
        <p className="text-muted-foreground">مشاهده قراردادهای فروش برق</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل قراردادها</p>
                <p className="text-2xl font-bold text-cyan-800">{contracts.length}</p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <FileSignature className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فعال</p>
                <p className="text-2xl font-bold text-teal-600">{activeCount}</p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <FileSignature className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">امضا شده</p>
                <p className="text-2xl font-bold text-amber-600">{signedCount}</p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <FileSignature className="h-7 w-7 text-white" />
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
                  placeholder="جستجوی شماره قرارداد..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels value={statusFilter} onValueChange={(v) => setStatusFilter(v || "")}>
                <SelectTrigger>
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
            onRowClick={(item) => {
              window.location.href = `/customer/contracts/${item.id}`;
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
