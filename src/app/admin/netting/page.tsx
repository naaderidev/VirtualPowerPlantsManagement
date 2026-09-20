"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectContent, SelectItem, SelectTrigger, SelectValue, SelectWithLabels } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-client";
import { Calculator, CheckCircle2, FileCheck2, Loader2, Send, Shield, XCircle } from "lucide-react";

type Contract = {
  id: string;
  contractNumber: string;
  status: string;
  nettingEnabled: boolean;
  assets: Array<{ asset: { name: string } }>;
  parties: Array<{ role: string; party: { displayName: string } }>;
};

type Group = {
  id: string;
  name: string;
  code: string;
  currency: string;
  party: { displayName: string };
  contracts: Array<{ id: string; contractNumber: string }>;
};

type EligibleSettlement = {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  netAmount: number;
  asset: { name: string };
};

type Approval = {
  id: string;
  type: "FINANCIAL" | "LEGAL";
  decision: "APPROVED" | "REJECTED";
  reviewer: { name: string };
};

type Batch = {
  id: string;
  batchNumber: string;
  status: string;
  totalReceivable: string;
  totalPayable: string;
  netAmount: string;
  items: Array<{
    id: string;
    direction: "RECEIVABLE" | "PAYABLE";
    amount: string;
    settlement: {
      settlementNumber: string;
      asset: { name: string };
    };
  }>;
  approvals: Approval[];
  statement: null | {
    id: string;
    statementNumber: string;
    direction: "RECEIVABLE" | "PAYABLE";
    amount: string;
    paidAmount: string;
    status: string;
    dueDate: string;
  };
};

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  FINANCIAL_REVIEW: "در انتظار تأیید مالی",
  LEGAL_REVIEW: "در انتظار تأیید حقوقی",
  APPROVED: "تأیید نهایی",
  POSTED: "ثبت قطعی",
  REJECTED: "رد شده",
  CANCELLED: "لغو شده",
};

function formatMoney(value: string | number) {
  return `${Number(value).toLocaleString("fa-IR")} ریال`;
}

function samePeriod(left: EligibleSettlement, right: EligibleSettlement) {
  return left.periodStart === right.periodStart && left.periodEnd === right.periodEnd;
}

