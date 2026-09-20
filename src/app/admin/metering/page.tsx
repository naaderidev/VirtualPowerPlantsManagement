"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { DataTable } from "@/components/shared/data-table";
import { RoleGate } from "@/components/shared/role-gate";
import { TECHNICAL_ROLES } from "@/lib/access-control";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Search,
  Loader2,
} from "lucide-react";

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
  source: string;
  status: string;
  createdAt: string;
  asset: {
    id: string;
    name: string;
    type: string;
  };
  meter: {
    id: string;
    serialNumber: string;
  } | null;
}

const statusLabels: Record<string, string> = {
  RAW: "خام",
  VALIDATED: "اعتبارسنجی شده",
  ACCEPTED: "پذیرفته نهایی",
  REJECTED: "رد شده",
  ADJUSTED: "اصلاح‌شده",
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

async function getMeterReadings(): Promise<MeterReading[]> {
  const response = await fetch("/api/meter-readings");
  if (!response.ok) throw new Error("خطا در دریافت قرائت‌ها");
  return response.json() as Promise<MeterReading[]>;
}

export default function MeteringPage() {
  const router = useRouter();
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function loadReadings() {
      try {
        const rows = await getMeterReadings();
        if (active) setReadings(rows);
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "خطا در دریافت قرائت‌ها");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadReadings();
    return () => { active = false; };
  }, []);

  const filteredReadings = readings.filter((r) => {
    const matchesStatus = !statusFilter || r.status === statusFilter;
    const matchesSearch =
      !search ||
      r.asset.name.includes(search) ||
      r.meter?.serialNumber?.includes(search) ||
      r.id.includes(search);
    return matchesStatus && matchesSearch;
  });

  const columns = [
    {
      key: "asset",
      header: "نیروگاه",
      render: (item: MeterReading) => (
        <div>
          <p className="font-medium">{item.asset.name}</p>
          <p className="text-xs text-muted-foreground">
            {assetTypeLabels[item.asset.type] || item.asset.type}
          </p>
        </div>
      ),
    },
    {
      key: "meter",
      header: "شماره کنتور",
      render: (item: MeterReading) => (
        <span className="font-medium font-mono">
          {item.meter?.serialNumber || "-"}
        </span>
      ),
    },
    {
      key: "period",
      header: "دوره",
      render: (item: MeterReading) => (
        <span>
          {formatPersianDate(item.periodStart)} تا{" "}
          {formatPersianDate(item.periodEnd)}
        </span>
      ),
    },
    {
      key: "energy",
      header: "انرژی خام (kWh)",
      render: (item: MeterReading) => item.rawEnergy.toLocaleString(),
    },
    {
      key: "accepted",
      header: "انرژی تأیید شده",
      render: (item: MeterReading) => (
        <span
          className={
            item.acceptedEnergy !== null
              ? "text-green-600"
              : "text-muted-foreground"
          }
        >
          {item.acceptedEnergy?.toLocaleString() || "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: MeterReading) => (
        <Badge
          status={item.status}
          variant={
            item.status === "ACCEPTED"
              ? "default"
              : item.status === "REJECTED"
                ? "destructive"
                : "secondary"
          }
        >
          {statusLabels[item.status] || getStatusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "تاریخ ثبت",
      render: (item: MeterReading) => (
        <span>{formatPersianDate(item.createdAt)}</span>
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
          <h1 className="text-2xl font-bold">اندازه‌گیری</h1>
          <p className="text-muted-foreground">
            مدیریت قرائت‌های کنتور و انرژی
          </p>
        </div>
        <RoleGate allowedRoles={TECHNICAL_ROLES}><Link href="/admin/metering/new">
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            قرائت جدید
          </Button>
        </Link></RoleGate>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل قرائت‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {readings.length}
                </p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <Zap className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">پذیرفته نهایی</p>
                <p className="text-2xl font-bold text-teal-600">
                  {readings.filter((r) => r.status === "ACCEPTED").length}
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
                <p className="text-sm text-muted-foreground">خام</p>
                <p className="text-2xl font-bold text-amber-600">
                  {readings.filter((r) => r.status === "RAW").length}
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
                <p className="text-sm text-muted-foreground">در انتظار پذیرش</p>
                <p className="text-2xl font-bold text-rose-800">
                  {readings.filter((r) => r.status === "VALIDATED").length}
                </p>
              </div>
              <div className="bg-rose-800 p-2 rounded-full">
                <AlertTriangle className="h-7 w-7 text-white" />
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
                  placeholder="جستجوی نام نیروگاه یا شماره کنتور..."
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
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="همه وضعیت‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه وضعیت‌ها</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>

        <CardContent className="">
          <DataTable
            columns={columns}
            data={filteredReadings}
            pageSize={10}
            onRowClick={(item) => router.push(`/admin/metering/${item.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
