"use client";

import { formatApiDate, formatPersianDateTime, formatPersianMonth } from "@/lib/persian-date";


import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { BarChart3, Database, Loader2, Plus } from "lucide-react";

type PricingPlan = {
  id: string;
  name: string;
  code: string;
  version: number;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "ACTIVE" | "DEPRECATED";
  model: string;
  currency: string;
  energyUnit: string;
  indexName: string | null;
  indexSource: string | null;
};

type MarketIndexObservation = {
  id: string;
  pricingPlanId: string;
  period: string;
  value: number | string;
  indexName: string;
  source: string;
  timezone: string;
  observedAt: string;
  createdAt: string;
  pricingPlan: {
    id: string;
    name: string;
    version: number;
  };
};

function currentPeriod(): string {
  return formatApiDate(new Date(), "effectiveDate").slice(0, 7).replace("/", "-");
}

function currentLocalDateTime(): string {
  return formatApiDate(new Date()).slice(0, 16);
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getApiErrorMessage(body, "دریافت اطلاعات شاخص بازار ناموفق بود"));
  return body;
}

async function getPageData(): Promise<{ plans: PricingPlan[]; observations: MarketIndexObservation[] }> {
  const [plansResponse, observationsResponse] = await Promise.all([
    fetch("/api/pricing-rules?limit=100"),
    fetch("/api/market-indices?limit=100"),
  ]);
  const [plans, observations] = await Promise.all([
    readJson(plansResponse) as Promise<PricingPlan[]>,
    readJson(observationsResponse) as Promise<MarketIndexObservation[]>,
  ]);
  return { plans, observations };
}

export default function MarketIndicesPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [observations, setObservations] = useState<MarketIndexObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    pricingPlanId: "",
    period: currentPeriod(),
    value: "",
    observedAt: currentLocalDateTime(),
  });

  const eligiblePlans = useMemo(
    () => plans.filter(
      (plan) => ["APPROVED", "ACTIVE"].includes(plan.status) && plan.indexName && plan.indexSource
    ),
    [plans]
  );
  const selectedPlan = eligiblePlans.find((plan) => plan.id === form.pricingPlanId);

  useEffect(() => {
    let active = true;
    async function loadPage() {
      try {
        const data = await getPageData();
        if (!active) return;
        setPlans(data.plans);
        setObservations(data.observations);
        const firstEligiblePlan = data.plans.find(
          (plan) => ["APPROVED", "ACTIVE"].includes(plan.status) && plan.indexName && plan.indexSource
        );
        if (firstEligiblePlan) {
          setForm((current) => ({ ...current, pricingPlanId: firstEligiblePlan.id }));
        }
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "دریافت اطلاعات شاخص بازار ناموفق بود");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadPage();
    return () => { active = false; };
  }, []);

  const createObservation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPlan?.indexName || !selectedPlan.indexSource) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/market-indices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingPlanId: selectedPlan.id,
          period: form.period,
          value: Number(form.value),
          indexName: selectedPlan.indexName,
          source: selectedPlan.indexSource,
          timezone: "Asia/Tehran",
          observedAt: form.observedAt,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "ثبت مقدار شاخص بازار ناموفق بود"));
      setSuccess("مقدار شاخص ثبت شد و موتور قیمت‌گذاری می‌تواند آن را برای همین نرخ‌نامه و دوره استفاده کند.");
      const data = await getPageData();
      setPlans(data.plans);
      setObservations(data.observations);
      setForm((current) => ({ ...current, value: "" }));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "ثبت مقدار شاخص بازار ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">شاخص‌های بازار</h1>
        <p className="text-muted-foreground">
          ثبت مقدار دوره‌ای شاخص برای نرخ‌نامه‌های مبتنی بر بازار و استفاده در محاسبه تسویه
        </p>
      </div>

      {error && <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {success && <div role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{success}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />سوابق ثبت‌شده</CardTitle>
            <CardDescription>هر مقدار به یک نسخه نرخ‌نامه و یک دوره مشخص متصل و قابل ممیزی است.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : observations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
                هنوز مقداری برای شاخص بازار ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {observations.map((observation) => (
                  <div key={observation.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{observation.indexName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {observation.pricingPlan.name}، نسخه {observation.pricingPlan.version.toLocaleString("fa-IR")}
                        </p>
                      </div>
                      <Badge variant="secondary">دوره {formatPersianMonth(observation.period)}</Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <div><span className="text-muted-foreground">مقدار: </span><strong>{Number(observation.value).toLocaleString("fa-IR", { maximumFractionDigits: 6 })}</strong></div>
                      <div><span className="text-muted-foreground">منبع: </span>{observation.source}</div>
                      <div><span className="text-muted-foreground">زمان مشاهده: </span>{formatPersianDateTime(observation.observedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />ثبت مقدار شاخص</CardTitle>
            <CardDescription>
              برای هر نرخ‌نامه در هر دوره فقط یک مقدار ثبت می‌شود. نام و منبع از نرخ‌نامه خوانده می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : eligiblePlans.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                نرخ‌نامه شاخص‌دارِ تأییدشده یا فعال وجود ندارد. ابتدا نرخ‌نامه را تعریف و تأیید کنید.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={createObservation}>
                <div className="space-y-2">
                  <Label htmlFor="pricingPlanId">نرخ‌نامه *</Label>
                  <SelectWithLabels
                    value={form.pricingPlanId}
                    onValueChange={(value) => setForm((current) => ({ ...current, pricingPlanId: value ?? "" }))}
                  >
                    <SelectTrigger id="pricingPlanId" className="w-full"><SelectValue placeholder="انتخاب نرخ‌نامه" /></SelectTrigger>
                    <SelectContent>
                      {eligiblePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </SelectWithLabels>
                </div>

                {selectedPlan && (
                  <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm sm:grid-cols-2">
                    <div><span className="text-muted-foreground">نام شاخص: </span>{selectedPlan.indexName}</div>
                    <div><span className="text-muted-foreground">منبع: </span>{selectedPlan.indexSource}</div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="period">دوره شمسی *</Label>
                  <PersianDatePicker id="period" monthOnly maxDate={`${currentPeriod().replace("-", "/")}/01`} required value={form.period} onChange={(value) => setForm((current) => ({ ...current, period: value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">
                      مقدار شاخص{selectedPlan ? ` (${selectedPlan.currency}/${selectedPlan.energyUnit})` : ""} *
                    </Label>
                    <Input id="value" type="number" min="0.000001" step="0.000001" required value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} placeholder="مثال: 2800" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observedAt">زمان مشاهده یا انتشار *</Label>
                  <PersianDatePicker id="observedAt" withTime maxDate={currentLocalDateTime()} required value={form.observedAt} onChange={(value) => setForm((current) => ({ ...current, observedAt: value }))} />
                  <p className="text-xs text-muted-foreground">منطقه زمانی ثبت: Asia/Tehran</p>
                </div>

                <Button className="w-full" type="submit" disabled={saving || !selectedPlan || !form.value}>
                  {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}
                  ثبت مقدار شاخص
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
