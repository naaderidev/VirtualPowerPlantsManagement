"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, FileText, CheckCircle2, Clock } from "lucide-react";

interface Contract {
  id: string;
  contractNumber: string;
  status: string;
  effectiveDate: string;
  expirationDate: string | null;
  notes: string | null;
  parties: Array<{
    party: {
      id: string;
      displayName: string;
    };
    role: string;
  }>;
  assets: Array<{
    asset: {
      name?: string;
      capacity?: number;
      status?: string;
    };
  }>;
  signatures?: Array<{ partyId: string; signedAt: string }>;
  activationReadiness: { ready: boolean; blockers: string[]; awaitingOperation: boolean } | null;
}

interface RequestInfo {
  id: string;
  caseNumber: string;
  status: string;
}

const statusLabels: Record<string, string> = {
  DRAFT: "در حال تنظیم",
  CONFIGURED: "در حال بررسی داخلی",
  INTERNAL_REVIEW: "در حال بررسی",
  NEEDS_CHANGES: "نیاز به اصلاح",
  PENDING_SIGNATURE: "منتظر امضای شما",
  SIGNED: "امضا شده",
  ACTIVE: "فعال",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
};

export default function CustomerContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [contract, setContract] = useState<Contract | null>(null);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Get contract
      if (reqData.contractId) {
        const contractRes = await fetch(`/api/contracts?id=${reqData.contractId}`);
        if (contractRes.ok) {
          const contractData = await contractRes.json();
          setContract(contractData);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!contract) return;
    setSubmitting(true);
    setError(null);

    try {
      const sellerParty = contract.parties.find((party) => party.role === "SELLER");
      if (!sellerParty) throw new Error("طرف فروشنده قرارداد مشخص نشده است");
      const res = await fetch(`/api/contracts/${contract.id}/signatures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: sellerParty.party.id,
          evidenceReference: "CUSTOMER_PORTAL_ACCEPTANCE",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "خطا در امضای قرارداد");
      }
      
      await fetchData();
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

  if (!request || !contract) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        قراردادی یافت نشد
      </div>
    );
  }

  const canSign = contract.status === "PENDING_SIGNATURE";
  const seller = contract.parties.find((p) => p.role === "SELLER");
  const buyer = contract.parties.find((p) => p.role === "BUYER");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/customer/requests/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">قرارداد خرید برق</h1>
          <p className="text-muted-foreground">
            درخواست {request.caseNumber}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
      )}

      {/* وضعیت قرارداد */}
      <Card className={contract.status === "ACTIVE" ? "border-green-500" : contract.status === "PENDING_SIGNATURE" ? "border-yellow-500" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {contract.contractNumber}
            </CardTitle>
            <Badge status={contract.status === "SIGNED" && contract.activationReadiness?.awaitingOperation ? "PENDING" : contract.status} variant={contract.status === "ACTIVE" ? "default" : contract.status === "PENDING_SIGNATURE" ? "secondary" : "outline"}>
              {contract.status === "SIGNED" && contract.activationReadiness?.awaitingOperation
                ? "امضاشده، در انتظار بهره‌برداری"
                : statusLabels[contract.status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">تاریخ شروع</p>
              <p className="font-medium">
                {formatPersianDate(contract.effectiveDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تاریخ پایان</p>
              <p className="font-medium">
                {contract.expirationDate
                  ? formatPersianDate(contract.expirationDate)
                  : "نامحدود"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">فروشنده</p>
              <p className="font-medium">{seller?.party.displayName || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">خریدار</p>
              <p className="font-medium">{buyer?.party.displayName || "-"}</p>
            </div>
          </div>

          {contract.notes && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">توضیحات:</p>
              <p className="text-sm">{contract.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* عملیات */}
      {canSign && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">امضای قرارداد</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              قرارداد آماده امضای شماست. با امضای این قرارداد، فرآیند فعال‌سازی آغاز می‌شود.
            </p>
            <Button onClick={handleSign} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-2" />
              )}
              امضای قرارداد
            </Button>
          </CardContent>
        </Card>
      )}

      {contract.status === "SIGNED" && (
        <div className="p-4 text-sm bg-blue-50 text-blue-700 rounded-lg border border-blue-200">
          <p className="font-medium">{contract.activationReadiness?.ready ? "قرارداد امضا شد و آماده فعال‌سازی است." : contract.activationReadiness?.awaitingOperation ? "قرارداد امضا شده و در انتظار بهره‌برداری نیروگاه است." : "قرارداد امضا شده و پیش از فعال‌سازی نیازمند رفع محدودیت فروش است."}</p>
          {!contract.activationReadiness?.ready && <ul className="mt-2 list-inside list-disc space-y-1">{contract.activationReadiness?.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>}
        </div>
      )}

      {contract.status === "ACTIVE" && (
        <div className="p-4 text-sm bg-green-50 text-green-700 rounded-lg border border-green-200">
          قرارداد فعال است. تحویل برق آغاز شده است.
        </div>
      )}
    </div>
  );
}
