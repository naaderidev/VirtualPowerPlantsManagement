"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { SelectContent, SelectItem, SelectTrigger, SelectValue, SelectWithLabels } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { alignContractPeriodToFullMonths, fullSettlementMonths, getContractPeriodIssue } from "@/domain/contracts/contract-period";
import { cn } from "@/lib/utils";
import { getContractConfigurationPresentation } from "./_lib/presentation";

type ContractAsset = {
  assetId: string;
  sharePercent: number | null;
  asset: { id: string; name: string; capacityNominal: number; capacitySellable: number };
};

type Contract = {
  id: string;
  contractNumber: string;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  notes: string | null;
  reviews: Array<{
    toStatus: string | null;
    notes: string | null;
  }>;
  assets: ContractAsset[];
  requests: Array<{
    id: string;
    caseNumber: string;
    assetId: string | null;
    createdAt: string;
    hasExistingContract: boolean;
    existingContractStart: string | null;
    existingContractEnd: string | null;
    existingContractCounterparty: string | null;
    existingContractCommittedCapacity: number | null;
    existingContractExclusive: boolean;
    existingContractRestrictions: string | null;
    existingContractRightToSellConfirmed: boolean;
  }>;
  schedules: Array<{
    assetId: string;
    pricingPlanId: string;
    minVolume: number | null;
    maxVolume: number | null;
    paymentDueDays: number;
  }>;
  meteringAnnex: {
    primarySource: string;
    backupSource: string | null;
    missingDataPolicy: string;
    correctionDeadline: number | null;
    disputeDeadline: number | null;
  } | null;
};

type PricingPlan = {
  id: string;
  name: string;
  code: string;
  model: "FIXED" | "MARKET_INDEX" | "HYBRID" | "FLOOR";
  status: string;
  validFrom: string;
  validTo: string | null;
};

type ScheduleDraft = {
  pricingPlanId: string;
  minVolume: string;
  maxVolume: string;
  paymentDueDays: string;
};

function asDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function displayDateInput(value: string): string {
  return formatPersianDate(`${value}T00:00:00`);
}

function orderedAssets(contract: Contract): ContractAsset[] {
  const requestOrder = new Map(
    contract.requests.map(({ assetId }, index) => [assetId, index])
  );
  return [...contract.assets].sort(
    (left, right) =>
      (requestOrder.get(left.assetId) ?? Number.MAX_SAFE_INTEGER) -
      (requestOrder.get(right.assetId) ?? Number.MAX_SAFE_INTEGER)
  );
}

function modelLabel(model: PricingPlan["model"]): string {
  if (model === "FIXED") return "قیمت ثابت";
  if (model === "MARKET_INDEX") return "شاخص بازار";
  if (model === "HYBRID") return "ترکیبی";
  return "کف قیمت";
}

function scheduleName(isScenario142: boolean, index: number): string {
  if (!isScenario142) return `برنامه تجاری ${index + 1}`;
  return index === 0
    ? "برنامه تجاری نیروگاه اول - قیمت ثابت"
    : "برنامه تجاری نیروگاه دوم - شاخص بازار";
}

