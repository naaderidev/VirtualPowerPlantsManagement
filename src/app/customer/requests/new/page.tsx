"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ArrowRight, Info, Loader2 } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatApiDate } from "@/lib/persian-date";

export default function NewRequestPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    plantType: "SOLAR",
    capacity: "",
    province: "",
    city: "",
    operationalStatus: "ACTIVE",
    avgMonthlyGeneration: "",
    hasExistingContract: "NO",
    existingContractStart: "",
    existingContractEnd: "",
    existingContractCounterparty: "",
    existingContractCommittedCapacity: "",
    existingContractExclusive: false,
    existingContractRestrictions: "",
    existingContractRightToSellConfirmed: false,
    contactMobile: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plantType: formData.plantType,
          capacity: formData.capacity,
          province: formData.province,
          city: formData.city,
          operationalStatus: formData.operationalStatus,
          avgMonthlyGeneration: formData.avgMonthlyGeneration || null,
          hasExistingContract: formData.hasExistingContract === "YES",
          existingContractStart: formData.existingContractStart || null,
          existingContractEnd: formData.existingContractEnd || null,
          existingContractCounterparty: formData.existingContractCounterparty || null,
          existingContractCommittedCapacity: formData.existingContractCommittedCapacity || null,
          existingContractExclusive: formData.existingContractExclusive,
          existingContractRestrictions: formData.existingContractRestrictions || null,
          existingContractRightToSellConfirmed: formData.existingContractRightToSellConfirmed,
          contactMobile: formData.contactMobile,
          notes: formData.notes,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(getApiErrorMessage(data, "خطا در ثبت درخواست"));
      }

      const newRequest = await response.json();
      router.push(`/customer/requests/${newRequest.id}`);
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "خطا در ثبت درخواست");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/customer/requests" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">درخواست جدید فروش برق</h1>
          <p className="text-muted-foreground">
            اطلاعات اولیه نیروگاه خود را وارد کنید
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
        برای هر نیروگاه یک درخواست مستقل ثبت کنید. در سناریوی شرکت چندنیروگاهی، این فرم و
        مدارک پرونده برای هر نیروگاه جداگانه تکمیل می‌شود.
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Plant Type */}
            <div className="space-y-3">
              <Label>نوع نیروگاه *</Label>
              <RadioGroup
                value={formData.plantType}
                onValueChange={(value) => setFormData({ ...formData, plantType: value })}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="SOLAR" id="solar" />
                  <Label htmlFor="solar" className="cursor-pointer">خورشیدی</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="WIND" id="wind" />
                  <Label htmlFor="wind" className="cursor-pointer">بادی</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="GAS_TURBINE" id="gas" />
                  <Label htmlFor="gas" className="cursor-pointer">گازی</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="CHP" id="chp" />
                  <Label htmlFor="chp" className="cursor-pointer">تولید هم‌زمان</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="HYDRO" id="hydro" />
                  <Label htmlFor="hydro" className="cursor-pointer">آبی</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="OTHER" id="other" />
                  <Label htmlFor="other" className="cursor-pointer">سایر</Label>
                </div>
              </RadioGroup>
              {formData.operationalStatus !== "ACTIVE" && (
                <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>پرونده می‌تواند تا تنظیم و امضای قرارداد ادامه یابد؛ اما فعال‌سازی، تحویل برق و تسویه تا ثبت بهره‌برداری واقعی، اتصال شبکه و کنتور تأییدشده متوقف می‌ماند.</p>
                </div>
              )}
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <Label htmlFor="capacity">ظرفیت نامی (کیلووات) *</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="مثال: 50"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                required
              />
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="province">استان *</Label>
                <Input
                  id="province"
                  placeholder="مثال: تهران"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">شهر *</Label>
                <Input
                  id="city"
                  placeholder="مثال: ری"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Operational Status */}
            <div className="space-y-3">
              <Label>وضعیت بهره‌برداری *</Label>
              <RadioGroup
                value={formData.operationalStatus}
                onValueChange={(value) => setFormData({ ...formData, operationalStatus: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="ACTIVE" id="active" />
                  <Label htmlFor="active" className="cursor-pointer">فعال</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="UNDER_CONSTRUCTION" id="construction" />
                  <Label htmlFor="construction" className="cursor-pointer">در حال ساخت</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="PLANNING" id="planning" />
                  <Label htmlFor="planning" className="cursor-pointer">در حال برنامه‌ریزی</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Average Generation */}
            <div className="space-y-2">
              <Label htmlFor="avgGeneration">میانگین تقریبی تولید ماهانه (اختیاری)</Label>
              <Input
                id="avgGeneration"
                type="number"
                placeholder="کیلووات‌ساعت"
                value={formData.avgMonthlyGeneration}
                onChange={(e) => setFormData({ ...formData, avgMonthlyGeneration: e.target.value })}
              />
            </div>

            {/* Existing Contract */}
            <div className="space-y-3">
              <Label>قرارداد فروش فعلی دارد؟ *</Label>
              <RadioGroup
                value={formData.hasExistingContract}
                onValueChange={(value) => setFormData({ ...formData, hasExistingContract: value })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="NO" id="noContract" />
                  <Label htmlFor="noContract" className="cursor-pointer">خیر</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value="YES" id="yesContract" />
                  <Label htmlFor="yesContract" className="cursor-pointer">بله</Label>
                </div>
              </RadioGroup>
              {formData.hasExistingContract === "YES" && <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex gap-2 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>وجود قرارداد فعلی باعث رد خودکار نمی‌شود. هم‌پوشانی فقط در صورت قرارداد انحصاری یا نبود ظرفیت آزاد، پیکربندی و فعال‌سازی قرارداد جدید را متوقف می‌کند.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="contractStart">تاریخ شروع قرارداد موجود *</Label><PersianDatePicker id="contractStart" maxDate={formatApiDate(new Date(), "existingContractStart")} maxExclusiveDate={formData.existingContractEnd} value={formData.existingContractStart} onChange={(value) => setFormData({ ...formData, existingContractStart: value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="contractEnd">تاریخ پایان قرارداد موجود *</Label><PersianDatePicker id="contractEnd" minExclusiveDate={formData.existingContractStart} value={formData.existingContractEnd} onChange={(value) => setFormData({ ...formData, existingContractEnd: value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="contractCounterparty">طرف قرارداد موجود *</Label><Input id="contractCounterparty" value={formData.existingContractCounterparty} onChange={(e) => setFormData({ ...formData, existingContractCounterparty: e.target.value })} placeholder="نام خریدار فعلی" required /></div>
                  <div className="space-y-2"><Label htmlFor="committedCapacity">ظرفیت متعهدشده (کیلووات) *</Label><Input id="committedCapacity" type="number" min="0" step="any" value={formData.existingContractCommittedCapacity} onChange={(e) => setFormData({ ...formData, existingContractCommittedCapacity: e.target.value })} required /></div>
                </div>
                <p className="text-xs text-muted-foreground">تاریخ‌های قرارداد موجود را دقیقاً از متن قرارداد وارد کنید؛ سیستم برای دادهٔ واقعیِ ثبت‌نشده تاریخ ساختگی پیشنهاد نمی‌کند. پایان باید بعد از شروع باشد.</p>
                <label className="flex cursor-pointer items-start gap-3 text-sm"><Switch checked={formData.existingContractExclusive} onCheckedChange={(checked) => setFormData({ ...formData, existingContractExclusive: checked })} /><span><strong>قرارداد موجود انحصاری است.</strong><span className="mt-1 block text-muted-foreground">در این حالت برنامه تجاری جدید نباید با بازه قرارداد موجود هم‌پوشانی داشته باشد.</span></span></label>
                <div className="space-y-2"><Label htmlFor="contractRestrictions">محدودیت‌های فروش</Label><Textarea id="contractRestrictions" value={formData.existingContractRestrictions} onChange={(e) => setFormData({ ...formData, existingContractRestrictions: e.target.value })} placeholder="محدودیت فروش به ثالث، نقطه تحویل، شرایط فسخ یا سایر تعهدات" /></div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 text-sm"><Switch checked={formData.existingContractRightToSellConfirmed} onCheckedChange={(checked) => setFormData({ ...formData, existingContractRightToSellConfirmed: checked })} /><span>تأیید می‌کنم اطلاعات قرارداد موجود صحیح است و نسبت به ظرفیت آزاد اعلام‌شده حق فروش دارم. *</span></label>
                <p className="text-xs text-muted-foreground">پس از تأیید اولیه، تصویر قرارداد موجود را در دسته «مدارک حقوقی و قرارداد فروش موجود» بارگذاری کنید.</p>
              </div>}
            </div>

            {/* Contact Mobile */}
            <div className="space-y-2">
              <Label htmlFor="mobile">موبایل و راه تماس *</Label>
              <Input
                id="mobile"
                type="tel"
                placeholder="09121234567"
                value={formData.contactMobile}
                onChange={(e) => setFormData({ ...formData, contactMobile: e.target.value })}
                required
                dir="ltr"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">توضیح تکمیلی (اختیاری)</Label>
              <Textarea
                id="notes"
                placeholder="هر نکته‌ای که لازم می‌دانید..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6">
          <Link href="/customer/requests">
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                در حال ثبت...
              </>
            ) : (
              "ثبت درخواست"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