export default function NettingPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [enabled, setEnabled] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [eligible, setEligible] = useState<EligibleSettlement[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedSettlementIds, setSelectedSettlementIds] = useState<string[]>([]);
  const [batchIdempotencyKey, setBatchIdempotencyKey] = useState("");
  const [groupForm, setGroupForm] = useState({ name: "", code: "", contractId: "", legalBasis: "" });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadGroupsAndContracts = useCallback(async () => {
    const [groupsResponse, contractsResponse] = await Promise.all([
      fetch("/api/netting/groups"),
      fetch("/api/contracts?limit=100"),
    ]);
    const groupsBody = await groupsResponse.json().catch(() => null);
    const contractsBody = await contractsResponse.json().catch(() => null);
    if (!groupsResponse.ok) throw new Error(getApiErrorMessage(groupsBody, "خطا در دریافت گروه‌های خالص‌سازی"));
    if (!contractsResponse.ok) throw new Error(getApiErrorMessage(contractsBody, "خطا در دریافت قراردادها"));
    setEnabled(Boolean(groupsBody.enabled));
    setGroups(groupsBody.groups);
    setContracts(contractsBody);
    setSelectedGroupId((current) => current || groupsBody.groups[0]?.id || "");
  }, []);

  const loadBatches = useCallback(async (groupId: string) => {
    if (!groupId) {
      setEligible([]);
      setBatches([]);
      return;
    }
    const response = await fetch(`/api/netting/batches?groupId=${encodeURIComponent(groupId)}&limit=100`);
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(getApiErrorMessage(body, "خطا در دریافت دسته‌های خالص‌سازی"));
    setEligible(body.eligibleSettlements);
    setBatches(body.batches);
  }, []);

  useEffect(() => {
    // The initial client fetch hydrates this operational dashboard from the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGroupsAndContracts()
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره"))
      .finally(() => setLoading(false));
  }, [loadGroupsAndContracts]);

  useEffect(() => {
    // Changing the selected group intentionally refreshes its remote batch state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBatches(selectedGroupId).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره")
    );
  }, [loadBatches, selectedGroupId]);

  const availableContracts = useMemo(
    () => contracts.filter((contract) => ["ACTIVE", "TERMINATION_PENDING"].includes(contract.status) && contract.nettingEnabled && contract.assets.length >= 2 && !groups.some((group) => group.contracts.some(({ id }) => id === contract.id))),
    [contracts, groups]
  );

  function selectGroup(groupId: string) {
    setSelectedGroupId(groupId);
    setSelectedSettlementIds([]);
    setBatchIdempotencyKey("");
  }

  async function createGroup() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/netting/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(body, "ایجاد گروه خالص‌سازی ناموفق بود"));
      await loadGroupsAndContracts();
      selectGroup(body.id);
      setGroupForm({ name: "", code: "", contractId: "", legalBasis: "" });
      setMessage("گروه خالص‌سازی ایجاد و به قرارداد مادر متصل شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setBusy(false);
    }
  }

  function toggleSettlement(settlement: EligibleSettlement) {
    setBatchIdempotencyKey(`netting-${crypto.randomUUID()}`);
    setSelectedSettlementIds((current) => {
      if (current.includes(settlement.id)) return current.filter((id) => id !== settlement.id);
      const first = eligible.find(({ id }) => id === current[0]);
      if (first && !samePeriod(first, settlement)) {
        setError("فقط تسویه‌های مربوط به یک دوره مشترک را انتخاب کنید.");
        return current;
      }
      setError("");
      return [...current, settlement.id];
    });
  }

  async function createBatch() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/netting/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroupId,
          settlementIds: selectedSettlementIds,
          idempotencyKey: batchIdempotencyKey,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(body, "محاسبه خالص‌سازی ناموفق بود"));
      await loadBatches(selectedGroupId);
      setSelectedSettlementIds([]);
      setBatchIdempotencyKey("");
      setMessage(body.idempotentReplay ? "نتیجه قبلی بدون ایجاد رکورد تکراری بازیابی شد." : "دسته خالص‌سازی به‌صورت پیش‌نویس محاسبه شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setBusy(false);
    }
  }

  async function updateBatch(batchId: string, action: "SUBMIT" | "APPROVE" | "REJECT") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const notes = reviewNotes[batchId]?.trim();
      const response = await fetch(`/api/netting/batches/${batchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action !== "SUBMIT" && notes ? { notes } : {}) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(body, "تغییر وضعیت دسته ناموفق بود"));
      await loadBatches(selectedGroupId);
      setMessage(action === "APPROVE" ? "تأیید با موفقیت ثبت شد." : action === "REJECT" ? "دسته رد و قفل تسویه‌ها آزاد شد." : "دسته برای تأیید مالی ارسال شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setBusy(false);
    }
  }

  async function issueStatement(batchId: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/netting/batches/${batchId}/statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: `statement-${batchId}` }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(body, "صدور سند خالص‌سازی ناموفق بود"));
      await loadBatches(selectedGroupId);
      setMessage(body.idempotentReplay ? "سند مالی موجود بازیابی شد." : "سند مالی خالص‌سازی صادر شد.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Shield className="h-6 w-6" />خالص‌سازی</h1><p className="text-muted-foreground">تجمیع قابل حسابرسی تسویه‌های تأییدشده با تأیید مستقل مالی و حقوقی</p></div>
      {!enabled && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">قابلیت خالص‌سازی در تنظیمات محیط غیرفعال است؛ هیچ عملیات تغییردهنده‌ای اجرا نمی‌شود.</div>}
      {error && <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {message && <div role="status" className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>}

      {role === "ADMIN" && (
        <Card><CardHeader><CardTitle>۱. ایجاد گروه برای قرارداد مادر</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="group-name">نام گروه</Label><Input id="group-name" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="خالص‌سازی شرکت نمونه" /></div>
          <div className="space-y-2"><Label htmlFor="group-code">کد گروه</Label><Input id="group-code" dir="ltr" value={groupForm.code} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} placeholder="COMPANY-1405" /></div>
          <div className="space-y-2 md:col-span-2"><Label>قرارداد مادر فعال</Label><SelectWithLabels value={groupForm.contractId || null} onValueChange={(value) => setGroupForm({ ...groupForm, contractId: value ?? "" })}><SelectTrigger className="w-full" aria-label="انتخاب قرارداد مادر"><SelectValue placeholder="قرارداد را انتخاب کنید" /></SelectTrigger><SelectContent>{availableContracts.map((contract) => <SelectItem key={contract.id} value={contract.id}>{contract.contractNumber} — {contract.parties.find(({ role: partyRole }) => partyRole === "SELLER")?.party.displayName ?? "فروشنده نامشخص"} — {contract.assets.length.toLocaleString("fa-IR")} نیروگاه{!contract.nettingEnabled ? " (خالص‌سازی غیرفعال)" : ""}</SelectItem>)}</SelectContent></SelectWithLabels></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="legal-basis">مبنای حقوقی</Label><Textarea id="legal-basis" value={groupForm.legalBasis} onChange={(event) => setGroupForm({ ...groupForm, legalBasis: event.target.value })} placeholder="بند قرارداد یا مجوز خالص‌سازی" /></div>
          <div className="md:col-span-2"><Button onClick={createGroup} disabled={busy || !enabled || !groupForm.name.trim() || !groupForm.code.trim() || !groupForm.contractId || !groupForm.legalBasis.trim()}>{busy && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}ایجاد گروه</Button></div>
        </CardContent></Card>
      )}

      <Card><CardHeader><CardTitle>۲. انتخاب گروه و تسویه‌های هم‌دوره</CardTitle></CardHeader><CardContent className="space-y-4">
        {groups.length === 0 ? <p className="text-sm text-muted-foreground">هنوز گروه خالص‌سازی معتبری ایجاد نشده است.</p> : <>
          <SelectWithLabels value={selectedGroupId || null} onValueChange={(value) => selectGroup(value ?? "")}><SelectTrigger className="w-full" aria-label="انتخاب گروه خالص‌سازی"><SelectValue placeholder="گروه را انتخاب کنید" /></SelectTrigger><SelectContent>{groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.name} — {group.party.displayName} — {group.currency}</SelectItem>)}</SelectContent></SelectWithLabels>
          {eligible.length === 0 ? <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">برای این گروه حداقل دو تسویه تأییدشده، هم‌دوره و استفاده‌نشده لازم است.</p> : <Table><TableHeader><TableRow><TableHead>انتخاب</TableHead><TableHead>تسویه</TableHead><TableHead>نیروگاه</TableHead><TableHead>دوره</TableHead><TableHead>مبلغ</TableHead></TableRow></TableHeader><TableBody>{eligible.map((settlement) => { const selected = selectedSettlementIds.includes(settlement.id); return <TableRow key={settlement.id} data-state={selected ? "selected" : undefined}><TableCell><input type="checkbox" className="h-4 w-4" aria-label={`انتخاب ${settlement.settlementNumber}`} checked={selected} onChange={() => toggleSettlement(settlement)} /></TableCell><TableCell className="font-mono">{settlement.settlementNumber}</TableCell><TableCell>{settlement.asset.name}</TableCell><TableCell>{formatPersianDate(settlement.periodStart)} تا {formatPersianDate(settlement.periodEnd)}</TableCell><TableCell>{formatMoney(settlement.netAmount)}</TableCell></TableRow>; })}</TableBody></Table>}
          {(role === "ADMIN" || role === "STAFF_FINANCIAL") && <Button onClick={createBatch} disabled={busy || !enabled || selectedSettlementIds.length < 2 || !batchIdempotencyKey}><Calculator className="ml-2 h-4 w-4" />محاسبه پیش‌نویس خالص</Button>}
        </>}
      </CardContent></Card>

      <div className="space-y-4"><h2 className="text-xl font-semibold">۳. گردش تأیید دسته‌ها</h2>
        {batches.length === 0 && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">دسته‌ای برای این گروه ثبت نشده است.</CardContent></Card>}
        {batches.map((batch) => {
          const canSubmit = batch.status === "DRAFT" && (role === "ADMIN" || role === "STAFF_FINANCIAL");
          const canReview = (batch.status === "FINANCIAL_REVIEW" && role === "STAFF_FINANCIAL") || (batch.status === "LEGAL_REVIEW" && role === "STAFF_LEGAL");
          return <Card key={batch.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="font-mono">{batch.batchNumber}</CardTitle><Badge status={batch.status} variant={batch.status === "REJECTED" ? "destructive" : batch.status === "APPROVED" ? "default" : "secondary"}>{statusLabels[batch.status] ?? getStatusLabel(batch.status)}</Badge></div></CardHeader><CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">جمع دریافتنی</p><p className="font-bold">{formatMoney(batch.totalReceivable)}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">جمع پرداختنی</p><p className="font-bold">{formatMoney(batch.totalPayable)}</p></div><div className="rounded-lg bg-primary/10 p-3"><p className="text-xs text-muted-foreground">مبلغ خالص</p><p className="font-bold text-primary">{formatMoney(batch.netAmount)}</p></div></div>
            <Table><TableHeader><TableRow><TableHead>تسویه مبنا</TableHead><TableHead>نیروگاه</TableHead><TableHead>جهت</TableHead><TableHead>مبلغ snapshot</TableHead></TableRow></TableHeader><TableBody>{batch.items.map((item) => <TableRow key={item.id}><TableCell className="font-mono">{item.settlement.settlementNumber}</TableCell><TableCell>{item.settlement.asset.name}</TableCell><TableCell>{item.direction === "RECEIVABLE" ? "دریافتنی" : "پرداختنی"}</TableCell><TableCell>{formatMoney(item.amount)}</TableCell></TableRow>)}</TableBody></Table>
            <div className="grid gap-3 md:grid-cols-2">{(["FINANCIAL", "LEGAL"] as const).map((type) => { const approval = batch.approvals.find((item) => item.type === type); return <div key={type} className="rounded-lg border p-3"><p className="flex items-center gap-2 font-medium">{approval?.decision === "APPROVED" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <FileCheck2 className="h-4 w-4 text-muted-foreground" />}{type === "FINANCIAL" ? "تأیید مالی" : "تأیید حقوقی"}</p><p className="mt-1 text-sm text-muted-foreground">{approval ? `${approval.reviewer.name} — ${approval.decision === "APPROVED" ? "تأیید شد" : "رد شد"}` : "هنوز تصمیمی ثبت نشده است."}</p></div>; })}</div>
            {batch.status === "APPROVED" && (role === "ADMIN" || role === "STAFF_FINANCIAL") && <Button onClick={() => issueStatement(batch.id)} disabled={busy}><FileCheck2 className="ml-2 h-4 w-4" />صدور سند مالی خالص‌سازی</Button>}
            {batch.statement && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><div><p className="font-medium">سند {batch.statement.statementNumber}</p><p className="text-sm text-muted-foreground">{batch.statement.direction === "RECEIVABLE" ? "قابل پرداخت به فروشنده" : "قابل دریافت از فروشنده"} · سررسید {formatPersianDate(batch.statement.dueDate)}</p></div><div className="text-left"><Badge status={batch.statement.status}>{batch.statement.status === "PAID" ? "پرداخت‌شده" : batch.statement.status === "PARTIALLY_PAID" ? "پرداخت جزئی" : "صادرشده"}</Badge><p className="mt-1 font-bold">{formatMoney(batch.statement.amount)}</p>{["ISSUED", "PARTIALLY_PAID"].includes(batch.statement.status) && <Link href={`/admin/payments?statementId=${encodeURIComponent(batch.statement.id)}`} className={buttonVariants({ variant: "link", className: "px-0" })}>ثبت و تخصیص پرداخت</Link>}</div></div>}
            {(canSubmit || canReview) && <div className="space-y-3 border-t pt-4">{canReview && <Textarea aria-label="یادداشت بررسی" value={reviewNotes[batch.id] ?? ""} onChange={(event) => setReviewNotes({ ...reviewNotes, [batch.id]: event.target.value })} placeholder="یادداشت اختیاری برای تأیید؛ دلیل برای رد الزامی است" />}<div className="flex flex-wrap gap-2">{canSubmit && <Button onClick={() => updateBatch(batch.id, "SUBMIT")} disabled={busy}><Send className="ml-2 h-4 w-4" />ارسال برای تأیید مالی</Button>}{canReview && <><Button onClick={() => updateBatch(batch.id, "APPROVE")} disabled={busy}><CheckCircle2 className="ml-2 h-4 w-4" />تأیید</Button><Button variant="destructive" onClick={() => updateBatch(batch.id, "REJECT")} disabled={busy || !(reviewNotes[batch.id]?.trim())}><XCircle className="ml-2 h-4 w-4" />رد با ذکر دلیل</Button></>}</div></div>}
          </CardContent></Card>;
        })}
      </div>
    </div>
  );
}
