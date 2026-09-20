"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { GenerationProfileStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight, Zap, Building2, Calendar,
  Loader2, Settings, FileText, Send, CheckCircle2, Archive, Trash2, AlertTriangle,
} from "lucide-react";
import { canTransitionGenerationProfile } from "@/domain/assets/generation-profile-workflow";
import { getApiErrorMessage } from "@/lib/api-client";
import { isAppRole, roleIsAllowed, TECHNICAL_ROLES } from "@/lib/access-control";

interface Asset {
  id: string;
  name: string;
  type: string;
  status: string;
  province: string;
  city: string;
  address: string | null;
  capacityNominal: number;
  capacitySellable: number;
  technology: string | null;
  gridCompany: string | null;
  connectionPoint: string | null;
  operationalDate: string | null;
  connectionDate: string | null;
  archivedAt: string | null;
  archivedById: string | null;
  archiveReason: string | null;
  createdAt: string;
  owner: {
    id: string;
    displayName: string;
    type: string;
  };
  meters: Array<{
    id: string;
    type: string;
    serialNumber: string;
  }>;
  _count: {
    meters: number;
    requests: number;
    settlements: number;
  };
  disposition: {
    mode: "DELETE" | "ARCHIVE";
    totalDependencies: number;
    dependencies: Array<{ key: string; label: string; count: number }>;
  };
  blockingContracts: Array<{ id: string; contractNumber: string; status: string }>;
  operationalReadiness: { ready: boolean; blockers: string[] };
}

interface GenerationProfileVersion {
  id: string;
  year: number;
  version: number;
  method: string;
  source: string | null;
  annualTotal: number;
  confidenceLevel: string | null;
  status: GenerationProfileStatus;
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
  DECOMMISSIONED: "خارج شده",
};

const profileStatusLabels: Record<GenerationProfileStatus, string> = {
  DRAFT: "پیش‌نویس",
  REVIEW: "در انتظار بررسی فنی",
  APPROVED: "تأیید شده",
  SUPERSEDED: "جایگزین شده",
};

