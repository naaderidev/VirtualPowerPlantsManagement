"use client";

import { formatPersianDate, formatPersianDateTime } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { use, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import type { ContractStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ContractTimeline } from "@/components/shared/contract-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowRight,
  FileText,
  Building2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Send,
  Loader2,
  FileSignature,
  Settings,
  AlertTriangle,
  History,
  Landmark,
} from "lucide-react";
import { CONTRACT_SIGN_ROLES, CONTRACT_WRITE_ROLES, SUPPLY_ROLES, isAppRole, roleIsAllowed } from "@/lib/access-control";
import { canEditContractConfiguration, canRoleTransitionContract } from "@/domain/contracts/workflow";
import { currentTerminationBoundary, nextTerminationBoundary } from "@/domain/contracts/termination";
import { getApiErrorMessage } from "@/lib/api-client";

interface Contract {
  id: string;
  contractNumber: string;
  type: string;
  status: string;
  version: number;
  effectiveDate: string;
  expirationDate: string | null;
  terminationDate: string | null;
  volumeType: string | null;
  settlementCycle: string | null;
  paymentDueDays: number | null;
  nettingEnabled: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  parties: Array<{
    id: string;
    role: string;
    isPrimary: boolean;
    party: {
      id: string;
      displayName: string;
      type: string;
      nationalId: string | null;
      phone: string | null;
      email: string | null;
    };
  }>;
  assets: Array<{
    id: string;
    sharePercent: number | null;
    asset: {
      id: string;
      name: string;
      type: string;
      capacityNominal: number;
      capacitySellable: number;
      status: string;
      operationalDate: string | null;
      connectionStatus: string | null;
      province: string;
      city: string;
    };
  }>;
  requests: Array<{ id: string; assetId: string | null; createdAt: string }>;
  schedules: Array<{
    id: string;
    assetId: string;
    name: string | null;
    volumeType: string;
    minVolume: number | null;
    maxVolume: number | null;
    pricingPlan: { name: string; code: string; model: string };
    asset: { name: string };
  }>;
  settlements: Array<{
    id: string;
    settlementNumber: string;
    grossAmount: number;
    status: string;
    createdAt: string;
  }>;
  amendments: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
  reviews: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    notes: string | null;
    reviewer: {
      id: string;
      name: string;
      role: string;
    } | null;
    createdAt: string;
  }>;
  signatures: Array<{ partyId: string; signedAt: string }>;
  _count: {
    settlements: number;
    amendments: number;
  };
  activationReadiness: { ready: boolean; blockers: string[]; awaitingOperation: boolean } | null;
}

const typeLabels: Record<string, string> = {
  PPA: "قرارداد خرید تضمینی",
  SPOT: "بازار نقدی",
  FORWARD: "بازار آتی",
};

const roleLabels: Record<string, string> = {
  SELLER: "فروشنده",
  BUYER: "خریدار",
  SIGNATORY: "امضاکننده مجاز",
  GUARANTOR: "ضامن",
};

function pricingModelLabel(model: string): string {
  if (model === "FIXED") return "قیمت ثابت";
  if (model === "MARKET_INDEX") return "شاخص بازار";
  if (model === "HYBRID") return "ترکیبی";
  if (model === "FLOOR") return "قیمت کف";
  return "مدل قیمت نامشخص";
}

function assetOrder(contract: Contract): Map<string | null, number> {
  return new Map(contract.requests.map(({ assetId }, index) => [assetId, index]));
}

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

const settlementStatusLabels: Record<string, string> = {
  CALCULATED: "محاسبه شده",
  DRAFT: "پیش‌نویس",
  UNDER_REVIEW: "در حال بررسی",
  CONFIRMED: "تأیید شده",
  DISPUTED: "مورد اعتراض",
  ADJUSTED: "اصلاح شده",
  INVOICED: "صورتحساب صادر شده",
  PAID: "پرداخت شده",
};

