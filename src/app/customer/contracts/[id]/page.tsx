"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContractStatusBadge } from "@/components/shared/status-badge";

type Contract = {
  id: string;
  contractNumber: string;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  terminationDate: string | null;
  signedAt: string | null;
  parties: Array<{ partyId: string; role: string; party: { displayName: string } }>;
  assets: Array<{ asset: { name: string; capacityNominal: number } }>;
  requests: Array<{ id: string; assetId: string | null; createdAt: string }>;
  schedules: Array<{
    id: string;
    assetId: string;
    volumeType: string;
    minVolume: number | null;
    maxVolume: number | null;
    asset: { name: string };
    pricingPlan: { name: string; code: string; model: string };
  }>;
  meteringAnnex: { primarySource: string; missingDataPolicy: string; disputeDeadline: number | null } | null;
  signatures: Array<{ partyId: string; signedAt: string }>;
  reviews: Array<{ toStatus: string | null; notes: string | null }>;
};

function pricingModelLabel(model: string): string {
  if (model === "FIXED") return "قیمت ثابت";
  if (model === "MARKET_INDEX") return "شاخص بازار";
  return model;
}

export default function CustomerContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");

  async function loadContract() {
    const response = await fetch(`/api/contracts/${id}`);
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message ?? "دریافت قرارداد ناموفق بود.");
    setContract(body);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contracts/${id}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error?.message ?? "دریافت قرارداد ناموفق بود.");
        if (!cancelled) setContract(body);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  async function sign() {
    const seller = contract?.parties.find(({ role }) => role === "SELLER");
    if (!seller) return;
    setSigning(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts/${id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyId: seller.partyId, evidenceReference: "CUSTOMER_PORTAL_ACCEPTANCE" }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message ?? "ثبت امضا ناموفق بود.");
      await loadContract();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setSigning(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!contract) return <div className="rounded-lg bg-destructive/10 p-4 text-destructive">{error || "قرارداد پیدا نشد."}</div>;
  const seller = contract.parties.find(({ role }) => role === "SELLER");
  const buyer = contract.parties.find(({ role }) => role === "BUYER");
  const sellerSigned = seller && contract.signatures.some(({ partyId }) => partyId === seller.partyId);
  const requestAssetOrder = new Map(
    contract.requests.map(({ assetId }, index) => [assetId, index])
  );
  const orderedSchedules = [...contract.schedules].sort(
    (left, right) =>
      (requestAssetOrder.get(left.assetId) ?? Number.MAX_SAFE_INTEGER) -
      (requestAssetOrder.get(right.assetId) ?? Number.MAX_SAFE_INTEGER)
  );
  const terminationReview = contract.reviews.find(({ toStatus }) => toStatus === contract.status);

  return <div className="mx-auto max-w-4xl space-y-6">
    <div className="flex items-center gap-3"><Link href="/customer/contracts"><ArrowRight className="h-5 w-5" /></Link><div><h1 className="text-2xl font-bold">{contract.contractNumber}</h1><ContractStatusBadge status={contract.status as never} /></div></div>
    {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {contract.status === "TERMINATION_PENDING" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
      <p className="font-semibold">درخواست فسخ در حال بررسی است</p>
      {terminationReview?.notes && <p className="mt-2 whitespace-pre-wrap">دلیل: {terminationReview.notes}</p>}
      <p className="mt-2">تا اعلام تصمیم نهایی، قرائت و تسویهٔ دوره‌های مجاز ادامه دارد.</p>
    </div>}
    {contract.status === "TERMINATED" && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-950" role="status">
      <p className="font-semibold">قرارداد از {formatPersianDate(contract.terminationDate)} فسخ شده است.</p>
      {terminationReview?.notes && <p className="mt-2 whitespace-pre-wrap">دلیل: {terminationReview.notes}</p>}
      <p className="mt-2">تسویهٔ دوره‌های کامل پیش از تاریخ فسخ همچنان قابل پیگیری است.</p>
    </div>}
    <Card><CardHeader><CardTitle className="flex gap-2"><FileText className="h-5 w-5" />قرارداد اصلی</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <div><span className="text-sm text-muted-foreground">فروشنده</span><p>{seller?.party.displayName ?? "—"}</p></div>
      <div><span className="text-sm text-muted-foreground">خریدار</span><p>{buyer?.party.displayName ?? "—"}</p></div>
      <div><span className="text-sm text-muted-foreground">شروع</span><p>{formatPersianDate(contract.effectiveDate)}</p></div>
      <div><span className="text-sm text-muted-foreground">پایان</span><p>{contract.expirationDate ? formatPersianDate(contract.expirationDate) : "—"}</p></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>برنامه‌های تجاری مستقل نیروگاه‌ها</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{orderedSchedules.map((schedule, index) => <div key={schedule.id} className="rounded border p-3"><p className="font-medium">نیروگاه {index + 1}: {schedule.asset.name}</p><p className="mt-1 text-sm">{schedule.pricingPlan.name} ({pricingModelLabel(schedule.pricingPlan.model)})</p><p className="text-sm text-muted-foreground">نوع حجم: {schedule.volumeType} · حداقل: {schedule.minVolume ?? "—"} · حداکثر: {schedule.maxVolume ?? "—"}</p></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>پیوست اندازه‌گیری</CardTitle></CardHeader><CardContent><p>منبع اصلی: {contract.meteringAnnex?.primarySource ?? "—"}</p><p className="text-sm text-muted-foreground">{contract.meteringAnnex?.missingDataPolicy ?? "—"}</p></CardContent></Card>
    {contract.status === "PENDING_SIGNATURE" && !sellerSigned && <Card><CardContent className="pt-6"><p className="mb-4 text-sm text-muted-foreground">با ثبت امضا، پذیرش شما همراه با هویت کاربر و زمان سرور ثبت می‌شود. قرارداد پس از امضای هر دو طرف به وضعیت امضاشده می‌رود.</p><Button onClick={sign} disabled={signing}>{signing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="ml-2 h-4 w-4" />}امضای قرارداد</Button></CardContent></Card>}
    {sellerSigned && <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">امضای فروشنده ثبت شده است.</div>}
  </div>;
}
