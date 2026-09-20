"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/api-client";
import { ArrowLeft, CheckCircle2, CreditCard, FileStack, Loader2, Search, ShieldCheck } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: string;
  settlement: { periodStart: string; asset: { name: string } };
}

interface NettingStatement {
  id: string;
  statementNumber: string;
  amount: string;
  paidAmount: string;
  status: "ISSUED" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  batch: {
    periodStart: string;
    periodEnd: string;
    group: { name: string };
    items: Array<{ id: string; settlement: { asset: { name: string } } }>;
  };
}

type StatusOption = { label: string; variant?: "default" | "secondary" | "destructive" | "outline" };
type LoadError = { invoices?: string; statements?: string };

const invoiceStatuses: Record<string, StatusOption> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" }, ISSUED: { label: "صادر شده", variant: "secondary" },
  SENT: { label: "ارسال شده", variant: "secondary" }, PAID: { label: "پرداخت شده", variant: "default" },
  PARTIALLY_PAID: { label: "پرداخت جزئی", variant: "secondary" }, OVERDUE: { label: "سررسید گذشته", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
};

const statementStatuses: Record<NettingStatement["status"], Required<StatusOption>> = {
  ISSUED: { label: "صادر شده", variant: "secondary" }, PARTIALLY_PAID: { label: "پرداخت جزئی", variant: "secondary" },
  PAID: { label: "پرداخت شده", variant: "default" }, CANCELLED: { label: "لغو شده", variant: "destructive" },
};

function asItems<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && "items" in body && Array.isArray(body.items)) return body.items as T[];
  return [];
}

async function fetchItems<T>(url: string, fallbackMessage: string): Promise<T[]> {
  const response = await fetch(url);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getApiErrorMessage(body, fallbackMessage));
  return asItems<T>(body);
}

function money(value: string | number) { return `${Number(value).toLocaleString("fa-IR")} ریال`; }

