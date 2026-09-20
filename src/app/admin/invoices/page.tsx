"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { Eye, Loader2, Receipt, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: string;
  notes: string | null;
  settlement: {
    settlementNumber: string;
    periodStart: string;
    periodEnd: string;
    energyAccepted: number;
    contract: {
      contractNumber: string;
      parties: Array<{ party: { displayName: string } }>;
    };
    asset: {
      name: string;
    };
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  ISSUED: { label: "صادر شده", variant: "secondary" },
  SENT: { label: "ارسال شده", variant: "secondary" },
  PAID: { label: "پرداخت شده", variant: "default" },
  PARTIALLY_PAID: { label: "پرداخت جزئی", variant: "secondary" },
  OVERDUE: { label: "سررسید گذشته", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "destructive" },
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("خطا در دریافت صورتحساب‌ها");
      const data = await res.json();
      setInvoices(Array.isArray(data) ? data : data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: "invoiceNumber",
      header: "شماره صورتحساب",
      render: (item: Invoice) => (
        <span className="font-medium font-mono">{item.invoiceNumber}</span>
      ),
    },
    {
      key: "party",
      header: "طرف قرارداد",
      render: (item: Invoice) => (
        <div>
          <p className="font-medium">{item.settlement?.contract?.parties[0]?.party?.displayName || "نامشخص"}</p>
          <p className="text-xs text-muted-foreground">{item.settlement?.contract?.contractNumber}</p>
        </div>
      ),
    },
    {
      key: "period",
      header: "دوره تسویه",
      render: (item: Invoice) => (
        <span>
          {formatPersianDate(item.settlement?.periodStart)} تا{" "}
          {formatPersianDate(item.settlement?.periodEnd)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "مبلغ",
      render: (item: Invoice) => (
        <span className="font-medium">{item.amount.toLocaleString()} ریال</span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Invoice) => {
        const config = statusConfig[item.status];
        return <Badge status={item.status} variant={config?.variant || "secondary"}>{config?.label || getStatusLabel(item.status)}</Badge>;
      },
    },
    {
      key: "dueDate",
      header: "سررسید",
      render: (item: Invoice) =>
        item.dueDate ? formatPersianDate(item.dueDate) : "—",
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (item: Invoice) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/admin/invoices/${item.id}`;
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error}
      </div>
    );
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidCount = invoices.filter((i) => i.status === "PAID").length;
  const pendingCount = invoices.filter((i) => ["ISSUED", "SENT"].includes(i.status)).length;
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">صورتحساب‌ها</h1>
        <p className="text-muted-foreground">صدور و مدیریت صورتحساب‌ها</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل صورتحساب‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">{invoices.length}</p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <Receipt className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">پرداخت شده</p>
                <p className="text-2xl font-bold text-teal-600">{paidCount}</p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">در انتظار پرداخت</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <Clock className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">سررسید گذشته</p>
                <p className="text-2xl font-bold text-rose-800">{overdueCount}</p>
              </div>
              <div className="bg-rose-800 p-2 rounded-full">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={invoices}
            searchKey="invoiceNumber"
            searchPlaceholder="جستجوی شماره صورتحساب..."
            pageSize={10}
            onRowClick={(item) => {
              window.location.href = `/admin/invoices/${item.id}`;
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
