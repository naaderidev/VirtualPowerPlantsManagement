"use client";

import { addPersianMonths, formatApiDate, formatPersianDate, parseApiDate } from "@/lib/persian-date";


import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { getApiErrorMessage } from "@/lib/api-client";
import { Calculator, Loader2, Plus, Pencil } from "lucide-react";

type FinancialConfiguration = {
  id: string;
  name: string;
  taxRate: number | string;
  deductionRate: number | string;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  usageCount: number;
};

const today = formatApiDate(new Date(), "effectiveDate");

function formatPercent(value: number | string): string {
  return `${(Number(value) * 100).toLocaleString("fa-IR", { maximumFractionDigits: 2 })}٪`;
}

async function getFinancialConfigurations(): Promise<FinancialConfiguration[]> {
  const response = await fetch("/api/financial-configurations?limit=100");
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(getApiErrorMessage(body, "دریافت تنظیمات مالی ناموفق بود"));
  return body as FinancialConfiguration[];
}

export default function FinancialConfigurationsPage() {
  const [configurations, setConfigurations] = useState<FinancialConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPeriod, setEditPeriod] = useState({ validFrom: "", validTo: "" });
  const [form, setForm] = useState({
    name: "تنظیم مالی ارائه",
    taxRate: "",
    deductionRate: "0",
    validFrom: today,
    validTo: "",
  });

  useEffect(() => {
    let active = true;
    async function loadConfigurations() {
      try {
        const rows = await getFinancialConfigurations();
        if (active) setConfigurations(rows);
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "دریافت تنظیمات مالی ناموفق بود");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadConfigurations();
    return () => { active = false; };
  }, []);

  const createConfiguration = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/financial-configurations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          taxRate: Number(form.taxRate) / 100,
          deductionRate: Number(form.deductionRate) / 100,
          validFrom: form.validFrom,
          validTo: form.validTo || null,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "ثبت تنظیم مالی ناموفق بود"));
      setSuccess("تنظیم مالی فعال ثبت شد و در محاسبه تسویه قابل استفاده است.");
      setConfigurations(await getFinancialConfigurations());
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "ثبت تنظیم مالی ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  const savePeriod = async (configuration: FinancialConfiguration) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/financial-configurations/${configuration.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ validFrom: editPeriod.validFrom, validTo: editPeriod.validTo || null }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error(getApiErrorMessage(body, "اصلاح بازه تنظیم مالی ناموفق بود"));
      setConfigurations(await getFinancialConfigurations());
      setEditingId(null);
      setSuccess("بازه اعتبار تنظیم مالی اصلاح شد؛ نرخ‌های تسویه‌های ثبت‌شده تغییر نکردند.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "اصلاح بازه تنظیم مالی ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  const ascending = [...configurations].filter((item) => item.active).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const gaps = ascending.flatMap((item, index) => {
    const next = ascending[index + 1];
    return item.validTo && next && item.validTo < next.validFrom
      ? [{ from: item.validTo, to: next.validFrom }] : [];
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">تنظیمات مالی</h1>
        <p className="text-muted-foreground">تعریف نرخ مالیات و کسورات معتبر برای دوره تسویه</p>
        <p className="mt-2 text-sm text-muted-foreground">
          تنظیم مالی یک سیاست مشترک مالیات و کسورات برای همه قراردادهاست؛ برای هر قرارداد تنظیم جدا نسازید.
          تاریخ‌های این صفحه اعتبار این سیاست را تعیین می‌کنند، نه مدت قرارداد یا تاریخ صدور صورتحساب.
          برای هر ماه تسویه، یک تنظیم فعال باید از روز اول آن ماه تا روز اول ماه بعد معتبر باشد.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">صورتحساب ماه‌های آینده پیشاپیش صادر نمی‌شود؛ ابتدا ماه باید تمام شود، قرائت تأیید شود و تسویه نهایی گردد.</p>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {success && <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{success}</div>}
      {gaps.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" role="alert">
        <p className="font-medium">فاصله بدون تنظیم مالی فعال</p>
        {gaps.map((gap) => <p key={`${gap.from}-${gap.to}`}>{formatPersianDate(gap.from)} تا {formatPersianDate(gap.to)}؛ تسویه ماهی که در این فاصله قرار می‌گیرد ممکن نیست. در صورت تأیید مالی، بازه تنظیم استفاده‌نشده را اصلاح کنید.</p>)}
      </div>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <Card>
          <CardHeader>
            <CardTitle>بازه‌های ثبت‌شده</CardTitle>
            <CardDescription>هر دوره تسویه باید به‌طور کامل داخل یکی از بازه‌های فعال باشد؛ یک تنظیم می‌تواند چندین ماه را پوشش دهد.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : configurations.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                هنوز تنظیم مالی ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {configurations.map((configuration) => (
                  <div key={configuration.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{configuration.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatPersianDate(configuration.validFrom)} تا{" "}
                          {configuration.validTo ? formatPersianDate(configuration.validTo) : "بدون تاریخ پایان"}
                        </p>
                      </div>
                      <Badge status={configuration.active ? "ACTIVE" : "INACTIVE"}>
                        {configuration.active ? "فعال" : "غیرفعال"}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">مالیات: </span>{formatPercent(configuration.taxRate)}</div>
                      <div><span className="text-muted-foreground">کسورات: </span>{formatPercent(configuration.deductionRate)}</div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{configuration.usageCount.toLocaleString("fa-IR")} تسویه از این تنظیم استفاده کرده است. پایان بازه غیرشامل است؛ شروع تنظیم بعدی می‌تواند همان روز باشد.</p>
                    {configuration.active && editingId !== configuration.id && <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => {
                      setEditingId(configuration.id);
                      setEditPeriod({ validFrom: configuration.validFrom, validTo: configuration.validTo ?? "" });
                    }}><Pencil className="ml-2 h-3.5 w-3.5" />اصلاح بازه اعتبار</Button>}
                    {editingId === configuration.id && <div className="mt-4 space-y-3 rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">نرخ‌ها ثابت می‌مانند. {configuration.usageCount > 0 ? "این تنظیم در تسویه استفاده شده؛ شروع اعتبار آن قفل است و پایان نباید سوابق را قطع کند." : "این تنظیم هنوز استفاده نشده و بازه آن قابل اصلاح است."}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1"><Label htmlFor={`edit-from-${configuration.id}`}>شروع اعتبار</Label><PersianDatePicker id={`edit-from-${configuration.id}`} value={editPeriod.validFrom} onChange={(value) => setEditPeriod((current) => ({ ...current, validFrom: value }))} maxExclusiveDate={editPeriod.validTo} disabled={configuration.usageCount > 0} /></div>
                        <div className="space-y-1"><Label htmlFor={`edit-to-${configuration.id}`}>پایان اعتبار</Label><PersianDatePicker id={`edit-to-${configuration.id}`} value={editPeriod.validTo} onChange={(value) => setEditPeriod((current) => ({ ...current, validTo: value }))} minExclusiveDate={editPeriod.validFrom} /></div>
                      </div>
                      <div className="flex gap-2"><Button type="button" size="sm" disabled={saving} onClick={() => void savePeriod(configuration)}>{saving ? "در حال ذخیره..." : "ذخیره بازه"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>انصراف</Button></div>
                    </div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />تنظیم مالی جدید</CardTitle>
            <CardDescription>فقط هنگام تغییر مصوب نرخ‌ها نسخه جدید بسازید، نه برای هر قرارداد. بازه‌ها نباید هم‌پوشانی داشته باشند؛ اتصال در روز مرزی مجاز است.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={createConfiguration}>
              <div className="space-y-2">
                <Label htmlFor="name">عنوان *</Label>
                <Input id="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxRate">مالیات (درصد) *</Label>
                  <Input id="taxRate" type="number" min="0" max="100" step="0.01" required value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} />
                  <p className="text-xs text-muted-foreground">مقدار مصوب مالی را وارد کنید؛ نرخ پیش‌فرضی از سند پروژه فرض نشده است.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deductionRate">کسورات (درصد) *</Label>
                  <Input id="deductionRate" type="number" min="0" max="100" step="0.01" required value={form.deductionRate} onChange={(event) => setForm({ ...form, deductionRate: event.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validFrom">شروع اعتبار *</Label>
                  <PersianDatePicker id="validFrom" maxExclusiveDate={form.validTo} required value={form.validFrom} onChange={(value) => setForm({ ...form, validFrom: value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validTo">پایان اعتبار</Label>
                  <PersianDatePicker id="validTo" minExclusiveDate={form.validFrom} value={form.validTo} onChange={(value) => setForm({ ...form, validTo: value })} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => {
                    const start = parseApiDate(form.validFrom);
                    if (start) setForm((current) => ({ ...current, validTo: formatApiDate(addPersianMonths(start, 12), "validTo") }));
                  }}>پیشنهاد پایان یک‌ساله</Button>
                  <p className="text-xs text-muted-foreground">برای پوشش ۱۲ ماه کامل، شروع را روز اول ماه نخست و پایان را روز اول ماه پس از ماه دوازدهم بگذارید؛ پایان می‌تواند باز بماند. بازه‌ها نباید با تنظیم فعال دیگری هم‌پوشانی داشته باشند.</p>
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={saving}>
                {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Plus className="ml-2 h-4 w-4" />}
                ثبت تنظیم فعال
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