export default function CustomerInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statements, setStatements] = useState<NettingStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<LoadError>({});
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [statementSearch, setStatementSearch] = useState("");
  const [statementStatus, setStatementStatus] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      fetchItems<Invoice>("/api/invoices?limit=100", "دریافت صورتحساب‌ها ناموفق بود"),
      fetchItems<NettingStatement>("/api/netting/statements?limit=100", "دریافت اسناد خالص‌سازی ناموفق بود"),
    ]).then(([invoiceResult, statementResult]) => {
      if (!active) return;
      if (invoiceResult.status === "fulfilled") setInvoices(invoiceResult.value);
      if (statementResult.status === "fulfilled") setStatements(statementResult.value);
      setErrors({
        invoices: invoiceResult.status === "rejected" ? errorMessage(invoiceResult.reason) : undefined,
        statements: statementResult.status === "rejected" ? errorMessage(statementResult.reason) : undefined,
      });
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    const query = invoiceSearch.trim().toLocaleLowerCase("fa-IR");
    return (!invoiceStatus || invoice.status === invoiceStatus)
      && (!query || invoice.invoiceNumber.toLocaleLowerCase("fa-IR").includes(query) || invoice.settlement?.asset?.name?.toLocaleLowerCase("fa-IR").includes(query));
  }), [invoiceSearch, invoiceStatus, invoices]);

  const filteredStatements = useMemo(() => statements.filter((statement) => {
    const query = statementSearch.trim().toLocaleLowerCase("fa-IR");
    return (!statementStatus || statement.status === statementStatus) && (!query
      || statement.statementNumber.toLocaleLowerCase("fa-IR").includes(query)
      || statement.batch.group.name.toLocaleLowerCase("fa-IR").includes(query)
      || statement.batch.items.some((item) => item.settlement.asset.name.toLocaleLowerCase("fa-IR").includes(query)));
  }), [statementSearch, statementStatus, statements]);

  const paidCount = invoices.filter((item) => item.status === "PAID").length + statements.filter((item) => item.status === "PAID").length;
  const pendingCount = invoices.filter((item) => ["ISSUED", "SENT", "PARTIALLY_PAID"].includes(item.status)).length
    + statements.filter((item) => ["ISSUED", "PARTIALLY_PAID"].includes(item.status)).length;

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">اسناد مالی</h1><p className="text-muted-foreground">صورتحساب‌های مستقل و اسناد حاصل از خالص‌سازی طرف فعالیت انتخاب‌شده</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="کل اسناد" value={invoices.length + statements.length} icon={FileStack} tone="bg-cyan-800" />
        <SummaryCard label="صورتحساب مستقل" value={invoices.length} icon={CreditCard} tone="bg-sky-700" />
        <SummaryCard label="سند خالص‌سازی" value={statements.length} icon={ShieldCheck} tone="bg-violet-700" />
        <SummaryCard label="پرداخت‌شده / در انتظار" value={`${paidCount.toLocaleString("fa-IR")} / ${pendingCount.toLocaleString("fa-IR")}`} icon={CheckCircle2} tone="bg-emerald-700" />
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl p-1 sm:max-w-xl">
          <TabsTrigger value="invoices" className="min-w-0 min-h-10 gap-1 px-2 py-2 text-xs sm:px-4 sm:text-sm"><CreditCard /><span className="sm:hidden">صورتحساب‌ها</span><span className="hidden sm:inline">صورتحساب‌های مستقل</span><Badge variant="outline" className="mr-1 hidden sm:inline-flex">{invoices.length.toLocaleString("fa-IR")}</Badge></TabsTrigger>
          <TabsTrigger value="netting" className="min-w-0 min-h-10 gap-1 px-2 py-2 text-xs sm:px-4 sm:text-sm"><ShieldCheck /><span className="sm:hidden">خالص‌سازی</span><span className="hidden sm:inline">اسناد خالص‌سازی</span><Badge variant="outline" className="mr-1 hidden sm:inline-flex">{statements.length.toLocaleString("fa-IR")}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="invoices"><ErrorNotice message={errors.invoices} />{!errors.invoices && <Card><CardContent className="space-y-5">
          <DocumentFilters search={invoiceSearch} onSearchChange={setInvoiceSearch} status={invoiceStatus} onStatusChange={setInvoiceStatus} placeholder="جستجوی شماره صورتحساب یا نیروگاه..." statuses={invoiceStatuses} />
          {filteredInvoices.length === 0 ? <EmptyState icon={CreditCard} title={invoices.length === 0 ? "صورتحساب مستقلی صادر نشده است" : "صورتحساب منطبق با جستجو یافت نشد"} description={invoices.length === 0 ? "در سناریوی خالص‌سازی شرکتی، اسناد مالی در تب «اسناد خالص‌سازی» نمایش داده می‌شوند." : "عبارت جستجو یا فیلتر وضعیت را تغییر دهید."} /> : <div className="space-y-3">{filteredInvoices.map((invoice) => <button type="button" key={invoice.id} className="flex w-full flex-col gap-4 rounded-lg border p-4 text-right transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between" onClick={() => router.push(`/customer/invoices/${invoice.id}`)}><div className="flex items-center gap-4"><RoundIcon icon={CreditCard} className="bg-cyan-800/10 text-cyan-800" /><div><p className="font-mono font-medium">{invoice.invoiceNumber}</p><p className="text-sm text-muted-foreground">{invoice.settlement?.asset?.name || "نامشخص"} · دوره {formatPersianDate(invoice.settlement?.periodStart)}</p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><div><p className="font-medium">{money(invoice.amount)}</p><p className="text-xs text-muted-foreground">سررسید: {formatPersianDate(invoice.dueDate)}</p></div><Badge status={invoice.status} variant={invoiceStatuses[invoice.status]?.variant || "secondary"}>{invoiceStatuses[invoice.status]?.label || getStatusLabel(invoice.status)}</Badge></div></button>)}</div>}
        </CardContent></Card>}</TabsContent>

        <TabsContent value="netting"><ErrorNotice message={errors.statements} />{!errors.statements && <Card><CardContent className="space-y-5">
          <DocumentFilters search={statementSearch} onSearchChange={setStatementSearch} status={statementStatus} onStatusChange={setStatementStatus} placeholder="جستجوی شماره سند، گروه یا نیروگاه..." statuses={statementStatuses} />
          {filteredStatements.length === 0 ? <EmptyState icon={ShieldCheck} title={statements.length === 0 ? "سند خالص‌سازی صادر نشده است" : "سند منطبق با جستجو یافت نشد"} description={statements.length === 0 ? "پس از تأیید مالی و حقوقی و صدور سند، نتیجه خالص شرکت اینجا نمایش داده می‌شود." : "عبارت جستجو یا فیلتر وضعیت را تغییر دهید."} /> : <div className="space-y-3">{filteredStatements.map((statement) => {
            const status = statementStatuses[statement.status];
            const remaining = Number(statement.amount) - Number(statement.paidAmount);
                            return <div key={statement.id} className="rounded-xl border p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><RoundIcon icon={ShieldCheck} className="bg-violet-700/10 text-violet-700" /><div><p className="font-mono font-semibold">{statement.statementNumber}</p><p className="text-sm text-muted-foreground">گروه {statement.batch.group.name} · {statement.batch.items.length.toLocaleString("fa-IR")} تسویه</p></div></div><div className="flex flex-wrap items-center gap-3"><Badge status={statement.status} variant={status.variant}>{status.label}</Badge><Link href="/customer/netting" className={buttonVariants({ variant: "outline", size: "sm" })}>مشاهده جزئیات<ArrowLeft className="mr-2 h-4 w-4" /></Link></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatementMetric label="دوره" value={`${formatPersianDate(statement.batch.periodStart)} تا ${formatPersianDate(statement.batch.periodEnd)}`} /><StatementMetric label="مبلغ سند" value={money(statement.amount)} /><StatementMetric label="پرداخت‌شده" value={money(statement.paidAmount)} /><StatementMetric label="مانده" value={money(remaining)} emphasis /></div></div>;
          })}</div>}
        </CardContent></Card>}</TabsContent>
      </Tabs>
    </div>
  );
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : "خطای غیرمنتظره"; }

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof CreditCard; tone: string }) {
  return <Card><CardContent><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{typeof value === "number" ? value.toLocaleString("fa-IR") : value}</p></div><div className={`${tone} rounded-full p-2`}><Icon className="h-7 w-7 text-white" /></div></div></CardContent></Card>;
}

