"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, Activity, CalendarClock } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatApiDate } from "@/lib/persian-date";

interface Asset {
  id: string;
  name: string;
  type: string;
  capacityNominal: number;
}

interface Meter {
  id: string;
  serialNumber: string;
  assetId: string;
  readInterval: "MONTHLY" | "DAILY" | "HOURLY";
}

type PeriodSuggestion = {
  periodStart: string;
  periodEnd: string;
  ready: boolean;
  fullSettlementMonth: boolean;
};

type SuggestionResponse = {
  suggestion: PeriodSuggestion | null;
  firstFullSettlementMonth?: { periodStart: string; periodEnd: string } | null;
  contractNumber?: string;
  interval?: Meter["readInterval"];
  message: string | null;
};

async function getMeteringFormData(): Promise<{ assets: Asset[]; meters: Meter[] }> {
  const [assetsResponse, metersResponse] = await Promise.all([
    fetch("/api/assets"),
    fetch("/api/meters"),
  ]);
  const [assetsBody, metersBody] = await Promise.all([assetsResponse.json(), metersResponse.json()]);
  if (!assetsResponse.ok) throw new Error(getApiErrorMessage(assetsBody, "خطا در دریافت نیروگاه‌ها"));
  if (!metersResponse.ok) throw new Error(getApiErrorMessage(metersBody, "خطا در دریافت کنتورها"));
  return {
    assets: Array.isArray(assetsBody) ? assetsBody : assetsBody.items || assetsBody.assets || [],
    meters: Array.isArray(metersBody) ? metersBody : metersBody.items || metersBody.meters || [],
  };
}

