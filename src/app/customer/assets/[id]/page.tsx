"use client";

import Link from "next/link";
import { getStatusLabel } from "@/lib/status-labels";
import { use, useEffect, useState } from "react";
import { ArrowRight, BarChart3, Building2, Gauge, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-client";

type Asset = {
  id: string; name: string; type: string; status: string; province: string; city: string; address: string | null;
  capacityNominal: number; capacitySellable: number; technology: string | null; gridCompany: string | null; connectionPoint: string | null;
  owner: { displayName: string }; meters: Array<{ id: string; type: string; serialNumber: string; model: string | null; readInterval: string; dataSource: string }>;
  operationalReadiness: { ready: boolean; blockers: string[] };
};

type Profile = {
  id: string; year: number; version: number; status: "DRAFT" | "REVIEW" | "APPROVED" | "SUPERSEDED";
  method: string; source: string | null; annualTotal: number; approvedAt: string | null;
  jan: number; feb: number; mar: number; apr: number; may: number; jun: number; jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
};

const months: Array<{ key: keyof Pick<Profile, "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec">; label: string }> = [
  { key: "jan", label: "فروردین" }, { key: "feb", label: "اردیبهشت" }, { key: "mar", label: "خرداد" }, { key: "apr", label: "تیر" },
  { key: "may", label: "مرداد" }, { key: "jun", label: "شهریور" }, { key: "jul", label: "مهر" }, { key: "aug", label: "آبان" },
  { key: "sep", label: "آذر" }, { key: "oct", label: "دی" }, { key: "nov", label: "بهمن" }, { key: "dec", label: "اسفند" },
];

const statusLabels = { DRAFT: "پیش‌نویس", REVIEW: "در حال بررسی", APPROVED: "تأییدشده", SUPERSEDED: "منسوخ" } as const;
const assetStatusLabels: Record<string, string> = { ACTIVE: "فعال", UNDER_CONSTRUCTION: "در حال ساخت", PLANNING: "در حال برنامه‌ریزی", INACTIVE: "غیرفعال", DECOMMISSIONED: "خارج‌شده" };

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([fetch(`/api/assets/${id}`), fetch(`/api/assets/${id}/generation-profiles?limit=100`)]).then(async ([assetResponse, profilesResponse]) => {
      const assetBody = await assetResponse.json();
      const profilesBody = await profilesResponse.json();
      if (!assetResponse.ok) throw new Error(getApiErrorMessage(assetBody, "دارایی پیدا نشد"));
      if (!profilesResponse.ok) throw new Error(getApiErrorMessage(profilesBody, "تاریخچه پیش‌بینی دریافت نشد"));
      if (active) { setAsset(assetBody); setProfiles(profilesBody); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "خطای ناشناخته"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <p className="py-12 text-center">در حال دریافت...</p>;
  if (error || !asset) return <div className="rounded-lg bg-destructive/10 p-4 text-destructive">{error || "دارایی پیدا نشد"}</div>;
  const currentProfile = profiles.find((profile) => profile.status === "APPROVED") ?? profiles[0];
  const maxMonth = currentProfile ? Math.max(...months.map(({ key }) => currentProfile[key]), 1) : 1;

  return <div className="space-y-6">
    <div className="flex items-center gap-4"><Link href="/customer/assets"><ArrowRight className="h-5 w-5" /></Link><div><div className="flex items-center gap-3"><h1 className="text-2xl font-bold">{asset.name}</h1><Badge status={asset.status}>{assetStatusLabels[asset.status] ?? getStatusLabel(asset.status)}</Badge></div><p className="text-muted-foreground">{asset.owner.displayName}</p></div></div>
    {asset.status !== "ACTIVE" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">نیروگاه هنوز آماده بهره‌برداری نیست</p><ul className="mt-2 list-inside list-disc space-y-1">{asset.operationalReadiness.blockers.filter((blocker) => blocker !== "وضعیت نیروگاه هنوز فعال نیست.").map((blocker) => <li key={blocker}>{blocker}</li>)}</ul><p className="mt-2 text-muted-foreground">پس از تکمیل موارد بالا، کارشناس فنی بهره‌برداری را تأیید می‌کند.</p></div>}
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />مشخصات دارایی</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><p>نوع: {asset.type}</p><p>فناوری: {asset.technology || "—"}</p><p>ظرفیت نامی: {asset.capacityNominal.toLocaleString()} kW</p><p>ظرفیت قابل فروش: {asset.capacitySellable.toLocaleString()} kW</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />مکان و اتصال</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><p>{asset.province}، {asset.city}</p><p>{asset.gridCompany || "—"}</p><p className="col-span-2">{asset.address || "—"}</p><p>نقطه اتصال: {asset.connectionPoint || "—"}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" />کنتورها</CardTitle></CardHeader><CardContent className="space-y-3">{asset.meters.map((meter) => <div key={meter.id} className="grid grid-cols-3 rounded border p-3"><span>{meter.type}</span><span className="font-mono">{meter.serialNumber}</span><span>{meter.dataSource}</span></div>)}</CardContent></Card>
      </div>
      <div className="space-y-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />پیش‌بینی فعال</CardTitle></CardHeader><CardContent className="space-y-3">{currentProfile ? <><div className="flex justify-between"><span>سال {currentProfile.year} · نسخه {currentProfile.version}</span><Badge status={currentProfile.status}>{statusLabels[currentProfile.status]}</Badge></div><p className="text-sm text-muted-foreground">{currentProfile.method} · {currentProfile.source || "منبع نامشخص"}</p><p className="font-medium">جمع سالانه: {currentProfile.annualTotal.toLocaleString()} kWh</p>{months.map(({ key, label }) => <div key={key} className="grid grid-cols-[70px_1fr_70px] items-center gap-2 text-xs"><span>{label}</span><div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${currentProfile[key] / maxMonth * 100}%` }} /></div><span>{currentProfile[key].toLocaleString()}</span></div>)}</> : <p className="text-muted-foreground">پیش‌بینی ثبت نشده است.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>تاریخچه نسخ‌ها</CardTitle></CardHeader><CardContent className="space-y-2">{profiles.map((profile) => <div key={profile.id} className="flex items-center justify-between rounded border p-3 text-sm"><span>{profile.year} / v{profile.version}</span><Badge status={profile.status}>{statusLabels[profile.status]}</Badge></div>)}</CardContent></Card>
      </div>
    </div>
  </div>;
}
