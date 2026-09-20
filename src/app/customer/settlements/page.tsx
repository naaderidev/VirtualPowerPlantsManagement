"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Receipt, CheckCircle2, Loader2, Search } from "lucide-react";

interface Settlement {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  energyAccepted: number;
  grossAmount: number;
  netAmount: number;
  status: string;
  createdAt: string;
  contract: {
    contractNumber: string;
    parties: Array<{ party: { displayName: string } }>;
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
  DRAFT: { label: "پیش‌نویس", variant: "secondary" },
  UNDER_REVIEW: { label: "در حال بررسی", variant: "secondary" },
  CONFIRMED: { label: "تأیید شده", variant: "default" },
  DISPUTED: { label: "مورد اعتراض", variant: "destructive" },
  ADJUSTED: { label: "اصلاح شده", variant: "secondary" },
  INVOICED: { label: "صورتحساب صادر شده", variant: "default" },
  PAID: { label: "پرداخت شده", variant: "default" },
};

export default function CustomerSettlementsPage() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetchSettlements();
  }, []);

  const fetchSettlements = async () => {
    try {
      const res = await fetch("/api/settlements");
      if (!res.ok) throw new Error("خطا در دریافت تسویه‌ها");
      const data = await res.json();
      setSettlements(Array.isArray(data) ? data : data.items || []);
    } catch {
      console.error("خطا در دریافت تسویه‌ها");
    } finally {
      setLoading(false);
    }
  };

  const filteredSettlements = settlements.filter((s) => {
    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesSearch = !search || s.settlementNumber.includes(search);
    return matchesStatus && matchesSearch;
  });

  const totalEnergy = settlements.reduce((sum, s) => sum + s.energyAccepted, 0);
  const totalAmount = settlements.reduce((sum, s) => sum + s.netAmount, 0);
  const confirmedCount = settlements.filter(
    (s) => s.status === "CONFIRMED",
  ).length;
  const paidCount = settlements.filter((s) => s.status === "PAID").length;

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
        <h1 className="text-2xl font-bold">تسویه‌های من</h1>
        <p className="text-muted-foreground">مشاهده تسویه‌های دوره‌ای</p>
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
                <Receipt className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل انرژی</p>
                <p className="text-2xl font-bold text-teal-600">
                  {(totalEnergy / 1000).toFixed(0)}{" "}
                  <span className="text-sm">ه.ک</span>
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <Receipt className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تأیید شده</p>
                <p className="text-2xl font-bold text-amber-600">
                  {confirmedCount}
                </p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">پرداخت شده</p>
                <p className="text-2xl font-bold text-pink-700">{paidCount}</p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
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
                  placeholder="جستجوی شماره تسویه..."
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
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>

        <CardContent className="">
          {filteredSettlements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              تسویه‌ای یافت نشد
            </p>
          ) : (
            <div className="space-y-3">
              {filteredSettlements.map((settlement) => (
                <div
                  key={settlement.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() =>
                    router.push(`/customer/settlements/${settlement.id}`)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-teal-600/10 flex items-center justify-center">
                      <Receipt className="h-6 w-6 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium font-mono">
                        {settlement.settlementNumber}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {settlement.asset.name} •{" "}
                        {formatPersianDate(settlement.periodStart)}{" "}
                        تا{" "}
                        {formatPersianDate(settlement.periodEnd)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="font-medium">
                        {settlement.netAmount.toLocaleString()} ریال
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {settlement.energyAccepted.toLocaleString()} kWh
                      </p>
                    </div>
                    <Badge
                      status={settlement.status}
                      variant={
                        statusConfig[settlement.status]?.variant || "secondary"
                      }
                    >
                      {statusConfig[settlement.status]?.label ||
                        getStatusLabel(settlement.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