export default function NewMeterReadingPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");

  const [formData, setFormData] = useState({
    assetId: "",
    meterId: "",
    periodStart: "",
    periodEnd: "",
    rawEnergy: "",
    rawPeak: "",
    rawOffPeak: "",
    source: "METER",
  });

  const filteredMeters = meters.filter((meter) => meter.assetId === formData.assetId);
  const selectedMeter = filteredMeters.find((meter) => meter.id === formData.meterId);
  const latestCompletedBoundary = formatApiDate(new Date(), selectedMeter?.readInterval === "HOURLY" ? undefined : "periodEnd");

  useEffect(() => {
    let active = true;
    async function loadFormData() {
      try {
        const data = await getMeteringFormData();
        if (active) {
          setAssets(data.assets);
          setMeters(data.meters);
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "خطا در دریافت اطلاعات قرائت");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadFormData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!formData.assetId || !formData.meterId) return;
    const controller = new AbortController();
    async function loadSuggestion() {
      setSuggestionLoading(true);
      setSuggestionError("");
      try {
        const params = new URLSearchParams({ assetId: formData.assetId, meterId: formData.meterId });
        const response = await fetch(`/api/meter-readings/suggestion?${params}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(getApiErrorMessage(body, "خطا در دریافت بازهٔ پیشنهادی"));
        setSuggestion(body as SuggestionResponse);
      } catch (reason) {
        if (!controller.signal.aborted) setSuggestionError(reason instanceof Error ? reason.message : "خطا در دریافت بازهٔ پیشنهادی");
      } finally {
        if (!controller.signal.aborted) setSuggestionLoading(false);
      }
    }
    void loadSuggestion();
    return () => controller.abort();
  }, [formData.assetId, formData.meterId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/meter-readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: formData.assetId,
          meterId: formData.meterId || null,
          periodStart: formData.periodStart,
          periodEnd: formData.periodEnd,
          rawEnergy: parseFloat(formData.rawEnergy),
          rawPeak: formData.rawPeak ? parseFloat(formData.rawPeak) : null,
          rawOffPeak: formData.rawOffPeak ? parseFloat(formData.rawOffPeak) : null,
          source: formData.source,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(getApiErrorMessage(data, "خطا در ایجاد قرائت"));
      }

      const reading = await response.json();
      router.push(`/admin/metering/${reading.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ایجاد قرائت");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/metering" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">ثبت قرائت جدید</h1>
          <p className="text-muted-foreground">ثبت قرائت کنتور نیروگاه</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            اطلاعات قرائت
          </CardTitle>
          <CardDescription>مشخصات قرائت کنتور را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assetId">نیروگاه *</Label>
                <SelectWithLabels
                  value={formData.assetId}
                  onValueChange={(value) => {
                    setFormData((current) => ({ ...current, assetId: value || "", meterId: "", periodStart: "", periodEnd: "" }));
                    setSuggestion(null);
                    setSuggestionError("");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب نیروگاه" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((asset) => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name} ({asset.capacityNominal?.toLocaleString() || "?"} kW)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectWithLabels>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meterId">کنتور</Label>
                <SelectWithLabels
                  value={formData.meterId}
                  onValueChange={(value) => {
                    setFormData((current) => ({ ...current, meterId: value || "", periodStart: "", periodEnd: "" }));
                    setSuggestion(null);
                    setSuggestionError("");
                  }}
                  disabled={!formData.assetId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="انتخاب کنتور" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMeters.map((meter) => (
                      <SelectItem key={meter.id} value={meter.id}>
                        {meter.serialNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </SelectWithLabels>
              </div>
            </div>

            {formData.assetId && (
              <div className="rounded-xl border bg-muted/40 p-4 text-sm space-y-2" aria-live="polite">
                <div className="flex items-center gap-2 font-medium"><CalendarClock className="size-4" /> راهنمای دورهٔ قرائت</div>
                {!formData.meterId && <p className="text-muted-foreground">برای دریافت بازهٔ پیشنهادی، کنتور را انتخاب کنید.</p>}
                {suggestionLoading && <p className="text-muted-foreground">در حال بررسی قرارداد و قرائت‌های قبلی…</p>}
                {suggestionError && <p className="text-destructive">{suggestionError}</p>}
                {suggestion?.message && <p className="text-muted-foreground">{suggestion.message}</p>}
                {suggestion?.suggestion && !suggestionLoading && (
                  <>
                    <p>قرارداد {suggestion.contractNumber} · بازهٔ بعدی: <span dir="ltr" className="inline-block font-medium">{suggestion.suggestion.periodStart} ← {suggestion.suggestion.periodEnd}</span></p>
                    <p className="text-muted-foreground">
                      {suggestion.suggestion.ready
                        ? "این بازه به پایان رسیده و برای ثبت قرائت آماده است."
                        : "این بازه هنوز به پایان نرسیده است؛ برای ثبت مقدار نهایی تا پایان آن صبر کنید."}
                      {!suggestion.suggestion.fullSettlementMonth && suggestion.interval === "MONTHLY"
                        ? " این بازه ماه کامل تسویه نیست و به‌تنهایی قابل تسویه نخواهد بود."
                        : ""}
                    </p>
                    {suggestion.firstFullSettlementMonth && (
                      <p className="text-muted-foreground">
                        نخستین ماه کاملِ قابل‌بررسی برای تسویه: <span dir="ltr" className="inline-block">{suggestion.firstFullSettlementMonth.periodStart} ← {suggestion.firstFullSettlementMonth.periodEnd}</span> (پس از پایان دوره و تأیید قرائت‌ها).
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!suggestion.suggestion.ready}
                      onClick={() => setFormData((current) => ({
                        ...current,
                        periodStart: suggestion.suggestion!.periodStart,
                        periodEnd: suggestion.suggestion!.periodEnd,
                      }))}
                    >
                      استفاده از بازهٔ پیشنهادی
                    </Button>
                  </>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="periodStart">تاریخ شروع دوره *</Label>
                <PersianDatePicker
                  id="periodStart"
                  maxExclusiveDate={formData.periodEnd}
                  maxDate={latestCompletedBoundary}
                  withTime={selectedMeter?.readInterval === "HOURLY"}
                  value={formData.periodStart}
                  onChange={(value) => setFormData({ ...formData, periodStart: value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">تاریخ پایان دوره *</Label>
                <PersianDatePicker
                  id="periodEnd"
                  withTime={selectedMeter?.readInterval === "HOURLY"}
                  minExclusiveDate={formData.periodStart}
                  maxDate={latestCompletedBoundary}
                  value={formData.periodEnd}
                  onChange={(value) => setFormData({ ...formData, periodEnd: value })}
                  required
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">پایان بازه انحصاری است؛ برای یک ماه شمسی، از روز اول آن ماه تا روز اول ماه بعد را وارد کنید. تاریخ‌ها را در صورت نیاز می‌توانید دستی اصلاح کنید.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rawEnergy">انرژی خام (kWh) *</Label>
                <Input
                  id="rawEnergy"
                  type="number"
                  step="0.01"
                  value={formData.rawEnergy}
                  onChange={(e) => setFormData({ ...formData, rawEnergy: e.target.value })}
                  placeholder="12500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">منبع *</Label>
                <SelectWithLabels
                  value={formData.source}
                  onValueChange={(value) => setFormData({ ...formData, source: value || "METER" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="METER">کنتور</SelectItem>
                    <SelectItem value="MANUAL">دستی</SelectItem>
                    <SelectItem value="SCADA">SCADA</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rawPeak">اوج بار (kW)</Label>
                <Input
                  id="rawPeak"
                  type="number"
                  step="0.01"
                  value={formData.rawPeak}
                  onChange={(e) => setFormData({ ...formData, rawPeak: e.target.value })}
                  placeholder="950"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rawOffPeak">بار غیراوج (kW)</Label>
                <Input
                  id="rawOffPeak"
                  type="number"
                  step="0.01"
                  value={formData.rawOffPeak}
                  onChange={(e) => setFormData({ ...formData, rawOffPeak: e.target.value })}
                  placeholder="450"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Activity className="h-4 w-4 ml-2" />
                )}
                ثبت قرائت
              </Button>
              <Link href="/admin/metering">
                <Button type="button" variant="outline">
                  انصراف
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