export default function ContractConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [schedules, setSchedules] = useState<Record<string, ScheduleDraft>>({});
  const [form, setForm] = useState({
    effectiveDate: "",
    expirationDate: "",
    primarySource: "SMART_METER",
    backupSource: "",
    missingDataPolicy: "استفاده از کنتور پشتیبان و سپس برآورد تأییدشده",
    correctionDeadline: "7",
    disputeDeadline: "10",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void Promise.all([fetch(`/api/contracts/${id}`), fetch("/api/pricing-rules?limit=100")])
      .then(async ([contractResponse, plansResponse]) => {
        const [contractBody, plansBody] = await Promise.all([
          contractResponse.json().catch(() => null),
          plansResponse.json().catch(() => null),
        ]);
        if (!contractResponse.ok || !plansResponse.ok) {
          throw new Error("دریافت اطلاعات پیکربندی ناموفق بود.");
        }
        return {
          contractData: contractBody as Contract,
          plansData: plansBody as PricingPlan[],
        };
      })
      .then(({ contractData, plansData }) => {
        if (!active) return;
        const eligiblePlans = plansData.filter(({ status }) => ["APPROVED", "ACTIVE"].includes(status));
        const assets = orderedAssets(contractData);
        const isScenario142 = contractData.requests.length === 2;
        const scheduleDrafts = Object.fromEntries(
          assets.map((contractAsset, index) => {
            const existing = contractData.schedules.find(({ assetId }) => assetId === contractAsset.assetId);
            const requiredModel = isScenario142 ? (index === 0 ? "FIXED" : "MARKET_INDEX") : null;
            const defaultPlan = eligiblePlans.find(({ model }) => !requiredModel || model === requiredModel);
            return [
              contractAsset.assetId,
              {
                pricingPlanId: existing?.pricingPlanId ?? defaultPlan?.id ?? "",
                minVolume: existing?.minVolume?.toString() ?? "",
                maxVolume: existing?.maxVolume?.toString() ?? "",
                paymentDueDays: existing?.paymentDueDays?.toString() ?? "30",
              },
            ];
          })
        );

        setContract(contractData);
        setPlans(eligiblePlans);
        setSchedules(scheduleDrafts);
        setForm({
          effectiveDate: asDateInput(contractData.effectiveDate),
          expirationDate: asDateInput(contractData.expirationDate),
          primarySource: contractData.meteringAnnex?.primarySource ?? "SMART_METER",
          backupSource: contractData.meteringAnnex?.backupSource ?? "",
          missingDataPolicy:
            contractData.meteringAnnex?.missingDataPolicy ??
            "استفاده از کنتور پشتیبان و سپس برآورد تأییدشده",
          correctionDeadline: contractData.meteringAnnex?.correctionDeadline?.toString() ?? "7",
          disputeDeadline: contractData.meteringAnnex?.disputeDeadline?.toString() ?? "10",
          notes: contractData.notes ?? "",
        });
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const assets = useMemo(() => (contract ? orderedAssets(contract) : []), [contract]);
  const isScenario142 = contract?.requests.length === 2;
  const presentation = useMemo(
    () => getContractConfigurationPresentation(assets.length),
    [assets.length],
  );
  const selectedPlans = assets
    .map(({ assetId }) => plans.find(({ id: planId }) => planId === schedules[assetId]?.pricingPlanId))
    .filter((plan): plan is PricingPlan => Boolean(plan));
  const latestPlanStart = selectedPlans.map(({ validFrom }) => asDateInput(validFrom)).sort().at(-1);
  const earliestPlanEnd = selectedPlans
    .map(({ validTo }) => asDateInput(validTo))
    .filter(Boolean)
    .sort()[0];
  const proposedStart = [asDateInput(contract?.effectiveDate ?? null), latestPlanStart].filter(Boolean).sort().at(-1) ?? "";
  const proposedEnd = [asDateInput(contract?.expirationDate ?? null), earliestPlanEnd].filter(Boolean).sort()[0] ?? "";
  const hasUsablePlanWindow = Boolean(proposedStart && proposedEnd && proposedEnd > proposedStart);
  const alignedPeriod = alignContractPeriodToFullMonths(form);
  const alignedFitsPlans = Boolean(alignedPeriod
    && (!latestPlanStart || alignedPeriod.effectiveDate >= latestPlanStart)
    && (!earliestPlanEnd || alignedPeriod.expirationDate <= earliestPlanEnd));

  function setCommonField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function setScheduleField(assetId: string, field: keyof ScheduleDraft, value: string) {
    setSchedules((current) => ({
      ...current,
      [assetId]: { ...current[assetId], [field]: value },
    }));
    setFieldErrors((current) => ({ ...current, [`${field}.${assetId}`]: "" }));
  }

  function validateConfiguration(): Record<string, string> {
    const errors: Record<string, string> = {};
    const periodIssue = getContractPeriodIssue({
      effectiveDate: form.effectiveDate,
      expirationDate: form.expirationDate,
    });
    if (periodIssue) errors[periodIssue.field] = periodIssue.message;
    if (isScenario142 && assets.length !== 2) {
      errors.assets = "توافق‌نامه مادر باید دقیقاً دو نیروگاه داشته باشد.";
    }

    assets.forEach(({ assetId }, index) => {
      const schedule = schedules[assetId];
      const plan = plans.find(({ id: planId }) => planId === schedule?.pricingPlanId);
      const requiredModel = isScenario142 ? (index === 0 ? "FIXED" : "MARKET_INDEX") : null;
      if (!schedule?.pricingPlanId || !plan) {
        errors[`pricingPlanId.${assetId}`] = "نرخ‌نامه معتبر انتخاب کنید.";
        return;
      }
      if (requiredModel && plan.model !== requiredModel) {
        errors[`pricingPlanId.${assetId}`] = `برای این نیروگاه فقط نرخ‌نامه ${modelLabel(requiredModel)} مجاز است.`;
      }
      const planStart = asDateInput(plan.validFrom);
      const planEnd = asDateInput(plan.validTo);
      if (form.effectiveDate && form.effectiveDate < planStart) {
        errors[`pricingPlanId.${assetId}`] = `تاریخ شروع را ${displayDateInput(planStart)} یا بعد از آن قرار دهید.`;
      }
      if (planEnd && form.expirationDate && form.expirationDate > planEnd) {
        errors[`pricingPlanId.${assetId}`] = `تاریخ پایان را ${displayDateInput(planEnd)} یا قبل از آن قرار دهید.`;
      }
      if (
        schedule.minVolume &&
        schedule.maxVolume &&
        Number(schedule.maxVolume) < Number(schedule.minVolume)
      ) {
        errors[`maxVolume.${assetId}`] = "حداکثر انرژی باید از حداقل بیشتر باشد.";
      }
      const requestRecord = contract?.requests.find((request) => request.assetId === assetId);
      const contractPeriodOverlaps = Boolean(
        requestRecord?.hasExistingContract &&
        requestRecord.existingContractStart &&
        requestRecord.existingContractEnd &&
        form.effectiveDate &&
        form.expirationDate &&
        form.effectiveDate <= requestRecord.existingContractEnd.slice(0, 10) &&
        requestRecord.existingContractStart.slice(0, 10) <= form.expirationDate
      );
      if (contractPeriodOverlaps && requestRecord?.existingContractExclusive) {
        errors[`existingContract.${assetId}`] = "بازه برنامه با قرارداد فروش انحصاری موجود هم‌پوشانی دارد.";
      } else if (
        contractPeriodOverlaps &&
        requestRecord?.existingContractCommittedCapacity != null &&
        requestRecord.existingContractCommittedCapacity + (assets.find((item) => item.assetId === assetId)?.asset.capacitySellable ?? 0) >
          (assets.find((item) => item.assetId === assetId)?.asset.capacityNominal ?? 0)
      ) {
        errors[`existingContract.${assetId}`] = "ظرفیت آزاد برای هم‌پوشانی این برنامه کافی نیست.";
      }
    });
    return errors;
  }

  async function saveConfiguration() {
    if (!contract || assets.length === 0) {
      setError("قرارداد دارایی قابل پیکربندی ندارد.");
      return;
    }
    const errors = validateConfiguration();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError("برای تکمیل پیکربندی، فیلدهای مشخص‌شده را اصلاح کنید.");
      return;
    }

    const configuredSchedules = assets.map(({ assetId }, index) => {
      const draft = schedules[assetId];
      return {
        assetId,
        name: scheduleName(Boolean(isScenario142), index),
        startDate: form.effectiveDate,
        endDate: form.expirationDate,
        volumeType: draft.minVolume || draft.maxVolume ? "MIN_MAX" : "AS_PRODUCED",
        minVolume: draft.minVolume || null,
        maxVolume: draft.maxVolume || null,
        pricingPlanId: draft.pricingPlanId,
        settlementCycle: "MONTHLY",
        paymentDueDays: draft.paymentDueDays,
        nettingEnabled: Boolean(isScenario142),
      };
    });
    const configuredAssets = assets.map(({ assetId, sharePercent }) => ({
      assetId,
      sharePercent,
    }));

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/contracts/${id}/configuration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PPA",
          effectiveDate: form.effectiveDate,
          expirationDate: form.expirationDate,
          notes: form.notes,
          volumeType: configuredSchedules.every(({ volumeType }) => volumeType === "AS_PRODUCED")
            ? "AS_PRODUCED"
            : "MIN_MAX",
          settlementCycle: "MONTHLY",
          paymentDueDays: Math.max(...configuredSchedules.map(({ paymentDueDays }) => Number(paymentDueDays))),
          nettingEnabled: Boolean(isScenario142),
          assets: configuredAssets,
          schedules: configuredSchedules,
          meteringAnnex: {
            primarySource: form.primarySource,
            backupSource: form.backupSource || null,
            missingDataPolicy: form.missingDataPolicy,
            correctionDeadline: form.correctionDeadline,
            disputeDeadline: form.disputeDeadline,
          },
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(body, "ذخیره پیکربندی ناموفق بود."));
      }
      router.push(`/admin/contracts/${id}`);
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (!contract) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-destructive">{error || "قرارداد پیدا نشد."}</div>;
  }

  const latestChangeRequest = contract.status === "NEEDS_CHANGES"
    ? contract.reviews.find(({ toStatus }) => toStatus === "NEEDS_CHANGES")
    : null;

  return (
    <div className={cn("mx-auto space-y-6", presentation.pageWidthClassName)}>
      <div className="flex items-center gap-3">
        <Link href={`/admin/contracts/${id}`} aria-label="بازگشت به قرارداد"><ArrowRight className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold">پیکربندی {contract.contractNumber}</h1>
          <p className="text-muted-foreground">
            {isScenario142
              ? "دو برنامه مستقل: نیروگاه اول ثابت، نیروگاه دوم شاخص بازار"
              : presentation.assetSummary}
          </p>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}
      {contract.status === "NEEDS_CHANGES" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
          <p className="font-semibold">اصلاحات درخواستی کارشناس حقوقی</p>
          {latestChangeRequest?.notes && <p className="mt-2 whitespace-pre-wrap">{latestChangeRequest.notes}</p>}
          <p className="mt-2">پس از ذخیره اصلاحات، از صفحه جزئیات قرارداد آن را دوباره برای بررسی ارسال کنید.</p>
        </div>
      )}
      {contract.requests.some(({ hasExistingContract }) => hasExistingContract) && <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950"><p className="font-semibold">کنترل قرارداد فروش موجود فعال است</p><p className="mt-1">اگر بازه جدید با قرارداد انحصاری هم‌پوشانی داشته باشد یا مجموع ظرفیت‌ها از ظرفیت نامی بیشتر شود، ذخیره پیکربندی مسدود خواهد شد.</p></div>}
      {fieldErrors.assets && <p className="text-sm text-destructive">{fieldErrors.assets}</p>}

      <Card>
        <CardHeader><CardTitle>بازه توافق‌نامه</CardTitle></CardHeader>
        {selectedPlans.length > 0 && (
          <div className="mx-6 mb-4 rounded-lg border bg-muted/40 p-3 text-sm">
            {hasUsablePlanWindow ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>بازهٔ مشترک پیشنهادی با نرخ‌نامه‌های انتخاب‌شده: {formatPersianDate(proposedStart)} تا {formatPersianDate(proposedEnd)}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setForm((current) => ({ ...current, effectiveDate: proposedStart, expirationDate: proposedEnd }))}>اعمال بازهٔ پیشنهادی</Button>
              </div>
            ) : <p className="text-destructive">نرخ‌نامه‌های انتخاب‌شده با بازهٔ قرارداد اشتراک معتبر ندارند؛ نرخ‌نامه یا تاریخ‌های قرارداد را بازبینی کنید.</p>}
          </div>
        )}
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="effectiveDate">تاریخ شروع *</Label><PersianDatePicker id="effectiveDate" minDate={latestPlanStart} maxDate={earliestPlanEnd} maxExclusiveDate={form.expirationDate} invalid={Boolean(fieldErrors.effectiveDate)} value={form.effectiveDate} onChange={(value) => setCommonField("effectiveDate", value)} />{fieldErrors.effectiveDate && <p className="text-xs text-destructive">{fieldErrors.effectiveDate}</p>}</div>
          <div className="space-y-2"><Label htmlFor="expirationDate">تاریخ پایان *</Label><PersianDatePicker id="expirationDate" minExclusiveDate={form.effectiveDate} maxDate={earliestPlanEnd} invalid={Boolean(fieldErrors.expirationDate)} value={form.expirationDate} onChange={(value) => setCommonField("expirationDate", value)} />{fieldErrors.expirationDate && <p className="text-xs text-destructive">{fieldErrors.expirationDate}</p>}</div>
          {form.effectiveDate && form.expirationDate && (
            <div className="sm:col-span-2 rounded-lg border bg-muted/40 p-3 text-sm leading-6">
              این بازه {fullSettlementMonths(form).length.toLocaleString("fa-IR")} ماه کامل برای تسویه ماهانه دارد.
              بخش‌های ناقص ابتدا و انتها فعلاً قابل تسویه ماهانه نیستند. شروع و پایانِ روز اول ماه، امکان پوشش ۱۲ ماه کامل را در قرارداد یک‌ساله می‌دهد؛
              نرخ‌نامه نیز باید کل بازه را پوشش دهد. صورتحساب هر ماه پس از پایان آن ماه، تأیید قرائت‌ها و تأیید تسویه صادر می‌شود.
              {alignedPeriod && (alignedPeriod.effectiveDate !== form.effectiveDate || alignedPeriod.expirationDate !== form.expirationDate) && <div className="mt-2 space-y-2">
                <p>بازه ماهانه کامل پیشنهادی: {formatPersianDate(alignedPeriod.effectiveDate)} تا {formatPersianDate(alignedPeriod.expirationDate)}. این انتخاب تاریخ آغاز تعهد را تغییر می‌دهد.</p>
                {alignedFitsPlans ? <Button type="button" size="sm" variant="outline" onClick={() => setForm((current) => ({ ...current, ...alignedPeriod }))}>اعمال بازه ماهانه کامل</Button> : <p className="text-amber-700">این پیشنهاد خارج از اعتبار نرخ‌نامه انتخاب‌شده است؛ ابتدا نرخ‌نامه یا بازه قرارداد را بازبینی کنید.</p>}
              </div>}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="commercial-schedules-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="commercial-schedules-title" className="text-lg font-semibold">برنامه‌های تجاری نیروگاه‌ها</h2>
            <p className="text-sm text-muted-foreground">برای هر نیروگاه، نرخ‌نامه و شرایط تحویل مستقل تعیین کنید.</p>
          </div>
          <p className="text-sm font-medium text-muted-foreground">{presentation.assetSummary}</p>
        </div>
        <div className={presentation.scheduleGridClassName}>
          {assets.map(({ assetId, asset }, index) => {
            const draft = schedules[assetId];
            const requiredModel = isScenario142 ? (index === 0 ? "FIXED" : "MARKET_INDEX") : null;
            const availablePlans = plans.filter(({ model }) => !requiredModel || model === requiredModel);
            const selectedPlan = plans.find(({ id: planId }) => planId === draft?.pricingPlanId);
            return (
              <Card key={assetId} className={presentation.scheduleCardClassNames[index]}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{asset.name}</CardTitle>
                  <CardDescription>
                    {contract.requests[index]?.caseNumber ?? `نیروگاه ${index + 1}`} • {asset.capacityNominal.toLocaleString()} کیلووات
                    {requiredModel ? ` • ${modelLabel(requiredModel)}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className={cn("space-y-4", assets.length === 1 && "grid gap-4 space-y-0 lg:grid-cols-2")}>
                  {fieldErrors[`existingContract.${assetId}`] && <div className={cn("rounded-lg bg-destructive/10 p-3 text-sm text-destructive", assets.length === 1 && "lg:col-span-2")}>{fieldErrors[`existingContract.${assetId}`]}</div>}
                  <div className="space-y-2">
                    <Label>نرخ‌نامه *</Label>
                    <SelectWithLabels value={draft?.pricingPlanId ?? ""} onValueChange={(value) => setScheduleField(assetId, "pricingPlanId", value ?? "")}>
                      <SelectTrigger aria-invalid={Boolean(fieldErrors[`pricingPlanId.${assetId}`])}><SelectValue placeholder={requiredModel ? `انتخاب نرخ‌نامه ${modelLabel(requiredModel)}` : "انتخاب نرخ‌نامه"} /></SelectTrigger>
                      <SelectContent>{availablePlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name} ({plan.code})</SelectItem>)}</SelectContent>
                    </SelectWithLabels>
                    {selectedPlan && <p className="text-xs text-muted-foreground">اعتبار: {formatPersianDate(selectedPlan.validFrom)} تا {selectedPlan.validTo ? formatPersianDate(selectedPlan.validTo) : "بدون پایان"}</p>}
                    {availablePlans.length === 0 && <p className="text-xs text-amber-700">نرخ‌نامه {requiredModel ? modelLabel(requiredModel) : "مجاز"} موجود نیست؛ <Link href="/admin/pricing/new" className="underline">ایجاد نرخ‌نامه</Link></p>}
                    {fieldErrors[`pricingPlanId.${assetId}`] && <p className="text-xs text-destructive">{fieldErrors[`pricingPlanId.${assetId}`]}</p>}
                  </div>
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2"><Label>حداقل انرژی (MWh)</Label><Input type="number" min="0" value={draft?.minVolume ?? ""} onChange={(event) => setScheduleField(assetId, "minVolume", event.target.value)} /></div>
                      <div className="space-y-2"><Label>حداکثر انرژی (MWh)</Label><Input type="number" min="0" aria-invalid={Boolean(fieldErrors[`maxVolume.${assetId}`])} value={draft?.maxVolume ?? ""} onChange={(event) => setScheduleField(assetId, "maxVolume", event.target.value)} />{fieldErrors[`maxVolume.${assetId}`] && <p className="text-xs text-destructive">{fieldErrors[`maxVolume.${assetId}`]}</p>}</div>
                    </div>
                    <div className="space-y-2"><Label>مهلت پرداخت (روز)</Label><Input type="number" min="1" max="365" value={draft?.paymentDueDays ?? "30"} onChange={(event) => setScheduleField(assetId, "paymentDueDays", event.target.value)} /></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader><CardTitle>پیوست اندازه‌گیری و اختلاف</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>منبع اصلی</Label><Input value={form.primarySource} onChange={(event) => setCommonField("primarySource", event.target.value)} /></div>
          <div className="space-y-2"><Label>منبع پشتیبان</Label><Input value={form.backupSource} onChange={(event) => setCommonField("backupSource", event.target.value)} /></div>
          <div className="space-y-2"><Label>مهلت اصلاح (روز)</Label><Input type="number" min="1" value={form.correctionDeadline} onChange={(event) => setCommonField("correctionDeadline", event.target.value)} /></div>
          <div className="space-y-2"><Label>مهلت اعتراض (روز)</Label><Input type="number" min="1" value={form.disputeDeadline} onChange={(event) => setCommonField("disputeDeadline", event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>سیاست داده مفقود</Label><Textarea value={form.missingDataPolicy} onChange={(event) => setCommonField("missingDataPolicy", event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>یادداشت قرارداد</Label><Textarea value={form.notes} onChange={(event) => setCommonField("notes", event.target.value)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveConfiguration} disabled={saving}>
          {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
          {presentation.actionLabel}
        </Button>
      </div>
    </div>
  );
}
