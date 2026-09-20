"use client";

import { formatPersianDate } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SelectWithLabels, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { Eye, Loader2, Search, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";

interface Proposal {
  id: string;
  pricePerKwh: number;
  currency: string;
  duration: number;
  status: string;
  validUntil: string;
  notes: string | null;
  createdAt: string;
  request: {
    id: string;
    caseNumber: string;
    capacity: number;
    party: {
      id: string;
      displayName: string;
      type: string;
    };
    asset: {
      id: string;
      name: string;
      capacityNominal: number;
    } | null;
  };
}

const statusLabels: Record<string, string> = {
  PENDING: "در انتظار",
  ACCEPTED: "پذیرفته شده",
  REJECTED: "رد شده",
  EXPIRED: "منقضی شده",
  CANCELLED: "لغو شده",
};

export default function ProposalsPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchProposals = async () => {
    try {
      const response = await fetch("/api/proposals");
      if (!response.ok) throw new Error("خطا در دریافت پیشنهادها");
      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const filteredProposals = proposals
    .filter((p) => !statusFilter || p.status === statusFilter)
    .filter((p) =>
      search
        ? p.request.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
          p.request.party.displayName.toLowerCase().includes(search.toLowerCase())
        : true
    );

  const columns = [
    {
      key: "caseNumber",
      header: "شماره درخواست",
      render: (item: Proposal) => (
        <span className="font-medium font-mono">{item.request.caseNumber}</span>
      ),
    },
    {
      key: "party",
      header: "طرف",
      render: (item: Proposal) => (
        <div className="text-center">
          <p className="font-medium">{item.request.party.displayName}</p>
          <p className="text-xs text-muted-foreground">{item.request.asset?.name || "-"}</p>
        </div>
      ),
    },
    {
      key: "capacity",
      header: "ظرفیت",
      render: (item: Proposal) => `${item.request.capacity.toLocaleString()} kW`,
    },
    {
      key: "price",
      header: "نرخ پیشنهادی",
      render: (item: Proposal) => (
        <span className="font-medium">{item.pricePerKwh.toLocaleString()} ریال</span>
      ),
    },
    {
      key: "duration",
      header: "مدت",
      render: (item: Proposal) => `${item.duration} ماه`,
    },
    {
      key: "createdAt",
      header: "تاریخ ایجاد",
      render: (item: Proposal) => (
        <span className="text-sm text-muted-foreground">
          {formatPersianDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "validUntil",
      header: "اعتبار تا",
      render: (item: Proposal) => (
        <span className="text-sm text-muted-foreground">
          {formatPersianDate(item.validUntil)}
        </span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Proposal) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
          PENDING: "outline",
          ACCEPTED: "default",
          REJECTED: "destructive",
          EXPIRED: "secondary",
          CANCELLED: "secondary",
        };
        return (
          <Badge status={item.status} variant={variants[item.status] || "secondary"}>
            {statusLabels[item.status] || getStatusLabel(item.status)}
          </Badge>
        );
      },
    },
    {
      key: "actions",
      header: "عملیات",
      render: (item: Proposal) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/requests/${item.request.id}`);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
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

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">پیشنهادها</h1>
        <p className="text-muted-foreground">مدیریت پیشنهادات قیمت به فروشندگان</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">کل پیشنهادها</p>
                <p className="text-2xl font-bold text-cyan-800">{proposals.length}</p>
              </div>
              <div className="bg-cyan-800 p-2 rounded-full">
                <FileText className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">در انتظار</p>
                <p className="text-2xl font-bold text-amber-600">
                  {proposals.filter((p) => p.status === "PENDING").length}
                </p>
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
                <p className="text-sm text-muted-foreground">پذیرفته شده</p>
                <p className="text-2xl font-bold text-teal-600">
                  {proposals.filter((p) => p.status === "ACCEPTED").length}
                </p>
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
                <p className="text-sm text-muted-foreground">رد شده</p>
                <p className="text-2xl font-bold text-rose-800">
                  {proposals.filter((p) => p.status === "REJECTED").length}
                </p>
              </div>
              <div className="bg-rose-800 p-2 rounded-full">
                <XCircle className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجوی شماره درخواست یا نام طرف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels value={statusFilter} onValueChange={(v) => setStatusFilter(v || "")}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder="همه وضعیت‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه وضعیت‌ها</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>
        <CardContent className="">
          <DataTable
            columns={columns}
            data={filteredProposals}
            pageSize={10}
            onRowClick={(item) => router.push(`/admin/proposals/${item.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
