"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import { ContractPeriodFields } from "@/components/contracts/contract-period-fields";
import {
  getContractPeriodIssue,
  suggestContractPeriod,
  type ContractPeriod,
} from "@/domain/contracts/contract-period";

interface RequestInfo {
  id: string;
  caseNumber: string;
  plantType: string;
  capacity: number;
  province: string;
  city: string;
  party: {
    displayName: string;
    nationalId: string | null;
  };
  proposals: Array<{
    pricePerKwh: number;
    duration: number;
    status: string;
    minVolume: number | null;
    maxVolume: number | null;
  }>;
  asset: { operationalDate: string | null } | null;
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

export default function NewContractPage({
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
  const initialPeriod = suggestContractPeriod({});
  const [period, setPeriod] = useState<ContractPeriod>(initialPeriod);
  const [suggestedPeriod, setSuggestedPeriod] = useState<ContractPeriod>(initialPeriod);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/requests/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("خطا در بارگذاری درخواست");
        return response.json() as Promise<RequestInfo>;
      })
      .then((data) => {
        if (!active) return;
        setRequest(data);
        const acceptedProposal = data.proposals.find(({ status }) => status === "ACCEPTED");
        const suggestion = suggestContractPeriod({
          durationMonths: acceptedProposal?.duration,
          operationalDates: [data.asset?.operationalDate],
        });
        setSuggestedPeriod(suggestion);
        setPeriod(suggestion);
      })
      .catch((caughtError: unknown) => {
        if (active) setError(caughtError instanceof Error ? caughtError.message : "خطا در بارگذاری درخواست");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const periodIssue = getContractPeriodIssue(period);
    if (periodIssue) {
      setError(periodIssue.message);
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: id,
          effectiveDate: period.effectiveDate,
          expirationDate: period.expirationDate,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err, "خطا در ایجاد قرارداد"));
      }

      router.push(`/admin/requests/${id}`);
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در ایجاد قرارداد");
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

  const proposal = request.proposals?.find(({ status }) => status === "ACCEPTED");
  const periodIssue = getContractPeriodIssue(period);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/admin/requests/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">تنظیم قرارداد</h1>
          <p className="text-muted-foreground">
            درخواست {request.caseNumber} — {request.party.displayName}
          </p>
        </div>
      </div>

      {/* اطلاعات درخواست و پیشنهاد */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">خلاصه اطلاعات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">مشتری:</span>
              <span className="mr-2 font-medium">{request.party.displayName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">نوع نیروگاه:</span>
              <span className="mr-2 font-medium">{plantTypeLabels[request.plantType]}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ظرفیت:</span>
              <span className="mr-2 font-medium">{request.capacity.toLocaleString()} kW</span>
            </div>
            <div>
              <span className="text-muted-foreground">موقعیت:</span>
              <span className="mr-2 font-medium">{request.province} - {request.city}</span>
            </div>
          </div>
          
          {proposal && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">پیشنهاد پذیرفته شده:</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">قیمت:</span>
                  <span className="mr-2 font-medium">{proposal.pricePerKwh.toLocaleString()} ریال/کیلووات</span>
                </div>
                <div>
                  <span className="text-muted-foreground">مدت:</span>
                  <span className="mr-2 font-medium">{proposal.duration} ماه</span>
                </div>
                {proposal.minVolume && (
                  <div>
                    <span className="text-muted-foreground">حداقل حجم:</span>
                    <span className="mr-2 font-medium">{proposal.minVolume.toLocaleString()} kWh</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* فرم تنظیم قرارداد */}
      <Card>
        <CardHeader>
          <CardTitle>تنظیمات قرارداد</CardTitle>
          <CardDescription>تاریخ شروع و پایان قرارداد را مشخص کنید</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <ContractPeriodFields
              period={period}
              suggestedPeriod={suggestedPeriod}
              suggestionReason={`شروع بر اساس زمان فعلی${request.asset?.operationalDate ? " و تاریخ بهره‌برداری نیروگاه" : ""} و پایان بر اساس مدت ${proposal?.duration ?? 12} ماهه پیشنهاد پذیرفته‌شده محاسبه شده است.`}
              onChange={setPeriod}
            />

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
              <Button type="submit" disabled={submitting || Boolean(periodIssue)}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                ایجاد قرارداد
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