export default function ContractDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [isUpdating, setIsUpdating] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [terminationReason, setTerminationReason] = useState("");
  const [terminationError, setTerminationError] = useState("");

  useEffect(() => {
    fetchContract();
  }, [id]);

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${id}`);
      if (!response.ok) throw new Error("خطا در دریافت قرارداد");
      const data = await response.json();
      setContract(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ContractStatus, note: string): Promise<boolean> => {
    if (!contract) return false;
    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: note.trim() || undefined }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(body, "خطا در بروزرسانی وضعیت"));
      await fetchContract();
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReviewStatusChange = async (status: ContractStatus) => {
    if (await handleStatusChange(status, reviewNote)) setReviewNote("");
  };

  const handleTerminationDecision = async (status: "TERMINATION_PENDING" | "TERMINATED" | "ACTIVE") => {
    const reason = terminationReason.trim();
    if (!reason) {
      setTerminationError("برای این تصمیم ابتدا دلیل را در کادر زیر بنویسید.");
      return;
    }
    setTerminationError("");
    if (status === "TERMINATED" && !window.confirm("فسخ نهایی قرارداد ثبت شود؟ این تصمیم از همین دوره به بعد تولید و تسویه جدید را متوقف می‌کند.")) return;
    if (await handleStatusChange(status, reason)) setTerminationReason("");
  };

  const handleAddNote = async () => {
    if (!contract || !reviewNote.trim()) return;
    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: reviewNote.trim(), action: "NOTE" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "خطا در ذخیره یادداشت");
      await fetchContract();
      setReviewNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBuyerSignature = async () => {
    const buyer = contract?.parties.find((party) => party.role === "BUYER" && party.isPrimary);
    if (!buyer) return;
    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts/${id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: buyer.party.id, evidenceReference: "BARTOO_INTERNAL_APPROVAL" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "ثبت امضای خریدار ناموفق بود.");
      await fetchContract();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "قرارداد یافت نشد"}
      </div>
    );
  }

  const role = isAppRole(session?.user?.role) ? session.user.role : null;
  const canTransitionTo = (status: ContractStatus) =>
    Boolean(role && canRoleTransitionContract(contract.status as ContractStatus, status, role));
  const canConfigure = Boolean(role && roleIsAllowed(role, SUPPLY_ROLES));
  const canEditConfiguration = canConfigure && canEditContractConfiguration(contract.status as ContractStatus);
  const canWriteContract = Boolean(role && roleIsAllowed(role, CONTRACT_WRITE_ROLES));
  const canSignBuyer = Boolean(role && roleIsAllowed(role, CONTRACT_SIGN_ROLES));
  const latestChangeRequest = contract.status === "NEEDS_CHANGES"
    ? contract.reviews.find(({ toStatus }) => toStatus === "NEEDS_CHANGES")
    : null;
  const hasActions =
    canEditConfiguration ||
    canTransitionTo("INTERNAL_REVIEW") ||
    canTransitionTo("PENDING_SIGNATURE") ||
    canTransitionTo("NEEDS_CHANGES") ||
    canTransitionTo("ACTIVE") ||
    (contract.status === "PENDING_SIGNATURE" && canSignBuyer);
  const canTerminate = canTransitionTo("TERMINATION_PENDING");
  const canDecideTermination = contract.status === "TERMINATION_PENDING" && canTransitionTo("TERMINATED");
  const canFinalizeTerminationNow = Boolean(currentTerminationBoundary(new Date()));
  const requestAssetOrder = assetOrder(contract);
  const orderedContractAssets = [...contract.assets].sort(
    (left, right) =>
      (requestAssetOrder.get(left.asset.id) ?? Number.MAX_SAFE_INTEGER) -
      (requestAssetOrder.get(right.asset.id) ?? Number.MAX_SAFE_INTEGER)
  );
  const orderedSchedules = [...contract.schedules].sort(
    (left, right) =>
      (requestAssetOrder.get(left.assetId) ?? Number.MAX_SAFE_INTEGER) -
      (requestAssetOrder.get(right.assetId) ?? Number.MAX_SAFE_INTEGER)
  );

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive" role="alert">{error}</div>}
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/contracts" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contract.contractNumber}</h1>
            <StatusBadge
              status={contract.status as any}
              type="contract"
              className={`${contract.status === "ACTIVE" ? "bg-teal-600 text-white" : "bg-amber-500 text-white"}`}
            />
          </div>
          <p className="text-muted-foreground">
            جزئیات قرارداد فروش برق &middot; ثبت شده در {formatPersianDate(contract.createdAt)}
          </p>
        </div>
      </div>

      {contract.status === "SIGNED" && !contract.activationReadiness?.ready && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">امضاشده، در انتظار بهره‌برداری یا رفع محدودیت فروش</p>
          <ul className="mt-2 list-inside list-disc space-y-1">{contract.activationReadiness?.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
          <p className="mt-2 text-muted-foreground">پس از رفع همه موارد، فعال‌سازی قرارداد امکان‌پذیر می‌شود.</p>
        </div>
      )}

      {contract.status === "NEEDS_CHANGES" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
          <p className="font-semibold">قرارداد برای اصلاح بازگردانده شده است</p>
          {latestChangeRequest?.notes && <p className="mt-2 whitespace-pre-wrap">نظر بررسی‌کننده: {latestChangeRequest.notes}</p>}
          <p className="mt-2">کارشناس تأمین می‌تواند پیکربندی را اصلاح و ذخیره کند، سپس قرارداد را دوباره برای بررسی حقوقی بفرستد.</p>
        </div>
      )}

      {contract.status === "TERMINATION_PENDING" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
          درخواست فسخ ثبت شده است، اما قرارداد تا تصمیم نهایی برای قرائت و تسویهٔ دوره‌های جاری عملیاتی می‌ماند.
        </div>
      )}
      {contract.status === "TERMINATED" && contract.terminationDate && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950" role="status">
          قرارداد از {formatPersianDate(contract.terminationDate)} فسخ شده است. تسویهٔ دوره‌های کامل پیش از این تاریخ همچنان قابل ثبت است.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
              <TabsTrigger value="overview">اطلاعات</TabsTrigger>
              <TabsTrigger value="party">طرف قرارداد</TabsTrigger>
              <TabsTrigger value="schedules">برنامه‌های تجاری</TabsTrigger>
              <TabsTrigger value="settlements">تسویه‌ها</TabsTrigger>
              <TabsTrigger value="history">تاریخچه</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    اطلاعات قرارداد
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">شماره قرارداد</p>
                      <p className="font-medium font-mono">{contract.contractNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">نوع قرارداد</p>
                      <p className="font-medium">{typeLabels[contract.type] || contract.type}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">تاریخ شروع</p>
                      <p className="font-medium">{formatPersianDate(contract.effectiveDate)}</p>
                    </div>
                    {contract.expirationDate && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">تاریخ پایان</p>
                        <p className="font-medium">{formatPersianDate(contract.expirationDate)}</p>
                      </div>
                    )}
                    {contract.volumeType && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">نوع حجم</p>
                        <p className="font-medium">{contract.volumeType}</p>
                      </div>
                    )}
                    {contract.settlementCycle && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">چرخه تسویه</p>
                        <p className="font-medium">{contract.settlementCycle}</p>
                      </div>
                    )}
                    {contract.paymentDueDays && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">مهلت پرداخت</p>
                        <p className="font-medium">{contract.paymentDueDays} روز</p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">تسویه خالص</p>
                      <p className="font-medium">{contract.nettingEnabled ? "فعال" : "غیرفعال"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">نسخه</p>
                      <p className="font-medium">{contract.version}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">تعداد تسویه‌ها</p>
                      <p className="font-medium">{contract._count.settlements}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {contract.assets.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className="bg-teal-600 p-2 rounded-full">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      نیروگاه‌های قرارداد
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      {orderedContractAssets.map(({ id: contractAssetId, asset, sharePercent }, index) => (
                        <div key={contractAssetId} className="rounded-lg border p-4">
                          <p className="font-medium">نیروگاه {index + 1}: {asset.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {assetTypeLabels[asset.type] || asset.type} • {asset.capacityNominal.toLocaleString()} کیلووات
                          </p>
                          <p className="text-sm text-muted-foreground">{asset.province} - {asset.city} • سهم {sharePercent ?? "—"}٪</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="schedules">
              <Card>
                <CardHeader><CardTitle>برنامه‌های تجاری مستقل</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  {orderedSchedules.length === 0 ? (
                    <p className="text-muted-foreground">هنوز برنامه تجاری ثبت نشده است.</p>
                  ) : orderedSchedules.map((schedule, index) => (
                    <div key={schedule.id} className="rounded-lg border p-4">
                      <p className="font-medium">نیروگاه {index + 1}: {schedule.asset.name}</p>
                      <Badge className="mt-2" variant="secondary">
                        {pricingModelLabel(schedule.pricingPlan.model)}
                      </Badge>
                      <p className="mt-2 text-sm">{schedule.pricingPlan.name} ({schedule.pricingPlan.code})</p>
                      <p className="text-sm text-muted-foreground">نوع حجم: {schedule.volumeType} • حداقل: {schedule.minVolume ?? "—"} • حداکثر: {schedule.maxVolume ?? "—"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Party Tab */}
            <TabsContent value="party">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    طرف قرارداد
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contract.parties.map((cp) => (
                    <div key={cp.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{roleLabels[cp.role] || "نقش نامشخص"}</Badge>
                        {cp.isPrimary && <Badge variant="default">اصلی</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">نام</p>
                          <p className="font-medium">{cp.party.displayName}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">نوع</p>
                          <p className="font-medium">{cp.party.type === "PERSON" ? "شخص حقیقی" : "شخص حقوقی"}</p>
                        </div>
                        {cp.party.nationalId && (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              {cp.party.type === "PERSON" ? "کد ملی" : "شناسه ملی"}
                            </p>
                            <p className="font-medium font-mono">{cp.party.nationalId}</p>
                          </div>
                        )}
                        {cp.party.phone && (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">تلفن</p>
                            <p className="font-medium">{cp.party.phone}</p>
                          </div>
                        )}
                        {cp.party.email && (
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">ایمیل</p>
                            <p className="font-medium">{cp.party.email}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settlements Tab */}
            <TabsContent value="settlements">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <Landmark className="h-5 w-5 text-white" />
                    </div>
                    تسویه‌ها
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contract.settlements.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      هنوز تسویه‌ای ثبت نشده است
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {contract.settlements.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium font-mono">{s.settlementNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatPersianDate(s.createdAt)}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{s.grossAmount.toLocaleString()} ریال</p>
                            <Badge status={s.status} variant={s.status === "PAID" ? "default" : "secondary"}>
                              {settlementStatusLabels[s.status] || getStatusLabel(s.status)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    تاریخچه تغییرات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contract.reviews.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      هنوز تغییراتی ثبت نشده است
                    </p>
                  ) : (
                    contract.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {review.reviewer?.name || "سیستم"}
                            </Badge>
                            {review.action === "NOTE" ? (
                              <Badge variant="outline" className="text-xs">
                                <MessageSquare className="h-3 w-3 ml-1" />
                                یادداشت
                              </Badge>
                            ) : review.toStatus ? (
                              <StatusBadge status={review.toStatus as any} type="contract" />
                            ) : null}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatPersianDateTime(review.createdAt)}
                          </span>
                        </div>
                        {review.fromStatus && review.toStatus && (
                          <div className="text-sm text-muted-foreground">
                            <StatusBadge status={review.fromStatus as any} type="contract" />
                            <span className="mx-1">→</span>
                            <StatusBadge status={review.toStatus as any} type="contract" />
                          </div>
                        )}
                        {review.notes && (
                          <p className="text-sm text-muted-foreground">
                            {review.notes}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex items-start w-full gap-4">
            {/* Review Note */}
            {canWriteContract && <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-sm">یادداشت بررسی</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Textarea
                    placeholder="یادداشت خود را اینجا بنویسید..."
                    value={reviewNote}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setReviewNote(e.target.value);
                      }
                    }}
                    rows={3}
                    maxLength={500}
                  />
                  <span className={`absolute bottom-2 left-2 text-xs ${reviewNote.length >= 450 ? "text-destructive" : "text-muted-foreground"}`}>
                    {reviewNote.length}/500
                  </span>
                </div>
                <Button
                  className="w-full"
                  onClick={handleAddNote}
                  disabled={isUpdating || !reviewNote.trim()}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4 ml-2" />
                  )}
                  ثبت یادداشت
                </Button>
              </CardContent>
            </Card>}

            {/* Actions */}
            {hasActions && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-sm">عملیات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {canEditConfiguration && (
                    <Button
                      className="w-full justify-start"
                      onClick={() => router.push(`/admin/contracts/${id}/configure`)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Settings className="h-4 w-4 ml-2" />}
                      {contract.status === "NEEDS_CHANGES" ? "اصلاح پیکربندی قرارداد" : contract.status === "CONFIGURED" ? "ویرایش پیکربندی قرارداد" : "پیکربندی قرارداد"}
                    </Button>
                  )}
                  {contract.status === "CONFIGURED" && canTransitionTo("INTERNAL_REVIEW") && (
                    <Button
                      className="w-full justify-start"
                      onClick={() => void handleReviewStatusChange("INTERNAL_REVIEW")}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                      ارسال برای بررسی
                    </Button>
                  )}
                  {contract.status === "INTERNAL_REVIEW" && (
                    <>
                      {canTransitionTo("PENDING_SIGNATURE") && <Button
                        className="w-full justify-start"
                        onClick={() => void handleReviewStatusChange("PENDING_SIGNATURE")}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                        تأیید بررسی
                      </Button>}
                      {canTransitionTo("NEEDS_CHANGES") && <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => void handleReviewStatusChange("NEEDS_CHANGES")}
                        disabled={isUpdating}
                      >
                        <XCircle className="h-4 w-4 ml-2" />
                        درخواست تغییرات
                      </Button>}
                    </>
                  )}
                  {contract.status === "SIGNED" && canTransitionTo("ACTIVE") && (
                    <Button
                      className="w-full justify-start"
                      onClick={() => void handleReviewStatusChange("ACTIVE")}
                      disabled={isUpdating || !contract.activationReadiness?.ready}
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                      فعالسازی قرارداد
                    </Button>
                  )}
                  {contract.status === "PENDING_SIGNATURE" && canSignBuyer && !contract.signatures.some(({ partyId }) => partyId === contract.parties.find(({ role }) => role === "BUYER")?.party.id) && (
                    <Button className="w-full justify-start" onClick={handleBuyerSignature} disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <FileSignature className="h-4 w-4 ml-2" />}
                      ثبت امضای خریدار برقتو
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {(canTerminate || canDecideTermination) && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-sm">{canTerminate ? "درخواست فسخ قرارداد" : "تصمیم دربارهٔ درخواست فسخ"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label htmlFor="termination-reason" className="block text-sm font-medium">
                    {canTerminate ? "دلیل درخواست فسخ" : "دلیل تصمیم نهایی"} *
                  </label>
                  <Textarea
                    id="termination-reason"
                    value={terminationReason}
                    onChange={(event) => {
                      setTerminationReason(event.target.value);
                      setTerminationError("");
                    }}
                    maxLength={500}
                    rows={3}
                    placeholder="دلیل مستند این تصمیم را بنویسید..."
                    aria-invalid={Boolean(terminationError)}
                    aria-describedby={terminationError ? "termination-reason-error" : undefined}
                  />
                  {terminationError && <p id="termination-reason-error" className="text-sm text-destructive" role="alert">{terminationError}</p>}
                  <p className="text-xs text-muted-foreground">این متن همراه تصمیم در تاریخچه قرارداد ثبت می‌شود؛ نیازی به زدن «ثبت یادداشت» نیست.</p>
                  {canTerminate ? (
                    <Button
                      variant="destructive"
                      className="w-full justify-start"
                      onClick={() => void handleTerminationDecision("TERMINATION_PENDING")}
                      disabled={isUpdating}
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 ml-2" />}
                      ثبت درخواست فسخ
                    </Button>
                  ) : (
                    <>
                      {!canFinalizeTerminationNow && <p className="text-xs text-amber-800">برای جلوگیری از قطع دورهٔ تسویه، فسخ نهایی فقط روز اول ماه شمسی ممکن است. تاریخ مجاز بعدی: {nextTerminationBoundary(new Date())}.</p>}
                      <Button
                        variant="destructive"
                        className="w-full justify-start"
                        onClick={() => void handleTerminationDecision("TERMINATED")}
                        disabled={isUpdating || !canFinalizeTerminationNow}
                      >
                        تأیید و ثبت فسخ نهایی
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => void handleTerminationDecision("ACTIVE")}
                        disabled={isUpdating}
                      >
                        رد درخواست فسخ و بازگشت به فعال
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Workflow Timeline */}
          <Card>
            <CardContent className="">
              <ContractTimeline currentStatus={contract.status as any} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
