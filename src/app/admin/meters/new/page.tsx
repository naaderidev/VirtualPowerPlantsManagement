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
import { ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { formatApiDate } from "@/lib/persian-date";

interface Asset {
  id: string;
  name: string;
  capacityNominal: number;
}

export default function NewMeterPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    assetId: "",
    type: "MAIN",
    serialNumber: "",
    manufacturer: "",
    model: "",
    readInterval: "DAILY",
    dataSource: "SMART_METER",
    installDate: "",
  });

  useEffect(() => {
    let active = true;
    async function fetchAssets() {
      try {
        const response = await fetch("/api/assets");
        const body = await response.json();
        if (!response.ok) throw new Error(getApiErrorMessage(body, "خطا در دریافت نیروگاه‌ها"));
        if (active) setAssets(Array.isArray(body) ? body : body.items || body.assets || []);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "خطا در دریافت نیروگاه‌ها");
      } finally {
        if (active) setLoading(false);
      }
    }
    void fetchAssets();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/meters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: formData.assetId,
          type: formData.type,
          serialNumber: formData.serialNumber,
          manufacturer: formData.manufacturer || null,
          model: formData.model || null,
          readInterval: formData.readInterval,
          dataSource: formData.dataSource,
          installDate: formData.installDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(getApiErrorMessage(data, "خطا در ایجاد کنتور"));
      }

      router.push("/admin/metering");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در ایجاد کنتور");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold">ثبت کنتور جدید</h1>
          <p className="text-muted-foreground">اضافه کردن کنتور به یک نیروگاه</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            اطلاعات کنتور
          </CardTitle>
          <CardDescription>مشخصات کنتور را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="asset">نیروگاه *</Label>
              <SelectWithLabels value={formData.assetId} onValueChange={(v) => setFormData({ ...formData, assetId: v || "" })}>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">نوع کنتور *</Label>
                <SelectWithLabels value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v || "MAIN" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN">اصلی</SelectItem>
                    <SelectItem value="BACKUP">پشتیبان</SelectItem>
                    <SelectItem value="CHECK">کنترل</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">شماره سریال *</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="شماره سریال کنتور"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">سازنده</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="نام سازنده"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">مدل</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="مدل کنتور"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="readInterval">بازه قرائت *</Label>
                <SelectWithLabels value={formData.readInterval} onValueChange={(v) => setFormData({ ...formData, readInterval: v || "DAILY" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOURLY">ساعتی</SelectItem>
                    <SelectItem value="DAILY">روزانه</SelectItem>
                    <SelectItem value="MONTHLY">ماهانه</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataSource">منبع داده *</Label>
                <SelectWithLabels value={formData.dataSource} onValueChange={(v) => setFormData({ ...formData, dataSource: v || "SMART_METER" })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMART_METER">کنتور هوشمند</SelectItem>
                    <SelectItem value="API">API</SelectItem>
                    <SelectItem value="MANUAL">دستی</SelectItem>
                    <SelectItem value="SCADA">SCADA</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="installDate">تاریخ نصب</Label>
              <PersianDatePicker
                id="installDate"
                maxDate={formatApiDate(new Date(), "installDate")}
                value={formData.installDate}
                onChange={(value) => setFormData({ ...formData, installDate: value })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 ml-2" />
                )}
                ثبت کنتور
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
