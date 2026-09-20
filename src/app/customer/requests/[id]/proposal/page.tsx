"use client";

import { formatPersianDate, parseApiDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";

interface Proposal {
  id: string;
  pricePerKwh: number;
  currency: string;
  minVolume: number | null;
  maxVolume: number | null;
  duration: number;
  notes: string | null;
  validUntil: string;
  status: string;
  customerNote: string | null;
  createdAt: string;
}

interface RequestInfo {
  id: string;
  caseNumber: string;
  status: string;
  plantType: string;
  capacity: number;
  party: {
    displayName: string;
  };
}

const statusLabels: Record<string, string> = {
  PENDING: "در انتظار بررسی",
  ACCEPTED: "پذیرفته شده",
  REJECTED: "رد شده",
  EXPIRED: "منقضی شده",
  CANCELLED: "لغو شده",
};

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

export default function CustomerProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // Get request info
      const reqRes = await fetch(`/api/requests/${id}`);
      if (!reqRes.ok) throw new Error("خطا در بارگذاری درخواست");
      const reqData = await reqRes.json();
      setRequest(reqData);

      // Get proposal
      const propRes = await fetch(`/api/proposals?requestId=${id}`);
      const propData = await propRes.json();
      if (!propRes.ok) throw new Error("خطا در بارگذاری پیشنهاد");
      const proposalHistory = propData.proposals ?? [];
      setProposals(proposalHistory);
      setProposal(proposalHistory[0] ?? null);
      setFetchedAt(Date.now());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در بارگذاری پیشنهاد");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!proposal) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: proposal.id,
          status: "ACCEPTED",
        }),
      });

      if (!res.ok) throw new Error("خطا در پذیرش پیشنهاد");
      
      await fetchData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در پذیرش پیشنهاد");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!proposal) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: proposal.id,
          status: "REJECTED",
          customerNote: rejectNote || null,
        }),
      });

      if (!res.ok) {
        const payload = await res.json();
        throw new Error(getApiErrorMessage(payload, "خطا در رد پیشنهاد"));
      }
      
      await fetchData();
      setShowRejectForm(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در رد پیشنهاد");
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

  if (!request || !proposal) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        پیشنهادی یافت نشد
      </div>
    );
  }

  const isValid = (parseApiDate(proposal.validUntil)?.getTime() ?? 0) > fetchedAt;
  const canAct = proposal.status === "PENDING" && isValid;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/customer/requests/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">پیشنهاد قیمت</h1>
          <p className="text-muted-foreground">
            درخواست {request.caseNumber}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
      )}

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
          </div>
        </CardContent>
      </Card>

      {/* پیشنهاد */}
      <Card className={proposal.status === "ACCEPTED" ? "border-green-500" : proposal.status === "REJECTED" ? "border-destructive" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              جزئیات پیشنهاد
            </CardTitle>
            <Badge status={proposal.status} variant={proposal.status === "ACCEPTED" ? "default" : proposal.status === "REJECTED" ? "destructive" : "secondary"}>
              {statusLabels[proposal.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">قیمت پیشنهادی</p>
              <p className="text-2xl font-bold text-primary">
                {proposal.pricePerKwh.toLocaleString()} ریال
              </p>
              <p className="text-xs text-muted-foreground">هر کیلووات ساعت</p>
            </div>
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">مدت قرارداد</p>
              <p className="text-2xl font-bold">{proposal.duration} ماه</p>
            </div>
          </div>

          {(proposal.minVolume || proposal.maxVolume) && (
            <div className="grid grid-cols-2 gap-4">
              {proposal.minVolume && (
                <div>
                  <p className="text-sm text-muted-foreground">حداقل حجم خرید</p>
                  <p className="font-medium">{proposal.minVolume.toLocaleString()} kWh/ماه</p>
                </div>
              )}
              {proposal.maxVolume && (
                <div>
                  <p className="text-sm text-muted-foreground">حداکثر حجم خرید</p>
                  <p className="font-medium">{proposal.maxVolume.toLocaleString()} kWh/ماه</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">اعتبار تا:</span>
            <span className={isValid ? "" : "text-destructive"}>
              {formatPersianDate(proposal.validUntil)}
            </span>
            {!isValid && <Badge status="EXPIRED">منقضی شده</Badge>}
          </div>

          {proposal.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">توضیحات:</p>
              <p className="text-sm">{proposal.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* عملیات */}
      {canAct && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">انتخاب شما</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showRejectForm ? (
              <div className="flex gap-2">
                <Button onClick={handleAccept} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                  )}
                  پذیرش پیشنهاد
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4 ml-2" />
                  رد پیشنهاد
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="rejectNote">دلیل رد *</Label>
                  <Textarea
                    id="rejectNote"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="دلیل رد پیشنهاد..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={handleReject} disabled={submitting || !rejectNote.trim()}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 ml-2" />
                    )}
                    تایید رد
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectForm(false)} disabled={submitting}>
                    انصراف
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {proposal.status === "ACCEPTED" && (
        <div className="p-4 text-sm bg-green-50 text-green-700 rounded-lg border border-green-200">
          پیشنهاد پذیرفته شد. قرارداد در حال تنظیم است.
        </div>
      )}

      {proposal.status === "REJECTED" && (
        <div className="p-4 text-sm bg-amber-50 text-amber-900 rounded-lg border border-amber-200">
          پیشنهاد رد شد و برای بازنگری به کارشناس تأمین برگشت.
          {proposal.customerNote && <p className="mt-1">دلیل: {proposal.customerNote}</p>}
        </div>
      )}

      {proposals.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">تاریخچه پیشنهادها</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proposals.map((item, index) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">دور {proposals.length - index}: {item.pricePerKwh.toLocaleString("fa-IR")} ریال</p>
                  {item.customerNote && <p className="mt-1 text-xs text-muted-foreground">دلیل رد: {item.customerNote}</p>}
                </div>
                <Badge status={item.status} variant={item.status === "ACCEPTED" ? "default" : item.status === "REJECTED" ? "destructive" : "secondary"}>
                  {statusLabels[item.status] ?? getStatusLabel(item.status)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
