"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { canSubmitOperationalReadiness } from "@/domain/assets/operational-readiness";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatApiDate } from "@/lib/persian-date";
import type { RequestStatus } from "@prisma/client";

type Meter = {
  type: "MAIN" | "BACKUP";
  serialNumber: string;
  manufacturer: string | null;
  model: string | null;
  readInterval: "HOURLY" | "DAILY" | "MONTHLY";
  dataSource: "SMART_METER" | "API" | "MANUAL" | "SCADA";
  installDate: string | null;
};

type RequestPayload = {
  caseNumber: string;
  status: RequestStatus;
  asset: {
    id: string;
    name: string;
    status: string;
    capacityNominal: number;
    province: string;
    city: string;
    operationalDate: string | null;
    connectionDate: string | null;
    gridCompany: string | null;
    connectionPoint: string | null;
    connectionStatus: string | null;
    meters: Meter[];
  } | null;
};

const emptyMeter = {
  serialNumber: "",
  manufacturer: "",
  model: "",
  installDate: "",
};

export default function OperationalReadinessPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const router = useRouter();
  const [requestData, setRequestData] = useState<RequestPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState<"SAVE_DRAFT" | "SUBMIT" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    operationalDate: "",
    connectionDate: "",
    gridCompany: "",
    connectionPoint: "",
    connectionStatus: "",
    readInterval: "DAILY",
    dataSource: "SMART_METER",
    main: { ...emptyMeter },
    backup: { ...emptyMeter },
  });

  useEffect(() => {
    let active = true;
    void fetch(`/api/requests/${id}`)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(getApiErrorMessage(payload, "دریافت اطلاعات درخواست ناموفق بود."));
        return payload as RequestPayload;
      })
      .then((payload) => {
        if (!active) return;
        setRequestData(payload);
        const main = payload.asset?.meters.find(({ type }) => type === "MAIN");
        const backup = payload.asset?.meters.find(({ type }) => type === "BACKUP");
        setForm({
          operationalDate: payload.asset?.operationalDate?.slice(0, 10) ?? "",
          connectionDate: payload.asset?.connectionDate?.slice(0, 10) ?? "",
          gridCompany: payload.asset?.gridCompany ?? "",
          connectionPoint: payload.asset?.connectionPoint ?? "",
          connectionStatus: payload.asset?.connectionStatus ?? "",
          readInterval: main?.readInterval ?? "DAILY",
          dataSource: main?.dataSource ?? "SMART_METER",
          main: {
            serialNumber: main?.serialNumber ?? "",
            manufacturer: main?.manufacturer ?? "",
            model: main?.model ?? "",
            installDate: main?.installDate?.slice(0, 10) ?? "",
          },
          backup: {
            serialNumber: backup?.serialNumber ?? "",
            manufacturer: backup?.manufacturer ?? "",
            model: backup?.model ?? "",
            installDate: backup?.installDate?.slice(0, 10) ?? "",
          },
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

  const save = async (mode: "SAVE_DRAFT" | "SUBMIT") => {
    setSavingMode(mode);
    setError("");
    setMessage("");
    try {
      const meters = [
        form.main.serialNumber
          ? { type: "MAIN", ...form.main, readInterval: form.readInterval, dataSource: form.dataSource }
          : null,
        form.backup.serialNumber
          ? { type: "BACKUP", ...form.backup, readInterval: form.readInterval, dataSource: form.dataSource }
          : null,
      ]
        .filter((meter) => meter !== null)
        .map((meter) => ({
          ...meter,
          manufacturer: meter.manufacturer || null,
          model: meter.model || null,
          installDate: meter.installDate || null,
        }));
      const response = await fetch(`/api/requests/${id}/operational-readiness`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          operationalDate: form.operationalDate || null,
          connectionDate: form.connectionDate || null,
          gridCompany: form.gridCompany || null,
          connectionPoint: form.connectionPoint || null,
          connectionStatus: form.connectionStatus || null,
          meters,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(payload, "ذخیره اطلاعات بهره‌برداری ناموفق بود."));
      if (mode === "SUBMIT") {
        router.push(`/customer/requests/${id}`);
        router.refresh();
      } else {
        setMessage("پیش‌نویس اطلاعات بهره‌برداری ذخیره شد.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ذخیره اطلاعات بهره‌برداری ناموفق بود.");
    } finally {
      setSavingMode(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin" /></div>;
  }

  if (
    !requestData?.asset ||
    requestData.asset.status === "ACTIVE" ||
    !canSubmitOperationalReadiness(requestData.status)
  ) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader><CardTitle>اطلاعات بهره‌برداری قابل ویرایش نیست</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            اطلاعات اصلی نیروگاه پس از ارسال قفل می‌شود و این فرم فقط برای نیروگاه غیرفعالی است که وارد مرحله پیگیری شده باشد.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Link href={`/customer/requests/${id}`}><Button variant="outline">بازگشت به درخواست</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const asset = requestData.asset;
  const today = formatApiDate(new Date(), "operationalDate");
  const updateMeter = (type: "main" | "backup", field: keyof typeof emptyMeter, value: string) => {
    setForm((current) => ({ ...current, [type]: { ...current[type], [field]: value } }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/customer/requests/${id}`} aria-label="بازگشت" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">اعلام آمادگی بهره‌برداری</h1>
          <p className="text-muted-foreground">درخواست {requestData.caseNumber} — {asset.name}</p>
        </div>
      </div>

      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          مشخصات پایه و فنی تأییدشده قفل هستند. در این صفحه فقط اطلاعات واقعی بهره‌برداری، اتصال و کنتور قابل ثبت است.
          پیش از ارسال نهایی، <Link className="font-semibold underline" href={`/customer/requests/${id}/documents`}>مدرک اتصال و مدرک کنتور</Link> را بارگذاری کنید.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>مشخصات ثابت نیروگاه</CardTitle>
          <CardDescription>این اطلاعات فقط جهت کنترل نمایش داده می‌شوند و قابل تغییر نیستند.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-sm text-muted-foreground">نام نیروگاه</p><p className="font-medium">{asset.name}</p></div>
          <div><p className="text-sm text-muted-foreground">ظرفیت نامی</p><p className="font-medium">{asset.capacityNominal.toLocaleString("fa-IR")} کیلووات</p></div>
          <div><p className="text-sm text-muted-foreground">موقعیت</p><p className="font-medium">{asset.province}، {asset.city}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>بهره‌برداری و اتصال شبکه</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="operationalDate">تاریخ بهره‌برداری واقعی *</Label><PersianDatePicker id="operationalDate" maxDate={today} value={form.operationalDate} onChange={(value) => setForm({ ...form, operationalDate: value })} /></div>
            <div className="space-y-2"><Label htmlFor="connectionDate">تاریخ اتصال</Label><PersianDatePicker id="connectionDate" maxDate={today} value={form.connectionDate} onChange={(value) => setForm({ ...form, connectionDate: value })} /></div>
            <div className="space-y-2"><Label htmlFor="gridCompany">شرکت برق مرتبط</Label><Input id="gridCompany" value={form.gridCompany} onChange={(event) => setForm({ ...form, gridCompany: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="connectionPoint">نقطه اتصال</Label><Input id="connectionPoint" value={form.connectionPoint} onChange={(event) => setForm({ ...form, connectionPoint: event.target.value })} /></div>
          </div>
          <div className="space-y-3">
            <Label>وضعیت اتصال *</Label>
            <RadioGroup value={form.connectionStatus} onValueChange={(value) => setForm({ ...form, connectionStatus: value })} className="flex flex-wrap gap-5">
              {[{ value: "CONNECTED", label: "متصل" }, { value: "PENDING", label: "در انتظار اتصال" }, { value: "NOT_CONNECTED", label: "غیرمتصل" }].map((option) => (
                <div key={option.value} className="flex items-center gap-2"><RadioGroupItem id={option.value} value={option.value} /><Label htmlFor={option.value}>{option.label}</Label></div>
              ))}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>اطلاعات کنتور</CardTitle><CardDescription>برای ارسال نهایی، شماره سریال کنتور اصلی الزامی است.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          {(["main", "backup"] as const).map((type) => (
            <div key={type} className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">کنتور {type === "main" ? "اصلی *" : "پشتیبان"}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2"><Label htmlFor={`${type}Serial`}>شماره سریال</Label><Input id={`${type}Serial`} value={form[type].serialNumber} onChange={(event) => updateMeter(type, "serialNumber", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`${type}Manufacturer`}>سازنده</Label><Input id={`${type}Manufacturer`} value={form[type].manufacturer} onChange={(event) => updateMeter(type, "manufacturer", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`${type}Model`}>مدل</Label><Input id={`${type}Model`} value={form[type].model} onChange={(event) => updateMeter(type, "model", event.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor={`${type}InstallDate`}>تاریخ نصب</Label><PersianDatePicker id={`${type}InstallDate`} maxDate={today} value={form[type].installDate} onChange={(value) => updateMeter(type, "installDate", value)} /></div>
              </div>
            </div>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="readInterval">تناوب قرائت</Label><select id="readInterval" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.readInterval} onChange={(event) => setForm({ ...form, readInterval: event.target.value })}><option value="HOURLY">ساعتی</option><option value="DAILY">روزانه</option><option value="MONTHLY">ماهانه</option></select></div>
            <div className="space-y-2"><Label htmlFor="dataSource">منبع داده</Label><select id="dataSource" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.dataSource} onChange={(event) => setForm({ ...form, dataSource: event.target.value })}><option value="SMART_METER">کنتور هوشمند</option><option value="API">API</option><option value="MANUAL">دستی</option><option value="SCADA">اسکادا</option></select></div>
          </div>
        </CardContent>
      </Card>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" disabled={savingMode !== null} onClick={() => void save("SAVE_DRAFT")}><Save className="ml-2 h-4 w-4" />ذخیره پیش‌نویس</Button>
        <Button disabled={savingMode !== null} onClick={() => void save("SUBMIT")}>
          {savingMode === "SUBMIT" ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Send className="ml-2 h-4 w-4" />}
          ارسال برای بررسی فنی
        </Button>
      </div>
    </div>
  );
}
