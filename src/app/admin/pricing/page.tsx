"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { PricingStatus } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, TrendingUp, BarChart3, Plus, Loader2, Send, CheckCircle2, Power, Undo2, Archive } from "lucide-react";
import { RoleGate } from "@/components/shared/role-gate";
import { SUPPLY_ROLES, isAppRole } from "@/lib/access-control";
import { canTransitionPricingPlan } from "@/domain/pricing/workflow";
import { getApiErrorMessage } from "@/lib/api-client";

interface PricingPlan {
  id: string;
  name: string;
  code: string;
  model: string;
  fixedRate: number | null;
  currency: string;
  validFrom: string;
  validTo: string | null;
  status: PricingStatus;
  versionNote: string | null;
}

type DeprecationPreview = {
  canDeprecate: boolean;
  blockingCount: number;
  blockingContracts: Array<{ id: string; number: string }>;
};

const modelLabels: Record<string, string> = {
  FIXED: "قیمت ثابت",
  MARKET_INDEX: "شاخص بازار",
  HYBRID: "ترکیبی",
  FLOOR: "کف قیمت",
};

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  REVIEW: "در انتظار بررسی",
  APPROVED: "تأیید شده",
  ACTIVE: "فعال",
  DEPRECATED: "منسوخ شده",
};

const transitionLabels: Partial<Record<PricingStatus, { label: string; icon: typeof Send }>> = {
  REVIEW: { label: "ارسال برای بررسی", icon: Send },
  APPROVED: { label: "تأیید نرخ‌نامه", icon: CheckCircle2 },
  ACTIVE: { label: "فعال‌سازی", icon: Power },
  DRAFT: { label: "بازگشت به پیش‌نویس", icon: Undo2 },
  DEPRECATED: { label: "منسوخ کردن", icon: Archive },
};

