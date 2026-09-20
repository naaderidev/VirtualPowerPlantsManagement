"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";

interface RequestInfo {
  id: string;
  caseNumber: string;
  plantType: string;
  capacity: number;
  province: string;
  city: string;
  party: {
    displayName: string;
  };
  proposals: Array<{
    id: string;
    pricePerKwh: number;
    status: string;
    customerNote: string | null;
  }>;
}

const plantTypeLabels: Record<string, string> = {
  SOLAR: "خورشیدی",
  WIND: "بادی",
  GAS_TURBINE: "گازی",
  STEAM_TURBINE: "بخاری",
  CHP: "تولید هم‌زمان",
  HYDRO: "آبی",
  BIOGAS: "بیوگاز",
  OTHER: "سایر",
};

export default function NewProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [pricePerKwh, setPricePerKwh] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [maxVolume, setMaxVolume] = useState("");
  const [duration, setDuration] = useState("24");
  const [validDays, setValidDays] = useState("30");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const fetchRequest = async () => {
    try {
      const res = await fetch(`/api/requests/${id}`);
      if (!res.ok) throw new Error("خطا در بارگذاری درخواست");
      const data = await res.json();
      setRequest(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: id,
          pricePerKwh: parseFloat(pricePerKwh),
          minVolume: minVolume ? parseFloat(minVolume) : null,
          maxVolume: maxVolume ? parseFloat(maxVolume) : null,
          duration: parseInt(duration),
          validDays: parseInt(validDays),
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err, "خطا در ارسال پیشنهاد"));
      }

      router.push(`/admin/requests/${id}`);
    } catch (err: any) {
      setError(err.message);
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

  if (!request) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        درخواست یافت نشد
      </div>
    );
  }

  const latestRejectedProposal = request.proposals.find(({ status }) => status === "REJECTED") ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/requests/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">تهیه پیشنهاد قیمت</h1>
          <p className="text-muted-foreground">
            درخواست {request.caseNumber} — {request.party.displayName}
          </p>
        </div>
      </div>

      {/* اطلاعات درخواست */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">اطلاعات درخواست</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">نوع نیروگاه:</span>
              <span className="mr-2 font-medium">{plantTypeLabels[request.plantType]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ظرفیت:</span>
              <span className="mr-2 font-medium">{request.capacity.toLocaleString()} kW</span>
            </div>
            <div>
              <span className="text-muted-foreground">استان:</span>
              <span className="mr-2 font-medium">{request.province}</span>
            </div>
            <div>
              <span className="text-muted-foreground">شهر:</span>
              <span className="mr-2 font-medium">{request.city}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* فرم پیشنهاد */}
      <Card>
        <CardHeader>
          <CardTitle>جزئیات پیشنهاد</CardTitle>
          <CardDescription>قیمت و شرایط پیشنهادی را وارد کنید</CardDescription>
        </CardHeader>
        <CardContent>
          {latestRejectedProposal && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">بازنگری پیشنهاد قبلی</p>
              <p className="mt-1">نرخ قبلی: {latestRejectedProposal.pricePerKwh.toLocaleString("fa-IR")} ریال</p>
              <p className="mt-1">دلیل رد فروشنده: {latestRejectedProposal.customerNote}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pricePerKwh">قیمت هر کیلووات ساعت (ریال) *</Label>
              <Input
                id="pricePerKwh"
                type="number"
                value={pricePerKwh}
                onChange={(e) => setPricePerKwh(e.target.value)}
                placeholder="مثال: 1500"
                required
                min="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minVolume">حداقل حجم خرید (kWh/ماه)</Label>
                <Input
                  id="minVolume"
                  type="number"
                  value={minVolume}
                  onChange={(e) => setMinVolume(e.target.value)}
                  placeholder="اختیاری"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxVolume">حداکثر حجم خرید (kWh/ماه)</Label>
                <Input
                  id="maxVolume"
                  type="number"
                  value={maxVolume}
                  onChange={(e) => setMaxVolume(e.target.value)}
                  placeholder="اختیاری"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">مدت قرارداد (ماه) *</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validDays">اعتبار پیشنهاد (روز)</Label>
                <Input
                  id="validDays"
                  type="number"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">توضیحات</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="توضیحات تکمیلی..."
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                ارسال پیشنهاد
              </Button>
              <Link href={`/admin/requests/${id}`}>
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