async function getAssetDetails(id: string): Promise<{ asset: Asset; profiles: GenerationProfileVersion[] }> {
  const [assetResponse, profilesResponse] = await Promise.all([
    fetch(`/api/assets/${id}`),
    fetch(`/api/assets/${id}/generation-profiles?limit=100`),
  ]);
  const [assetBody, profilesBody]: [unknown, unknown] = await Promise.all([
    assetResponse.json(),
    profilesResponse.json(),
  ]);
  if (!assetResponse.ok) throw new Error(getApiErrorMessage(assetBody, "خطا در بارگذاری دارایی"));
  if (!profilesResponse.ok) throw new Error(getApiErrorMessage(profilesBody, "خطا در بارگذاری پیش‌بینی تولید"));
  return { asset: assetBody as Asset, profiles: profilesBody as GenerationProfileVersion[] };
}

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [profiles, setProfiles] = useState<GenerationProfileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingProfileId, setUpdatingProfileId] = useState<string | null>(null);
  const [updatingAsset, setUpdatingAsset] = useState(false);
  const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);
  const [disposeReason, setDisposeReason] = useState("");
  const [disposingAsset, setDisposingAsset] = useState(false);

  const fetchAsset = useCallback(async () => {
    try {
      const details = await getAssetDetails(id);
      setAsset(details.asset);
      setProfiles(details.profiles);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در بارگذاری دارایی");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadAsset() {
      try {
        const details = await getAssetDetails(id);
        if (active) {
          setAsset(details.asset);
          setProfiles(details.profiles);
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "خطا در بارگذاری دارایی");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAsset();
    return () => { active = false; };
  }, [id]);

  const role = isAppRole(session?.user?.role) ? session.user.role : null;
  const canConfirmOperation = Boolean(role && roleIsAllowed(role, TECHNICAL_ROLES));
  const canDisposeAsset = role === "ADMIN" && !asset?.archivedAt;

  const disposeAsset = async () => {
    if (!asset || disposeReason.trim().length < 5) return;
    setDisposingAsset(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: disposeReason.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "حذف یا بایگانی دارایی ناموفق بود"));
      if (body.outcome === "DELETED") {
        router.push("/admin/assets");
        router.refresh();
        return;
      }
      setDisposeDialogOpen(false);
      setDisposeReason("");
      await fetchAsset();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "حذف یا بایگانی دارایی ناموفق بود");
    } finally {
      setDisposingAsset(false);
    }
  };

  const confirmOperation = async () => {
    setUpdatingAsset(true);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "تأیید بهره‌برداری ناموفق بود"));
      await fetchAsset();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "تأیید بهره‌برداری ناموفق بود");
    } finally {
      setUpdatingAsset(false);
    }
  };

  const transitionProfile = async (profile: GenerationProfileVersion, status: "REVIEW" | "APPROVED") => {
    setUpdatingProfileId(profile.id);
    setError(null);
    try {
      const response = await fetch(`/api/assets/${id}/generation-profiles/${profile.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "تغییر وضعیت پیش‌بینی تولید ناموفق بود"));
      await fetchAsset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "تغییر وضعیت پیش‌بینی تولید ناموفق بود");
    } finally {
      setUpdatingProfileId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "دارایی یافت نشد"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link href="/admin/assets" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{asset.name}</h1>
            <Badge status={asset.status} variant={asset.status === "ACTIVE" ? "default" : "secondary"}>
              {statusLabels[asset.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">جزئیات نیروگاه</p>
        </div>
        {canDisposeAsset && (
          <Button
            variant={asset.disposition.mode === "DELETE" ? "destructive" : "outline"}
            onClick={() => setDisposeDialogOpen(true)}
            disabled={asset.blockingContracts.length > 0}
            title={asset.blockingContracts.length > 0 ? "تا تعیین تکلیف قراردادهای باز، بایگانی مجاز نیست." : undefined}
          >
            {asset.disposition.mode === "DELETE" ? (
              <Trash2 className="ml-2 h-4 w-4" />
            ) : (
              <Archive className="ml-2 h-4 w-4" />
            )}
            {asset.disposition.mode === "DELETE" ? "حذف دارایی" : "بایگانی دارایی"}
          </Button>
        )}
      </div>

      {canDisposeAsset && asset.blockingContracts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="space-y-2 pt-6 text-sm text-amber-950">
            <p className="font-medium">بایگانی این دارایی فعلاً مجاز نیست.</p>
            <p>این دارایی در قرارداد باز استفاده شده است. ابتدا قراردادهای زیر را تعیین تکلیف کنید؛ بایگانی به‌تنهایی قرارداد یا تعهدات آن را فسخ نمی‌کند.</p>
            <div className="flex flex-wrap gap-2">
              {asset.blockingContracts.map((contract) => (
                <Link key={contract.id} href={`/admin/contracts/${contract.id}`} className="underline underline-offset-2">
                  {contract.contractNumber}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {asset.archivedAt && (
        <Card className="border-slate-300 bg-slate-50/80">
          <CardContent className="flex gap-3 pt-6">
            <Archive className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />
            <div className="space-y-1">
              <p className="font-medium">این دارایی در {formatPersianDate(asset.archivedAt)} بایگانی شده است.</p>
              <p className="text-sm text-muted-foreground">دلیل: {asset.archiveReason || "ثبت نشده"}</p>
              <p className="text-sm text-muted-foreground">سوابق و وابستگی‌های مالی و قراردادی آن بدون تغییر نگهداری می‌شوند.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!asset.archivedAt && asset.status !== "ACTIVE" && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader><CardTitle className="text-base">آمادگی بهره‌برداری</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {asset.operationalReadiness.blockers.length > 0 && <ul className="list-inside list-disc space-y-1 text-amber-900">{asset.operationalReadiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
            {canConfirmOperation && <Button onClick={confirmOperation} disabled={updatingAsset || asset.operationalReadiness.blockers.some((blocker) => blocker !== "وضعیت نیروگاه هنوز فعال نیست.")}>
              {updatingAsset ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}
              تأیید بهره‌برداری و فعال‌کردن نیروگاه
            </Button>}
            {asset.operationalReadiness.blockers.length > 1 && <p className="text-muted-foreground">پس از رفع همه موارد بالا، دکمه تأیید فعال می‌شود.</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                اطلاعات نیروگاه
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">نوع نیروگاه</p>
                  <p className="font-medium">{typeLabels[asset.type]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ظرفیت نامی</p>
                  <p className="font-medium">{asset.capacityNominal.toLocaleString()} kW</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ظرفیت قابل فروش</p>
                  <p className="font-medium">{asset.capacitySellable.toLocaleString()} kW</p>
                </div>
                {asset.technology && (
                  <div>
                    <p className="text-sm text-muted-foreground">تکنولوژی</p>
                    <p className="font-medium">{asset.technology}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">استان</p>
                  <p className="font-medium">{asset.province}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">شهر</p>
                  <p className="font-medium">{asset.city}</p>
                </div>
                {asset.address && (
                  <div>
                    <p className="text-sm text-muted-foreground">آدرس</p>
                    <p className="font-medium">{asset.address}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                پیش‌بینی تولید
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">هنوز پیش‌بینی تولیدی ثبت نشده است.</p>
              ) : (
                <div className="space-y-3">
                  {profiles.map((profile) => {
                    const canSubmit = role && canTransitionGenerationProfile(profile.status, "REVIEW", role);
                    const canApprove = role && canTransitionGenerationProfile(profile.status, "APPROVED", role);
                    return (
                      <div key={profile.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">سال {profile.year} — نسخه {profile.version}</p>
                            <Badge status={profile.status} variant={profile.status === "APPROVED" ? "default" : "secondary"}>
                              {profileStatusLabels[profile.status]}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {profile.method} · مجموع سالانه {profile.annualTotal.toLocaleString()} کیلووات‌ساعت
                          </p>
                        </div>
                        {(canSubmit || canApprove) && (
                          <Button
                            size="sm"
                            disabled={updatingProfileId !== null}
                            onClick={() => transitionProfile(profile, canApprove ? "APPROVED" : "REVIEW")}
                          >
                            {updatingProfileId === profile.id ? (
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            ) : canApprove ? (
                              <CheckCircle2 className="ml-2 h-4 w-4" />
                            ) : (
                              <Send className="ml-2 h-4 w-4" />
                            )}
                            {canApprove ? "تأیید پیش‌بینی" : "ارسال برای بررسی"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                اطلاعات فنی
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                {asset.gridCompany && (
                  <div>
                    <p className="text-sm text-muted-foreground">شرکت برق منطقه‌ای</p>
                    <p className="font-medium">{asset.gridCompany}</p>
                  </div>
                )}
                {asset.connectionPoint && (
                  <div>
                    <p className="text-sm text-muted-foreground">نقطه اتصال</p>
                    <p className="font-medium">{asset.connectionPoint}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {asset.operationalDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">تاریخ بهره‌برداری</p>
                    <p className="font-medium">
                      {formatPersianDate(asset.operationalDate)}
                    </p>
                  </div>
                )}
                {asset.connectionDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">تاریخ اتصال</p>
                    <p className="font-medium">
                      {formatPersianDate(asset.connectionDate)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                کنتورها ({asset.meters.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {asset.meters.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  هنوز کنتوری ثبت نشده
                </p>
              ) : (
                <div className="space-y-2">
                  {asset.meters.map((meter) => (
                    <div key={meter.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{meter.serialNumber}</p>
                        <p className="text-sm text-muted-foreground">{meter.type}</p>
                      </div>
                      <Badge status="ACTIVE">فعال</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">مالک نیروگاه</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{asset.owner.displayName}</p>
                  <p className="text-sm text-muted-foreground">
                    {asset.owner.type === "PERSON" ? "شخص حقیقی" : "شخص حقوقی"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">آمار</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">تعداد کنتور</span>
                <span className="font-medium">{asset._count.meters}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">تعداد درخواست</span>
                <span className="font-medium">{asset._count.requests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">تعداد تسویه</span>
                <span className="font-medium">{asset._count.settlements}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={disposeDialogOpen} onOpenChange={(open) => !disposingAsset && setDisposeDialogOpen(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {asset.disposition.mode === "DELETE" ? (
                <Trash2 className="h-5 w-5 text-destructive" />
              ) : (
                <Archive className="h-5 w-5 text-amber-600" />
              )}
              {asset.disposition.mode === "DELETE" ? "حذف دائمی دارایی" : "بایگانی دارایی وابسته"}
            </DialogTitle>
            <DialogDescription>
              {asset.disposition.mode === "DELETE"
                ? "این دارایی هیچ وابستگی ثبت‌شده‌ای ندارد و پس از تأیید به‌صورت دائمی حذف می‌شود. این عملیات قابل بازگشت نیست."
                : "این دارایی دارای سابقه است؛ بنابراین حذف نمی‌شود و برای حفظ سوابق قرارداد، تسویه و ممیزی بایگانی خواهد شد."}
            </DialogDescription>
          </DialogHeader>

          {asset.disposition.mode === "ARCHIVE" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                {asset.disposition.totalDependencies.toLocaleString("fa-IR")} وابستگی شناسایی شد
              </div>
              <div className="flex flex-wrap gap-2">
                {asset.disposition.dependencies.map((dependency) => (
                  <Badge key={dependency.key} variant="outline" className="bg-background">
                    {dependency.label}: {dependency.count.toLocaleString("fa-IR")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="asset-dispose-reason">دلیل {asset.disposition.mode === "DELETE" ? "حذف" : "بایگانی"}</Label>
            <Textarea
              id="asset-dispose-reason"
              value={disposeReason}
              onChange={(event) => setDisposeReason(event.target.value)}
              placeholder="دلیل تصمیم را برای ثبت در تاریخچه بنویسید..."
              maxLength={500}
              rows={4}
              aria-invalid={disposeReason.length > 0 && disposeReason.trim().length < 5}
            />
            <p className="text-xs text-muted-foreground">حداقل ۵ و حداکثر ۵۰۰ نویسه؛ این متن در لاگ ممیزی ثبت می‌شود.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={disposingAsset} onClick={() => setDisposeDialogOpen(false)}>
              انصراف
            </Button>
            <Button
              variant={asset.disposition.mode === "DELETE" ? "destructive" : "default"}
              disabled={disposingAsset || disposeReason.trim().length < 5}
              onClick={disposeAsset}
            >
              {disposingAsset && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {asset.disposition.mode === "DELETE" ? "حذف دائمی" : "تأیید بایگانی"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