const nextStatuses: Partial<Record<PricingStatus, readonly PricingStatus[]>> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ACTIVE"],
  ACTIVE: ["DEPRECATED"],
};

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deprecationTarget, setDeprecationTarget] = useState<PricingPlan | null>(null);
  const [deprecationPreview, setDeprecationPreview] = useState<DeprecationPreview | null>(null);
  const [deprecationReason, setDeprecationReason] = useState("");
  const [deprecationError, setDeprecationError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      const response = await fetch("/api/pricing-rules");
      if (!response.ok) throw new Error("خطا در دریافت طرح‌ها");
      const data = await response.json();
      setPlans(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در دریافت طرح‌ها");
    } finally {
      setIsLoading(false);
    }
  }

  const role = isAppRole(session?.user?.role) ? session.user.role : null;

  const transitionPlan = async (plan: PricingPlan, status: PricingStatus, notes?: string) => {
    setUpdatingId(plan.id);
    setError("");
    try {
      const response = await fetch(`/api/pricing-rules/${plan.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(notes && { notes }) }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "تغییر وضعیت نرخ‌نامه ناموفق بود"));
      await fetchPlans();
      if (status === "DEPRECATED") setDeprecationTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "تغییر وضعیت نرخ‌نامه ناموفق بود";
      if (status === "DEPRECATED") setDeprecationError(message);
      else setError(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const previewDeprecation = async (plan: PricingPlan) => {
    setDeprecationTarget(plan);
    setDeprecationPreview(null);
    setDeprecationReason("");
    setDeprecationError("");
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/pricing-rules/${plan.id}/status`);
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "بررسی وابستگی نرخ‌نامه ناموفق بود"));
      setDeprecationPreview(body as DeprecationPreview);
    } catch (err: unknown) {
      setDeprecationError(err instanceof Error ? err.message : "بررسی وابستگی نرخ‌نامه ناموفق بود");
    } finally {
      setPreviewLoading(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "نام",
      render: (item: PricingPlan) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.code}</p>
        </div>
      ),
    },
    {
      key: "model",
      header: "مدل",
      render: (item: PricingPlan) => (
        <Badge variant="secondary">
          {modelLabels[item.model] || item.model}
        </Badge>
      ),
    },
    {
      key: "fixedRate",
      header: "نرخ",
      render: (item: PricingPlan) => (
        <span className="font-mono">
          {item.fixedRate?.toLocaleString() || "-"} {item.currency}
        </span>
      ),
    },
    {
      key: "validFrom",
      header: "تاریخ شروع",
      render: (item: PricingPlan) => (
        <span>{formatPersianDate(item.validFrom)}</span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: PricingPlan) => (
        <Badge status={item.status} variant={item.status === "ACTIVE" ? "default" : "secondary"}>
          {statusLabels[item.status] || getStatusLabel(item.status)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "عملیات",
      render: (item: PricingPlan) => {
        const allowedStatuses = role
          ? (nextStatuses[item.status] ?? []).filter((status) => canTransitionPricingPlan(item.status, status, role))
          : [];
        if (allowedStatuses.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap justify-center gap-2">
            {allowedStatuses.map((status) => {
              const action = transitionLabels[status];
              if (!action) return null;
              const Icon = action.icon;
              return (
                <Button
                  key={status}
                  size="sm"
                  variant={status === "DRAFT" || status === "DEPRECATED" ? "outline" : "default"}
                  disabled={updatingId !== null}
                  onClick={() => status === "DEPRECATED" ? previewDeprecation(item) : transitionPlan(item, status)}
                >
                  {updatingId === item.id ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Icon className="ml-2 h-4 w-4" />}
                  {action.label}
                </Button>
              );
            })}
          </div>
        );
      },
    },
  ];

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
          <h1 className="text-2xl font-bold">قیمت‌گذاری</h1>
          <p className="text-muted-foreground">
            مدیریت طرح‌های قیمت‌گذاری و تعرفه‌ها
          </p>
        </div>
        <RoleGate allowedRoles={SUPPLY_ROLES}><Button onClick={() => router.push("/admin/pricing/new")}>
          <Plus className="h-4 w-4 ml-2" />
          طرح جدید
        </Button></RoleGate>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      <Dialog open={deprecationTarget !== null} onOpenChange={(open) => { if (!open) setDeprecationTarget(null); }}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>منسوخ‌سازی نرخ‌نامهٔ {deprecationTarget?.name}</DialogTitle>
            <DialogDescription>
              نسخهٔ منسوخ برای قراردادهای جدید قابل انتخاب نیست؛ سوابق تسویه و اسناد مالی قبلی محفوظ می‌مانند.
            </DialogDescription>
          </DialogHeader>
          {previewLoading && <p className="text-sm text-muted-foreground">در حال بررسی قراردادهای وابسته…</p>}
          {deprecationPreview && !deprecationPreview.canDeprecate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p>این نرخ‌نامه هنوز در برنامهٔ تجاریِ دارای دورهٔ باز یا آتی استفاده می‌شود و فعلاً قابل منسوخ‌سازی نیست.</p>
              <p className="mt-2">قراردادهای وابسته: {deprecationPreview.blockingContracts.map(({ number }) => number).join("، ")}{deprecationPreview.blockingCount > 10 && ` و ${deprecationPreview.blockingCount - 10} قرارداد دیگر`}</p>
              <p className="mt-2">تا پایان تعهد این قراردادها یا اعمال اصلاحیهٔ جایگزین، منسوخ‌سازی مجاز نیست.</p>
            </div>
          )}
          {deprecationPreview?.canDeprecate && (
            <div className="space-y-2">
              <label htmlFor="pricing-deprecation-reason" className="text-sm font-medium">دلیل منسوخ‌سازی</label>
              <Textarea id="pricing-deprecation-reason" maxLength={500} value={deprecationReason} onChange={(event) => setDeprecationReason(event.target.value)} placeholder="دلیل منسوخ‌کردن این نسخه را ثبت کنید" />
            </div>
          )}
          {deprecationError && <p role="alert" className="text-sm text-destructive">{deprecationError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeprecationTarget(null)}>انصراف</Button>
            {deprecationPreview?.canDeprecate && deprecationTarget && (
              <Button variant="destructive" disabled={!deprecationReason.trim() || updatingId !== null} onClick={() => transitionPlan(deprecationTarget, "DEPRECATED", deprecationReason.trim())}>
                {updatingId === deprecationTarget.id && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                منسوخ کردن
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل طرح‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {plans.length}
                </p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <DollarSign className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">طرح‌های فعال</p>
                <p className="text-2xl font-bold text-teal-600">
                  {plans.filter((p) => p.status === "ACTIVE").length}
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">میانگین نرخ</p>
                <p className="text-2xl font-bold text-pink-700">
                  {plans.filter((p) => p.fixedRate).length > 0
                    ? Math.round(
                        plans
                          .filter((p) => p.fixedRate)
                          .reduce((sum, p) => sum + (p.fixedRate || 0), 0) /
                          plans.filter((p) => p.fixedRate).length,
                      ).toLocaleString()
                    : 0}{" "}
                  <span className="text-sm">ریال</span>
                </p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <BarChart3 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
      <Card>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={plans}
            searchKey="name"
            searchPlaceholder="جستجوی نام طرح..."
            pageSize={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}
