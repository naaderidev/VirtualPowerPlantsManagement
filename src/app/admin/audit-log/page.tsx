"use client";

import { formatPersianDateTime } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { Input } from "@/components/ui/input";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  User,
  Settings,
  FileText,
  CheckCircle2,
  XCircle,
  Search,
  Loader2,
} from "lucide-react";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string | null;
  user: { name: string; mobile: string } | null;
  changes: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

const actionConfig: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: any;
  }
> = {
  LOGIN: { label: "ورود", variant: "secondary", icon: User },
  CREATE: { label: "ایجاد", variant: "default", icon: FileText },
  UPDATE: { label: "ویرایش", variant: "secondary", icon: Settings },
  DELETE: { label: "حذف", variant: "destructive", icon: XCircle },
  APPROVE: { label: "تأیید", variant: "default", icon: CheckCircle2 },
  REJECT: { label: "رد", variant: "destructive", icon: XCircle },
  EXPORT: { label: "خروجی", variant: "outline", icon: FileText },
};

const entityConfig: Record<string, string> = {
  USER: "کاربر",
  INVOICE: "صورتحساب",
  CONTRACT: "قرارداد",
  REQUEST: "درخواست",
  ASSET: "دارایی",
  PARTY: "طرف",
  SETTLEMENT: "تسویه",
  PAYMENT: "پرداخت",
  METERING: "اندازه‌گیری",
  REPORT: "گزارش",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    todayCount: 0,
    approveCount: 0,
    rejectCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/audit-logs");
      if (!res.ok) throw new Error("خطا");
      const data = await res.json();
      setLogs(data.logs);
      setStats(data.stats);
    } catch {
      console.error("خطا در دریافت لاگ‌ها");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesEntity = !entityFilter || log.entityType === entityFilter;
    const desc = (log.changes as Record<string, unknown>)?.description;
    const matchesSearch =
      !search ||
      (typeof desc === "string" && desc.includes(search)) ||
      log.entityId.includes(search);
    return matchesAction && matchesEntity && matchesSearch;
  });

  const columns = [
    {
      key: "timestamp",
      header: "زمان",
      render: (item: AuditLog) => (
        <div>
          <p className="font-medium">{formatPersianDateTime(item.timestamp)}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "عملیات",
      render: (item: AuditLog) => {
        const config = actionConfig[item.action];
        return (
          <Badge variant={config?.variant || "secondary"}>
            {config?.label || "عملیات نامشخص"}
          </Badge>
        );
      },
    },
    {
      key: "entityType",
      header: "entiity",
      render: (item: AuditLog) => (
        <div>
          <p className="font-medium">
            {entityConfig[item.entityType] || item.entityType}
          </p>
          {item.entityId && (
            <p className="text-xs text-muted-foreground font-mono">
              {item.entityId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "توضیحات",
      render: (item: AuditLog) => {
        const desc = (item.changes as Record<string, unknown>)?.description;
        return (
          <p className="text-sm">{typeof desc === "string" ? desc : "—"}</p>
        );
      },
    },
    {
      key: "user",
      header: "کاربر",
      render: (item: AuditLog) => (
        <div>
          <p className="font-medium">{item.user?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">
            {item.ipAddress || "—"}
          </p>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">سبک فعالیت</h1>
        <p className="text-muted-foreground">لاگ فعالیت‌های سیستم</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل فعالیت‌ها</p>
                <p className="text-2xl font-bold text-cyan-800">
                  {stats.total}
                </p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <ClipboardList className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">امروز</p>
                <p className="text-2xl font-bold text-teal-600">
                  {stats.todayCount}
                </p>
              </div>
              <div className="bg-teal-600 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">تأییدها</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.approveCount}
                </p>
              </div>
              <div className="bg-amber-600 p-2 rounded-full">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ردها</p>
                <p className="text-2xl font-bold text-pink-700">
                  {stats.rejectCount}
                </p>
              </div>
              <div className="bg-pink-700 p-2 rounded-full">
                <XCircle className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو در توضیحات..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <SelectWithLabels
                value={actionFilter}
                onValueChange={(v) => setActionFilter(v || "")}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="همه عملیات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه عملیات</SelectItem>
                  {Object.entries(actionConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
            <div className="w-full md:w-48">
              <SelectWithLabels
                value={entityFilter}
                onValueChange={(v) => setEntityFilter(v || "")}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="همه entiityها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه entiityها</SelectItem>
                  {Object.entries(entityConfig).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>

        <CardContent className="">
          <DataTable columns={columns} data={filteredLogs} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  );
}
