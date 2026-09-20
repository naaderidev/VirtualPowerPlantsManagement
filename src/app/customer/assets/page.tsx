"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStatusLabel } from "@/lib/status-labels";
import {
  Building2,
  CheckCircle2,
  Eye,
  Loader2,
  MapPin,
  Search,
  Zap,
} from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface Asset {
  id: string;
  name: string;
  type: string;
  status: string;
  province: string;
  city: string;
  capacityNominal: number;
  capacitySellable: number;
  operationalDate: string | null;
  requests: Array<{ id: string; caseNumber: string }>;
}

interface AssetListResponse {
  assets: Asset[];
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

export default function CustomerAssetsPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/assets")
      .then(async (response) => {
        if (!response.ok) throw new Error("خطا در دریافت نیروگاه‌ها");
        return response.json() as Promise<Asset[] | AssetListResponse>;
      })
      .then((data) => {
        if (active) setAssets(Array.isArray(data) ? data : data.assets);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase("fa-IR");
  const filteredAssets = normalizedSearch
    ? assets.filter((asset) =>
        [asset.name, asset.province, asset.city, typeLabels[asset.type]]
          .filter(Boolean)
          .some((value) =>
            value.toLocaleLowerCase("fa-IR").includes(normalizedSearch),
          ),
      )
    : assets;
  const activeCount = assets.filter(
    (asset) => asset.status === "ACTIVE",
  ).length;
  const totalCapacity = assets.reduce(
    (sum, asset) => sum + (asset.capacityNominal || 0),
    0,
  );

  const columns = [
    {
      key: "name",
      header: "نیروگاه",
      render: (asset: Asset) => (
        <div className="flex items-center justify-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Building2 className="h-4 w-4 text-teal-600" />
          </div>
          <div className="text-center">
            <p className="font-medium">{asset.name}</p>
            <p className="text-xs text-muted-foreground">
              {typeLabels[asset.type] || asset.type}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "capacityNominal",
      header: "ظرفیت نامی",
      render: (asset: Asset) => (
        <div className="flex items-center justify-center gap-1">
          <Zap className="h-3 w-3 text-muted-foreground" />
          <span>{asset.capacityNominal.toLocaleString()} کیلووات</span>
        </div>
      ),
    },
    {
      key: "capacitySellable",
      header: "ظرفیت قابل فروش",
      render: (asset: Asset) =>
        `${asset.capacitySellable.toLocaleString()} کیلووات`,
    },
    {
      key: "location",
      header: "مکان",
      render: (asset: Asset) => (
        <div className="flex items-center justify-center gap-1">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>
            {asset.province}، {asset.city}
          </span>
        </div>
      ),
    },
    {
      key: "request",
      header: "پرونده مبدأ",
      render: (asset: Asset) => {
        const request = asset.requests[0];
        return request ? (
          <Link
            href={`/customer/requests/${request.id}`}
            className="font-mono text-sm text-teal-700 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {request.caseNumber}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">ثبت مستقیم</span>
        );
      },
    },
    {
      key: "status",
      header: "وضعیت",
      render: (asset: Asset) => (
        <Badge status={asset.status} variant={asset.status === "ACTIVE" ? "default" : "secondary"}>
          {statusLabels[asset.status] || getStatusLabel(asset.status)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "عملیات",
      render: (asset: Asset) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`مشاهده ${asset.name}`}
          onClick={(event) => {
            event.stopPropagation();
            router.push(`/customer/assets/${asset.id}`);
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
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">نیروگاه‌های من</h1>
        <p className="text-muted-foreground">
          مشاهده نیروگاه‌های شرکت و پرونده مستقل مربوط به هر نیروگاه
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">کل نیروگاه‌ها</p>
              <p className="text-2xl font-bold">
                {assets.length.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="rounded-full bg- bg-blue-800 p-3">
              <Building2 className="h-6 w-6 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">نیروگاه فعال</p>
              <p className="text-2xl font-bold">
                {activeCount.toLocaleString("fa-IR")}
              </p>
            </div>
            <div className="rounded-full bg-teal-700 p-3">
              <CheckCircle2 className="h-6 w-6 text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ظرفیت نامی کل</p>
              <p className="text-2xl font-bold">
                {totalCapacity.toLocaleString("fa-IR")}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  کیلووات
                </span>
              </p>
            </div>
            <div className="rounded-full bg-amber-700 p-3">
              <Zap className="h-6 w-6 text-white" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="جستجوی نام، نوع یا مکان نیروگاه..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pr-10"
            />
          </div>
          <DataTable
            columns={columns}
            data={filteredAssets}
            pageSize={10}
            onRowClick={(asset) => router.push(`/customer/assets/${asset.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
