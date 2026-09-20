"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { DataTable } from "@/components/shared/data-table";
import { RoleGate } from "@/components/shared/role-gate";
import { TECHNICAL_ROLES } from "@/lib/access-control";
import { Building2, MapPin, Zap, Eye, Loader2, Search, Plus } from "lucide-react";

interface Asset {
  id: string;
  name: string;
  type: string;
  capacityNominal: number;
  capacitySellable: number;
  province: string;
  city: string;
  status: string;
  archivedAt: string | null;
  archiveReason: string | null;
  owner: {
    id: string;
    displayName: string;
  };
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  SOLAR: "خورشیدی",
  WIND: "بادی",
  GAS_TURBINE: "گازی",
  STEAM_TURBINE: "بخاری",
  CHP: "تولید هم‌زمان",
  HYDRO: "آبی",
  BIOGAS: "بیوگاز",
  OTHER: "سایر",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  PLANNING: "در حال برنامه‌ریزی",
  UNDER_CONSTRUCTION: "در حال ساخت",
  DECOMMISSIONED: "از رده خارج",
};

export default function AdminAssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [archiveState, setArchiveState] = useState<"CURRENT" | "ARCHIVED" | "ALL">("CURRENT");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function loadAssets() {
      try {
        const params = new URLSearchParams();
        if (typeFilter) params.set("type", typeFilter);
        params.set("archiveState", archiveState);

        const response = await fetch(`/api/assets?${params.toString()}`);
        if (!response.ok) throw new Error("خطا در دریافت دارایی‌ها");
        const data = await response.json();
        if (active) {
          setAssets(data.assets || []);
          setError("");
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "خطا در دریافت دارایی‌ها");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadAssets();
    return () => { active = false; };
  }, [typeFilter, archiveState]);

  const filteredAssets = search
    ? assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : assets;

  const columns = [
    {
      key: "name",
      header: "نام",
      render: (item: Asset) => (
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Building2 className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-center">
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.owner?.displayName || "-"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "نوع",
      render: (item: Asset) => typeLabels[item.type],
    },
    {
      key: "capacity",
      header: "ظرفیت",
      render: (item: Asset) => (
        <div className="flex items-center justify-center gap-1">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span>{item.capacityNominal.toLocaleString()} kW</span>
        </div>
      ),
    },
    {
      key: "location",
      header: "مکان",
      render: (item: Asset) => (
        <div className="flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>
            {item.province}، {item.city}
          </span>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "تاریخ ایجاد",
      render: (item: Asset) => (
        <span className="text-sm text-muted-foreground">
          {formatPersianDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Asset) => (
        <div className="flex flex-wrap justify-center gap-1">
          <Badge status={item.status} variant={item.status === "ACTIVE" ? "default" : "secondary"}>
            {statusLabels[item.status]}
          </Badge>
          {item.archivedAt && <Badge status="DEPRECATED">بایگانی‌شده</Badge>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "عملیات",
      render: (item: Asset) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/assets/${item.id}`);
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
          <h1 className="text-2xl font-bold">دارایی‌ها</h1>
          <p className="text-muted-foreground">مدیریت نیروگاه‌ها و دارایی‌ها</p>
        </div>
        <RoleGate allowedRoles={TECHNICAL_ROLES}><Link href="/admin/assets/new">
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            دارایی جدید
          </Button>
        </Link></RoleGate>
      </div>

      <Card>
        <CardContent className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجوی نام نیروگاه..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v || "")}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="همه انواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه انواع</SelectItem>
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels
                value={archiveState}
                onValueChange={(value) => setArchiveState(value as "CURRENT" | "ARCHIVED" | "ALL")}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURRENT">دارایی‌های جاری</SelectItem>
                  <SelectItem value="ARCHIVED">دارایی‌های بایگانی‌شده</SelectItem>
                  <SelectItem value="ALL">همه دارایی‌ها</SelectItem>
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={filteredAssets}
            pageSize={10}
            onRowClick={(item) => router.push(`/admin/assets/${item.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
