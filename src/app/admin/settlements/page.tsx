"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { RoleGate } from "@/components/shared/role-gate";
import {
  Calculator,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";

interface Settlement {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  energyAccepted: number;
  unitPrice: number;
  grossAmount: number;
  netAmount: number;
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
  asset: { name: string };
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  CALCULATED: { label: "محاسبه شده", variant: "outline" },
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  UNDER_REVIEW: { label: "در حال بررسی", variant: "secondary" },
  CONFIRMED: { label: "تأیید شده", variant: "default" },
  DISPUTED: { label: "مورد اعتراض", variant: "destructive" },
  ADJUSTED: { label: "اصلاح شده", variant: "secondary" },
  INVOICED: { label: "صورتحساب صادر شده", variant: "default" },
  PAID: { label: "پرداخت شده", variant: "default" },
};

export default function SettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadSettlements() {
      try {
        const response = await fetch("/api/settlements");
        if (!response.ok) throw new Error("خطا در دریافت تسویه‌ها");
        const data: unknown = await response.json();
        if (active) setSettlements(data as Settlement[]);
      } catch (cause: unknown) {
        if (active) setError(cause instanceof Error ? cause.message : "خطا در دریافت تسویه‌ها");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadSettlements();
    return () => {
      active = false;
    };
  }, []);

  const columns = [
    {
      key: "settlementNumber",
      header: "شماره تسویه",
      render: (item: Settlement) => (
        <span className="font-medium font-mono">{item.settlementNumber}</span>
      ),
    },
    {
      key: "period",
      header: "دوره",
      render: (item: Settlement) => (
        <span className="font-medium">
          {formatPersianDate(item.periodStart)} تا{" "}
          {formatPersianDate(item.periodEnd)}
        </span>
      ),
    },
    {
      key: "party",
      header: "طرف قرارداد",
      render: (item: Settlement) => {
        const primaryParty = item.contract.parties.find((p) => p.party)?.party;
        return (
          <div>
            <p className="font-medium">{primaryParty?.displayName || "-"}</p>
            <p className="text-xs text-muted-foreground">
              {item.contract.contractNumber} • {item.asset.name}
            </p>
          </div>
        );
      },
    },
    {
      key: "energy",
      header: "انرژی (kWh)",
      render: (item: Settlement) => item.energyAccepted.toLocaleString(),
    },
    {
      key: "amount",
      header: "مبلغ (ریال)",
      render: (item: Settlement) => (
        <span className="font-medium">{item.grossAmount.toLocaleString()}</span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Settlement) => {
        const config = statusConfig[item.status];
        return (
          <Badge status={item.status} variant={config?.variant || "secondary"}>
            {config?.label || getStatusLabel(item.status)}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (item: Settlement) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/settlements/${item.id}`);
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
          <h1 className="text-2xl font-bold">تسویه‌ها</h1>
          <p className="text-muted-foreground">
            محاسبه و تأیید تسویه‌های دوره‌ای
          </p>
        </div>
        <div className="flex gap-2">
          <RoleGate allowedRoles={["ADMIN"]}><Link href="/admin/settlements/new">
            <Button>
              <Calculator className="h-4 w-4 ml-2" />
              محاسبه تسویه جدید
            </Button>
          </Link></RoleGate>
          <Link href="/admin/reports/financial">
            <Button variant="outline">
              <FileText className="h-4 w-4 ml-2" />
              گزارش مالی
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل تسویه‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {settlements.length}
                </p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <Calculator className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تأیید شده</p>
                <p className="text-2xl font-bold text-teal-600">
                  {settlements.filter((s) => s.status === "CONFIRMED").length}
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
                <p className="text-sm text-muted-foreground">در حال بررسی</p>
                <p className="text-2xl font-bold text-amber-600">
                  {
                    settlements.filter((s) => s.status === "UNDER_REVIEW")
                      .length
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
                <p className="text-sm text-muted-foreground">مورد اعتراض</p>
                <p className="text-2xl font-bold text-rose-800">
                  {settlements.filter((s) => s.status === "DISPUTED").length}
                </p>
              </div>
              <div className="bg-rose-800 p-2 rounded-full">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={settlements}
            searchKey="settlementNumber"
            searchPlaceholder="جستجوی شماره تسویه..."
            pageSize={10}
            onRowClick={(item) => {
              router.push(`/admin/settlements/${item.id}`);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
