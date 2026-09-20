"use client";

import { formatApiDate, formatPersianDate } from "@/lib/persian-date";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { RoleGate } from "@/components/shared/role-gate";
import { PAYMENT_WRITE_ROLES } from "@/lib/access-control";
import {
  remainingPaymentAmount,
  suggestedAllocationAmount,
} from "@/domain/billing/payment-amount";

type Payment = {
  id: string;
  paymentNumber: string;
  amountDecimal: string;
  paymentDate: string;
  method: string | null;
  reference: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  allocated: boolean;
  allocationVersion: number;
  allocations: Array<{ amount: string; invoice: { invoiceNumber: string } }>;
  nettingAllocations: Array<{
    amount: string;
    statement: { statementNumber: string };
  }>;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: string;
  status: string;
};

type NettingStatement = {
  id: string;
  statementNumber: string;
  amount: string;
  paidAmount: string;
  status: string;
  party: { displayName: string };
};

const statusLabels = {
  PENDING: "در انتظار تأیید",
  CONFIRMED: "تأییدشده",
  REJECTED: "ردشده",
} as const;
type PaymentTarget = { value: string; label: string; remaining: string };

async function loadPaymentTarget(): Promise<{
  target: PaymentTarget;
  invoice?: Invoice;
  statement?: NettingStatement;
} | null> {
  const query = new URLSearchParams(window.location.search);
  const invoiceId = query.get("invoiceId");
  const statementId = query.get("statementId");
  if (!invoiceId && !statementId) return null;
  if (invoiceId && statementId)
    throw new Error("فقط یک سند برای پرداخت انتخاب کنید.");

  const isInvoice = Boolean(invoiceId);
  const response = await fetch(
    isInvoice
      ? `/api/invoices/${encodeURIComponent(invoiceId!)}`
      : `/api/netting/statements/${encodeURIComponent(statementId!)}`,
  );
  const body = await response.json();
  if (!response.ok)
    throw new Error(getApiErrorMessage(body, "دریافت سند پرداخت ناموفق بود"));
  if (isInvoice) {
    const invoice = body as Invoice;
    const remaining = remainingPaymentAmount(
      invoice.amount,
      invoice.paidAmount ?? "0",
    );
    if (
      !["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(
        invoice.status,
      ) ||
      !remaining
    )
      throw new Error("این صورتحساب مانده قابل پرداخت ندارد.");
    return {
      target: {
        value: `invoice:${invoice.id}`,
        label: `صورتحساب ${invoice.invoiceNumber}`,
        remaining,
      },
      invoice,
    };
  }
  const statement = body as NettingStatement;
  const remaining = remainingPaymentAmount(
    statement.amount,
    statement.paidAmount ?? "0",
  );
  if (!["ISSUED", "PARTIALLY_PAID"].includes(statement.status) || !remaining)
    throw new Error("این سند خالص‌سازی مانده قابل پرداخت ندارد.");
  return {
    target: {
      value: `netting:${statement.id}`,
      label: `سند خالص‌سازی ${statement.statementNumber}`,
      remaining,
    },
    statement,
  };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [statements, setStatements] = useState<NettingStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    paymentDate: formatApiDate(new Date(), "paymentDate"),
    method: "BANK_TRANSFER",
    bankName: "",
    reference: "",
    notes: "",
  });
  const [allocation, setAllocation] = useState<
    Record<string, { target: string; amount: string }>
  >({});
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(
    null,
  );

  async function loadData() {
    const [paymentsResponse, invoicesResponse, statementsResponse] =
      await Promise.all([
        fetch("/api/payments?limit=100"),
        fetch("/api/invoices?limit=100"),
        fetch("/api/netting/statements?limit=100"),
      ]);
    const paymentsBody = await paymentsResponse.json();
    const invoicesBody = await invoicesResponse.json();
    const statementsBody = await statementsResponse.json();
    if (!paymentsResponse.ok)
      throw new Error(
        getApiErrorMessage(paymentsBody, "خطا در دریافت پرداخت‌ها"),
      );
    if (!invoicesResponse.ok)
      throw new Error(
        getApiErrorMessage(invoicesBody, "خطا در دریافت صورتحساب‌ها"),
      );
    if (!statementsResponse.ok)
      throw new Error(
        getApiErrorMessage(statementsBody, "خطا در دریافت اسناد خالص‌سازی"),
      );
    return {
      payments: (Array.isArray(paymentsBody)
        ? paymentsBody
        : (paymentsBody.items ?? [])) as Payment[],
      invoices: (Array.isArray(invoicesBody)
        ? invoicesBody
        : (invoicesBody.items ?? [])
      ).filter((invoice: Invoice) =>
        ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(
          invoice.status,
        ),
      ) as Invoice[],
      statements: (Array.isArray(statementsBody) ? statementsBody : []).filter(
        (statement: NettingStatement) =>
          ["ISSUED", "PARTIALLY_PAID"].includes(statement.status),
      ) as NettingStatement[],
    };
  }

  function refresh() {
    setLoading(true);
    void loadData()
      .then((data) => {
        setPayments(data.payments);
        setInvoices((current) => {
          const selected = current.find(
            ({ id }) => paymentTarget?.value === `invoice:${id}`,
          );
          return selected && !data.invoices.some(({ id }) => id === selected.id)
            ? [selected, ...data.invoices]
            : data.invoices;
        });
        setStatements((current) => {
          const selected = current.find(
            ({ id }) => paymentTarget?.value === `netting:${id}`,
          );
          return selected &&
            !data.statements.some(({ id }) => id === selected.id)
            ? [selected, ...data.statements]
            : data.statements;
        });
        setError("");
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "خطای ناشناخته"),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    void Promise.all([loadData(), loadPaymentTarget()])
      .then(([data, selected]) => {
        if (!active) return;
        setPayments(data.payments);
        setInvoices(
          selected?.invoice &&
            !data.invoices.some(({ id }) => id === selected.invoice?.id)
            ? [selected.invoice, ...data.invoices]
            : data.invoices,
        );
        setStatements(
          selected?.statement &&
            !data.statements.some(({ id }) => id === selected.statement?.id)
            ? [selected.statement, ...data.statements]
            : data.statements,
        );
        if (selected) {
          setPaymentTarget(selected.target);
          setForm((current) => ({
            ...current,
            amount: selected.target.remaining,
          }));
        }
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "خطای ناشناخته");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          bankName: form.bankName || null,
          notes: form.notes || null,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(getApiErrorMessage(body, "ثبت پرداخت ناموفق بود"));
      if (paymentTarget && body?.payment?.id) {
        setAllocation((current) => ({
          ...current,
          [body.payment.id]: {
            target: paymentTarget.value,
            amount:
              suggestedAllocationAmount(form.amount, paymentTarget.remaining) ??
              "",
          },
        }));
      }
      setForm((current) => ({
        ...current,
        amount: "",
        bankName: "",
        reference: "",
        notes: "",
      }));
      refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ثبت پرداخت ناموفق بود",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    paymentId: string,
    status: "CONFIRMED" | "REJECTED",
  ) {
    const rejectionReason =
      status === "REJECTED" ? window.prompt("دلیل رد پرداخت") : null;
    if (status === "REJECTED" && !rejectionReason) return;
    const response = await fetch(`/api/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, rejectionReason }),
    });
    const body = await response.json();
    if (!response.ok)
      setError(getApiErrorMessage(body, "تغییر وضعیت ناموفق بود"));
    else refresh();
  }

  async function allocate(paymentId: string) {
    const value = allocation[paymentId];
    if (!value?.target || !value.amount) return;
    const payment = payments.find(({ id }) => id === paymentId);
    if (!payment) return;
    const [targetType, targetId] = value.target.split(":");
    const isNetting = targetType === "netting";
    const endpoint = isNetting
      ? `/api/payments/${paymentId}/netting-allocations`
      : `/api/payments/${paymentId}/allocations`;
    const targetPayload = isNetting
      ? { nettingStatementId: targetId }
      : { invoiceId: targetId };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...targetPayload,
        amount: Number(value.amount),
        idempotencyKey: `allocation-${paymentId}-${payment.allocationVersion}-${targetId}`,
      }),
    });
    const body = await response.json();
    if (!response.ok)
      setError(getApiErrorMessage(body, "تخصیص پرداخت ناموفق بود"));
    else refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">پرداخت‌ها</h1>
        <p className="text-muted-foreground">
          ثبت، تأیید و تخصیص قابل ردیابی به صورتحساب یا سند خالص‌سازی
        </p>
      </div>
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <RoleGate allowedRoles={PAYMENT_WRITE_ROLES}>
        <Card>
          <CardHeader>
            <CardTitle>ثبت پرداخت بانکی</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentTarget && (
              <p className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                مقصد: {paymentTarget.label} · مانده قابل پرداخت:{" "}
                {Number(paymentTarget.remaining).toLocaleString("fa-IR")} ریال.
                مبلغ پیشنهادی قابل ویرایش است.
              </p>
            )}
            <form
              onSubmit={submitPayment}
              className="grid gap-4 md:grid-cols-3"
            >
              <div className="space-y-2">
                <Label>مبلغ (ریال)*</Label>
                <Input
                  aria-label="مبلغ پرداخت"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>تاریخ پرداخت *</Label>
                <PersianDatePicker
                  required
                  maxDate={formatApiDate(new Date(), "paymentDate")}
                  value={form.paymentDate}
                  onChange={(value) => setForm({ ...form, paymentDate: value })}
                />
                <p className="text-xs text-muted-foreground">
                  تاریخ پرداخت انجام‌شده؛ روزهای آینده قابل انتخاب نیستند.
                </p>
              </div>
              <div className="space-y-2">
                <Label>روش *</Label>
                <SelectWithLabels
                  value={form.method}
                  onValueChange={(value) =>
                    setForm({ ...form, method: value || "BANK_TRANSFER" })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">انتقال بانکی</SelectItem>
                    <SelectItem value="CHECK">چک</SelectItem>
                    <SelectItem value="CASH">نقدی</SelectItem>
                  </SelectContent>
                </SelectWithLabels>
              </div>
              <div className="space-y-2">
                <Label>بانک *</Label>
                <Input
                  value={form.bankName}
                  onChange={(event) =>
                    setForm({ ...form, bankName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>مرجع بانکی *</Label>
                <Input
                  required
                  value={form.reference}
                  onChange={(event) =>
                    setForm({ ...form, reference: event.target.value })
                  }
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving}>
                  {saving ? "در حال ثبت..." : "ثبت پرداخت"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </RoleGate>
      <Card>
        <CardHeader>
          <CardTitle>پرداخت‌های ثبت‌شده</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p>در حال دریافت...</p>
          ) : payments.length === 0 ? (
            <p className="text-muted-foreground">پرداختی ثبت نشده است.</p>
          ) : (
            payments.map((payment) => {
              const allocated = [
                ...payment.allocations,
                ...payment.nettingAllocations,
              ].reduce((sum, item) => sum + Number(item.amount), 0);
              return (
                <div
                  key={payment.id}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono font-medium">
                        {payment.paymentNumber}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.reference} ·{" "}
                        {formatPersianDate(payment.paymentDate)}
                      </p>
                    </div>
                    <div className="text-left">
                      <Badge status={payment.status}>{statusLabels[payment.status]}</Badge>
                      <p className="mt-1 font-medium">
                        {Number(payment.amountDecimal).toLocaleString()} ریال
                      </p>
                      <p className="text-xs text-muted-foreground">
                        تخصیص‌یافته: {allocated.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <RoleGate allowedRoles={PAYMENT_WRITE_ROLES}>
                    {payment.status === "PENDING" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => changeStatus(payment.id, "CONFIRMED")}
                        >
                          تأیید
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => changeStatus(payment.id, "REJECTED")}
                        >
                          رد
                        </Button>
                      </div>
                    )}
                    {payment.status === "CONFIRMED" && !payment.allocated && (
                      <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                        <SelectWithLabels
                          value={allocation[payment.id]?.target ?? ""}
                          onValueChange={(value) => {
                            const invoice = invoices.find(
                              ({ id }) => value === `invoice:${id}`,
                            );
                            const statement = statements.find(
                              ({ id }) => value === `netting:${id}`,
                            );
                            const remaining = invoice
                              ? remainingPaymentAmount(
                                  invoice.amount,
                                  invoice.paidAmount ?? "0",
                                )
                              : statement
                                ? remainingPaymentAmount(
                                    statement.amount,
                                    statement.paidAmount ?? "0",
                                  )
                                : null;
                            const available = remainingPaymentAmount(
                              payment.amountDecimal,
                              allocated,
                            );
                            setAllocation((current) => ({
                              ...current,
                              [payment.id]: {
                                target: value || "",
                                amount:
                                  remaining && available
                                    ? (suggestedAllocationAmount(
                                        available,
                                        remaining,
                                      ) ?? "")
                                    : "",
                              },
                            }));
                          }}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label="انتخاب سند مقصد"
                          >
                            <SelectValue placeholder="صورتحساب یا سند خالص‌سازی" />
                          </SelectTrigger>
                          <SelectContent>
                            {invoices.map((invoice) => (
                              <SelectItem
                                key={invoice.id}
                                value={`invoice:${invoice.id}`}
                              >
                                {invoice.invoiceNumber} — مانده{" "}
                                {Number(
                                  remainingPaymentAmount(
                                    invoice.amount,
                                    invoice.paidAmount ?? "0",
                                  ) ?? 0,
                                ).toLocaleString()}
                              </SelectItem>
                            ))}
                            {statements.map((statement) => (
                              <SelectItem
                                key={statement.id}
                                value={`netting:${statement.id}`}
                              >
                                {statement.statementNumber} —{" "}
                                {statement.party.displayName} — مانده{" "}
                                {Number(
                                  remainingPaymentAmount(
                                    statement.amount,
                                    statement.paidAmount ?? "0",
                                  ) ?? 0,
                                ).toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </SelectWithLabels>
                        <Input
                          aria-label="مبلغ تخصیص"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="مبلغ تخصیص"
                          value={allocation[payment.id]?.amount ?? ""}
                          onChange={(event) =>
                            setAllocation({
                              ...allocation,
                              [payment.id]: {
                                target: allocation[payment.id]?.target ?? "",
                                amount: event.target.value,
                              },
                            })
                          }
                        />
                        <Button onClick={() => allocate(payment.id)}>
                          تخصیص
                        </Button>
                      </div>
                    )}
                  </RoleGate>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
