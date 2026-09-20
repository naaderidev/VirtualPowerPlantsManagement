"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Textarea } from "@/components/ui/textarea";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2, DollarSign } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { addPersianMonths, formatApiDate, parseApiDate } from "@/lib/persian-date";

export default function NewPricingPlanPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    model: "FIXED",
    fixedRate: "",
    fixedRateHybrid: "",
    fixedSharePct: "",
    marketSharePct: "",
    multiplier: "1",
    differential: "0",
    floorValue: "",
    ceilingValue: "",
    marketName: "",
    indexName: "",
    indexSource: "",
    indexTimeframe: "MONTHLY",
    averagingMethod: "PERIOD_VALUE",
    currency: "IRR",
    validFrom: formatApiDate(new Date(), "validFrom"),
    validTo: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/pricing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          fixedRate: formData.fixedRate ? parseFloat(formData.fixedRate) : null,
          fixedRateHybrid: formData.fixedRateHybrid ? parseFloat(formData.fixedRateHybrid) : null,
          fixedSharePct: formData.fixedSharePct ? parseFloat(formData.fixedSharePct) : null,
          marketSharePct: formData.marketSharePct ? parseFloat(formData.marketSharePct) : null,
          multiplier: parseFloat(formData.multiplier) || 1,
          differential: parseFloat(formData.differential) || 0,
          floorValue: formData.floorValue ? parseFloat(formData.floorValue) : null,
          ceilingValue: formData.ceilingValue ? parseFloat(formData.ceilingValue) : null,
          validTo: formData.validTo || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(getApiErrorMessage(data, "خطا در ایجاد طرح"));
      }

      router.push("/admin/pricing");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطای ناشناخته در ایجاد نرخ‌نامه");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/pricing" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">طرح قیمت‌گذاری جدید</h1>
          <p className="text-muted-foreground">ثبت طرح قیمت‌گذاری جدید</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            اطلاعات طرح
          </CardTitle>
          <CardDescription>مشخصات طرح قیمت‌گذاری را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">نام طرح *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: تعرفه خورشیدی"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">کد طرح *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="SOLAR-001"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model">مدل قیمت *</Label>
                <SelectWithLabels
                  value={formData.model}
                  onValueChange={(value) => setFormData({ ...formData, model: value || "FIXED" })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">قیمت ثابت</SelectItem>
                    <SelectItem value="MARKET_INDEX">شاخص بازار</SelectItem>
                    <SelectItem value="HYBRID">ترکیبی</SelectItem>
                    <SelectItem value="FLOOR">کف قیمت</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fixedRate">نرخ ثابت (ریال/kWh)</Label>
                <Input
                  id="fixedRate"
                  type="number"
                  value={formData.fixedRate}
                  onChange={(e) => setFormData({ ...formData, fixedRate: e.target.value })}
                  placeholder="3000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="multiplier">ضریب</Label>
                <Input
                  id="multiplier"
                  type="number"
                  value={formData.multiplier}
                  onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                  placeholder="1"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="differential">متمم (ریال)</Label>
                <Input
                  id="differential"
                  type="number"
                  value={formData.differential}
                  onChange={(e) => setFormData({ ...formData, differential: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            {formData.model === "HYBRID" && (
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fixedRateHybrid">نرخ بخش ثابت</Label>
                  <Input id="fixedRateHybrid" type="number" min="0" value={formData.fixedRateHybrid} onChange={(e) => setFormData({ ...formData, fixedRateHybrid: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fixedSharePct">درصد نرخ ثابت (%)</Label>
                  <Input
                    id="fixedSharePct"
                    type="number"
                    value={formData.fixedSharePct}
                    onChange={(e) => setFormData({ ...formData, fixedSharePct: e.target.value })}
                    placeholder="70"
                    min="0"
                    max="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marketSharePct">درصد شاخص بازار (%)</Label>
                  <Input
                    id="marketSharePct"
                    type="number"
                    value={formData.marketSharePct}
                    onChange={(e) => setFormData({ ...formData, marketSharePct: e.target.value })}
                    placeholder="30"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
            )}

            {["MARKET_INDEX", "HYBRID", "FLOOR"].includes(formData.model) && (
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm font-medium">مشخصات شاخص بازار</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="indexName">نام شاخص *</Label>
                    <Input id="indexName" value={formData.indexName} onChange={(e) => setFormData({ ...formData, indexName: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="indexSource">منبع رسمی *</Label>
                    <Input id="indexSource" value={formData.indexSource} onChange={(e) => setFormData({ ...formData, indexSource: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marketName">نام بازار</Label>
                    <Input id="marketName" value={formData.marketName} onChange={(e) => setFormData({ ...formData, marketName: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="indexTimeframe">بازه شاخص</Label>
                    <Input id="indexTimeframe" value={formData.indexTimeframe} onChange={(e) => setFormData({ ...formData, indexTimeframe: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="floorValue">کف قیمت واحد</Label>
                <Input id="floorValue" type="number" min="0" value={formData.floorValue} onChange={(e) => setFormData({ ...formData, floorValue: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ceilingValue">سقف قیمت واحد</Label>
                <Input id="ceilingValue" type="number" min="0" value={formData.ceilingValue} onChange={(e) => setFormData({ ...formData, ceilingValue: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">تاریخ شروع *</Label>
                <PersianDatePicker
                  id="validFrom"
                  maxExclusiveDate={formData.validTo}
                  value={formData.validFrom}
                  onChange={(value) => setFormData({ ...formData, validFrom: value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validTo">تاریخ پایان</Label>
                <PersianDatePicker
                  id="validTo"
                  minExclusiveDate={formData.validFrom}
                  value={formData.validTo}
                  onChange={(value) => setFormData({ ...formData, validTo: value })}
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => {
                  const start = parseApiDate(formData.validFrom);
                  if (start) setFormData((current) => ({ ...current, validTo: formatApiDate(addPersianMonths(start, 12), "validTo") }));
                }}>پیشنهاد پایان یک‌ساله</Button>
                <p className="text-xs text-muted-foreground">پایان اختیاری است؛ یک سال صرفاً پیشنهاد اولیه است و باید با قراردادهای استفاده‌کننده از نرخ‌نامه سازگار باشد.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">توضیحات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="توضیحات اضافی..."
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 ml-2" />
                )}
                ایجاد طرح
              </Button>
              <Link href="/admin/pricing">
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
