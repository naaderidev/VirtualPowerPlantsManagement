"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Search, Zap } from "lucide-react";
import { ContractPeriodFields } from "@/components/contracts/contract-period-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getContractPeriodIssue, suggestContractPeriod, type ContractPeriod } from "@/domain/contracts/contract-period";
import { getApiErrorMessage } from "@/lib/api-client";

type ContractCreationMode = "SINGLE" | "MASTER";

type EligibleRequest = {
  id: string;
  caseNumber: string;
  partyId: string;
  capacity: number;
  createdAt: string;
  party: { displayName: string; type: string };
  asset: { id: string; name: string; capacityNominal: number; operationalDate: string | null } | null;
  proposals: Array<{ duration: number }>;
};

type EligibleRequestResponse = {
  requests: EligibleRequest[];
  initialRequest: EligibleRequest | null;
  pagination: { page: number; limit: number; total: number; pages: number };
};

const PAGE_SIZE = 10;

function getInitialMode(value?: string): ContractCreationMode {
  return value?.toLowerCase() === "master" ? "MASTER" : "SINGLE";
}

function suggestPeriod(requests: readonly EligibleRequest[]): ContractPeriod {
  const durationMonths = Math.max(1, ...requests.map(({ proposals }) => proposals[0]?.duration ?? 12));
  return suggestContractPeriod({
    durationMonths,
    operationalDates: requests.map(({ asset }) => asset?.operationalDate),
  });
}

function defaultNotes(mode: ContractCreationMode): string {
  return mode === "MASTER"
    ? "توافق‌نامه مادر شرکت با دو نیروگاه مستقل"
    : "قرارداد خرید برق تک‌نیروگاهی";
}