function RoundIcon({ icon: Icon, className }: { icon: typeof CreditCard; className: string }) { return <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${className}`}><Icon className="h-6 w-6" /></div>; }

function DocumentFilters({ search, onSearchChange, status, onStatusChange, placeholder, statuses }: { search: string; onSearchChange: (value: string) => void; status: string; onStatusChange: (value: string) => void; placeholder: string; statuses: Record<string, StatusOption> }) {
  return <div className="flex flex-col gap-3 md:flex-row"><div className="relative w-full md:max-w-md"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} className="pr-10" /></div><div className="w-full md:w-56"><SelectWithLabels value={status} onValueChange={(value) => onStatusChange(value || "")}><SelectTrigger><SelectValue placeholder="همه وضعیت‌ها" /></SelectTrigger><SelectContent><SelectItem value="">همه وضعیت‌ها</SelectItem>{Object.entries(statuses).map(([value, config]) => <SelectItem key={value} value={value}>{config.label}</SelectItem>)}</SelectContent></SelectWithLabels></div></div>;
}

function ErrorNotice({ message }: { message?: string }) { return message ? <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{message}</div> : null; }

function EmptyState({ icon: Icon, title, description }: { icon: typeof CreditCard; title: string; description: string }) { return <div className="rounded-xl border border-dashed py-12 text-center"><Icon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">{title}</p><p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">{description}</p></div>; }

function StatementMetric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) { return <div className={emphasis ? "rounded-lg bg-primary/10 p-3" : "rounded-lg bg-muted p-3"}><p className="text-xs text-muted-foreground">{label}</p><p className={emphasis ? "font-bold text-primary" : "font-medium"}>{value}</p></div>; }