export default function NewContractPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ mode?: string; requestId?: string }> }>) {
  const query = use(searchParams);
  const router = useRouter();
  const [mode, setMode] = useState<ContractCreationMode>(() => getInitialMode(query.mode));
  const [requests, setRequests] = useState<EligibleRequest[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<EligibleRequest[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<ContractPeriod>(() => suggestContractPeriod({}));
  const [notes, setNotes] = useState(() => defaultNotes(getInitialMode(query.mode)));
  const initialSelectionHandled = useRef(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ mode, page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set("search", search);
    if (!initialSelectionHandled.current && query.requestId) params.set("requestId", query.requestId);

    void fetch(`/api/contracts/eligible-requests?${params.toString()}`)
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(getApiErrorMessage(body, "دریافت پرونده‌های واجد شرایط ناموفق بود."));
        return body as EligibleRequestResponse;
      })
      .then((body) => {
        if (!active) return;
        setRequests(body.requests);
        setPagination(body.pagination);
        if (!initialSelectionHandled.current) {
          initialSelectionHandled.current = true;
          if (body.initialRequest) {
            setSelectedRequests([body.initialRequest]);
            setPeriod(suggestPeriod([body.initialRequest]));
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [mode, page, query.requestId, search]);

  const selectedIds = useMemo(() => new Set(selectedRequests.map(({ id }) => id)), [selectedRequests]);
  const selectedPartyId = selectedRequests[0]?.partyId ?? null;
  const normalizedSearchInput = searchInput.trim();
  const canApplySearch = normalizedSearchInput.length > 0 && (normalizedSearchInput !== search || page !== 1) && !loading;
  const requiredSelectionCount = mode === "MASTER" ? 2 : 1;
  const selectionComplete = selectedRequests.length === requiredSelectionCount;
  const suggestedPeriod = useMemo(() => suggestPeriod(selectedRequests), [selectedRequests]);
  const periodIssue = selectedRequests.length > 0 ? getContractPeriodIssue(period) : null;

  function changeMode(nextMode: ContractCreationMode) {
    if (nextMode === mode) return;
    initialSelectionHandled.current = true;
    setMode(nextMode);
    setPage(1);
    setLoading(true);
    setSelectedRequests([]);
    setPeriod(suggestContractPeriod({}));
    setNotes(defaultNotes(nextMode));
    setError("");
  }

  function selectRequest(request: EligibleRequest) {
    setError("");
    if (mode === "SINGLE") {
      const nextSelection = selectedIds.has(request.id) ? [] : [request];
      setSelectedRequests(nextSelection);
      setPeriod(suggestPeriod(nextSelection));
      return;
    }

    if (selectedIds.has(request.id)) {
      const nextSelection = selectedRequests.filter(({ id }) => id !== request.id);
      setSelectedRequests(nextSelection);
      setPeriod(suggestPeriod(nextSelection));
      return;
    }
    if (selectedRequests.length >= 2) return;
    if (selectedPartyId && selectedPartyId !== request.partyId) {
      setError("هر دو پرونده توافق‌نامه مادر باید متعلق به یک شرکت باشند.");
      return;
    }
    const nextSelection = [...selectedRequests, request].sort(
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
    setSelectedRequests(nextSelection);
    setPeriod(suggestPeriod(nextSelection));
  }

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    if (!canApplySearch) return;
    setLoading(true);
    setError("");
    setPage(1);
    setSearch(normalizedSearchInput);
  }

  function clearSearch() {
    if (!search) return;
    setLoading(true);
    setSearchInput("");
    setError("");
    setPage(1);
    setSearch("");
  }

  async function createContract(event: React.FormEvent) {
    event.preventDefault();
    if (!selectionComplete) {
      setError(mode === "MASTER" ? "دقیقاً دو پرونده پذیرفته‌شده از یک شرکت را انتخاب کنید." : "یک پرونده پذیرفته‌شده را انتخاب کنید.");
      return;
    }
    const issue = getContractPeriodIssue(period);
    if (issue) {
      setError(issue.message);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const requestReference = mode === "MASTER"
        ? { requestIds: selectedRequests.map(({ id }) => id) }
        : { requestId: selectedRequests[0].id };
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PPA",
          ...requestReference,
          effectiveDate: period.effectiveDate,
          expirationDate: period.expirationDate,
          settlementCycle: "MONTHLY",
          paymentDueDays: 30,
          nettingEnabled: false,
          notes,
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiErrorMessage(body, "ایجاد قرارداد ناموفق بود."));
      const contract = body as { id: string };
      router.push(`/admin/contracts/${contract.id}/configure`);
      router.refresh();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/contracts" aria-label="بازگشت به قراردادها"><ArrowRight className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold">ایجاد قرارداد</h1>
          <p className="text-muted-foreground">نوع قرارداد و پرونده‌های واجد شرایط را انتخاب کنید.</p>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>نوع قرارداد</CardTitle>
          <CardDescription>برای هر نیروگاه قرارداد مستقل بسازید یا دو نیروگاه یک شرکت را زیر توافق‌نامه مادر قرار دهید.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button type="button" aria-pressed={mode === "SINGLE"} onClick={() => changeMode("SINGLE")} className={`rounded-lg border p-4 text-right transition-colors ${mode === "SINGLE" ? "border-teal-600 bg-teal-50" : "hover:bg-muted/50"}`}>
            <span className="font-medium">قرارداد تک‌نیروگاهی</span>
            <span className="mt-1 block text-sm text-muted-foreground">یک پرونده پذیرفته‌شده و یک برنامه تجاری</span>
          </button>
          <button type="button" aria-pressed={mode === "MASTER"} onClick={() => changeMode("MASTER")} className={`rounded-lg border p-4 text-right transition-colors ${mode === "MASTER" ? "border-teal-600 bg-teal-50" : "hover:bg-muted/50"}`}>
            <span className="font-medium">توافق‌نامه مادر</span>
            <span className="mt-1 block text-sm text-muted-foreground">دو پرونده مستقل از یک شرکت و دو برنامه تجاری</span>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "MASTER" ? "انتخاب پرونده‌های شرکت" : "انتخاب پرونده نیروگاه"}</CardTitle>
          <CardDescription>فقط پرونده‌های دارای پیشنهاد پذیرفته‌شده، نیروگاه تکمیل‌شده و بدون قرارداد نمایش داده می‌شوند.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={applySearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="جست‌وجوی شماره پرونده، نام نیروگاه یا طرف قرارداد" className="pr-9" />
            </div>
            <Button type="submit" variant="outline" disabled={!canApplySearch}>جست‌وجو</Button>
            {search && <Button type="button" variant="ghost" onClick={clearSearch} disabled={loading}>پاک‌کردن جست‌وجو</Button>}
          </form>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-right">انتخاب</TableHead>
                  <TableHead className="text-right">پرونده</TableHead>
                  <TableHead className="text-right">نیروگاه</TableHead>
                  <TableHead className="text-right">طرف قرارداد</TableHead>
                  <TableHead className="text-right">ظرفیت</TableHead>
                  <TableHead className="text-right">تاریخ ثبت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></TableCell></TableRow>
                ) : requests.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                    {search ? "پرونده واجد شرایطی با این عبارت پیدا نشد." : mode === "MASTER" ? "برای توافق‌نامه مادر، دو پرونده پذیرفته‌شده از یک شرکت لازم است." : "پرونده واجد شرایطی برای ایجاد قرارداد وجود ندارد."}
                  </TableCell></TableRow>
                ) : requests.map((request) => {
                  const selected = selectedIds.has(request.id);
                  const disabled = mode === "MASTER" && !selected && Boolean(selectedPartyId && selectedPartyId !== request.partyId);
                  return (
                    <TableRow key={request.id} data-state={selected ? "selected" : undefined} className={disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"} onClick={() => !disabled && selectRequest(request)}>
                      <TableCell>
                        <button type="button" disabled={disabled} aria-label={`${selected ? "حذف" : "انتخاب"} پرونده ${request.caseNumber}`} className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? "bg-teal-600 text-white" : "border bg-background"}`}>
                          {selected ? <CheckCircle2 className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{request.caseNumber}</TableCell>
                      <TableCell>{request.asset?.name ?? "—"}</TableCell>
                      <TableCell>{request.party.displayName}</TableCell>
                      <TableCell><span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-muted-foreground" />{(request.asset?.capacityNominal ?? request.capacity).toLocaleString("fa-IR")} کیلووات</span></TableCell>
                      <TableCell>{formatPersianDate(request.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{pagination.total.toLocaleString("fa-IR")} پرونده واجد شرایط</span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => { setLoading(true); setPage((current) => current - 1); }} aria-label="صفحه قبل"><ChevronRight className="h-4 w-4" /></Button>
              <span>صفحه {page.toLocaleString("fa-IR")} از {Math.max(1, pagination.pages).toLocaleString("fa-IR")}</span>
              <Button type="button" size="sm" variant="outline" disabled={loading || page >= pagination.pages} onClick={() => { setLoading(true); setPage((current) => current + 1); }} aria-label="صفحه بعد"><ChevronLeft className="h-4 w-4" /></Button>
            </div>
          </div>

          {selectedRequests.length > 0 && (
            <div className="rounded-lg bg-teal-50 p-4 text-sm text-teal-950">
              <p className="mb-2 font-medium">انتخاب فعلی</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedRequests.map((request, index) => (
                  <p key={request.id}>{request.asset?.name} — {request.caseNumber}{mode === "MASTER" && ` — برنامه ${index === 0 ? "قیمت ثابت" : "شاخص بازار"}`}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRequests.length > 0 && (
        <form onSubmit={createContract}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{mode === "MASTER" ? "اطلاعات توافق‌نامه" : "اطلاعات قرارداد"}</CardTitle>
              <CardDescription>بازه پیشنهادی از تاریخ بهره‌برداری و مدت پیشنهاد پذیرفته‌شده محاسبه شده است.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <ContractPeriodFields period={period} suggestedPeriod={suggestedPeriod} suggestionReason={mode === "MASTER" ? "شروع بر اساس دیرترین تاریخ بهره‌برداری و پایان بر اساس طولانی‌ترین مدت پیشنهادهای انتخاب‌شده است." : "شروع بر اساس تاریخ بهره‌برداری نیروگاه و پایان بر اساس مدت پیشنهاد پذیرفته‌شده است."} onChange={setPeriod} />
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">یادداشت</Label><Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={submitting || !selectionComplete || Boolean(periodIssue)}>
                  {submitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <FileText className="ml-2 h-4 w-4" />}
                  {mode === "MASTER" ? "ایجاد توافق‌نامه و ادامه پیکربندی" : "ایجاد قرارداد و ادامه پیکربندی"}
                </Button>
                <Link href="/admin/contracts" className={buttonVariants({ variant: "outline" })}>انصراف</Link>
              </div>
              {!selectionComplete && <p className="text-xs text-muted-foreground sm:col-span-2">برای فعال‌شدن دکمه، {mode === "MASTER" ? "دقیقاً دو پرونده از یک شرکت" : "یک پرونده"} را انتخاب کنید؛ اکنون {selectedRequests.length.toLocaleString("fa-IR")} پرونده انتخاب شده است.</p>}
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
