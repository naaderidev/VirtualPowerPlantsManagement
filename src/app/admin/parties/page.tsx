"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { RoleGate } from "@/components/shared/role-gate";
import { SUPPLY_ROLES } from "@/lib/access-control";
import { User, Building2, Eye, Loader2, Search, Plus } from "lucide-react";

interface Party {
  id: string;
  displayName: string;
  type: string;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  _count: {
    assets: number;
    requests: number;
  };
}

export default function PartiesPage() {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchParties = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);

      const response = await fetch(`/api/parties?${params.toString()}`);
      if (!response.ok) throw new Error("خطا در دریافت طرف‌ها");
      const data = await response.json();
      setParties(data.parties || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [typeFilter]);

  const filteredParties = search
    ? parties.filter((p) =>
        p.displayName.toLowerCase().includes(search.toLowerCase()),
      )
    : parties;

  const columns = [
    {
      key: "displayName",
      header: "نام",
      render: (item: Party) => (
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            {item.type === "PERSON" ? (
              <User className="h-4 w-4 text-cyan-600" />
            ) : (
              <Building2 className="h-4 w-4 text-teal-600" />
            )}
          </div>
          <div className="text-center">
            <p className="font-medium">{item.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {item.type === "PERSON" ? "حقیقی" : "حقوقی"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "nationalId",
      header: "کد/شناسه",
      render: (item: Party) => (
        <span className="font-mono">{item.nationalId || "-"}</span>
      ),
    },
    {
      key: "phone",
      header: "تماس",
      render: (item: Party) => <span dir="ltr">{item.phone || "-"}</span>,
    },
    {
      key: "email",
      header: "ایمیل",
      render: (item: Party) => <span dir="ltr">{item.email || "-"}</span>,
    },
    {
      key: "assets",
      header: "دارایی‌ها",
      render: (item: Party) => (
        <Badge variant="secondary">{item._count.assets}</Badge>
      ),
    },
    {
      key: "requests",
      header: "درخواست‌ها",
      render: (item: Party) => (
        <Badge variant="secondary">{item._count.requests}</Badge>
      ),
    },
    {
      key: "createdAt",
      header: "تاریخ عضویت",
      render: (item: Party) => (
        <span className="text-sm text-muted-foreground">
          {formatPersianDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "status",
      header: "وضعیت",
      render: (item: Party) => (
        <Badge status={item.status} variant={item.status === "ACTIVE" ? "default" : "secondary"}>
          {item.status === "ACTIVE" ? "فعال" : "غیرفعال"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "عملیات",
      render: (item: Party) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/parties/${item.id}`);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">طرف‌ها</h1>
          <p className="text-muted-foreground">مدیریت اشخاص حقیقی و حقوقی</p>
        </div>
        <RoleGate allowedRoles={SUPPLY_ROLES}><Link href="/admin/parties/new">
          <Button>
            <Plus className="h-4 w-4 ml-2" />
            طرف جدید
          </Button>
        </Link></RoleGate>
      </div>

      <Card>
        <CardContent className="">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="w-full md:w-96">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجوی نام طرف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-64">
              <SelectWithLabels
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v || "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="همه انواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">همه انواع</SelectItem>
                  <SelectItem value="PERSON">حقیقی</SelectItem>
                  <SelectItem value="COMPANY">حقوقی</SelectItem>
                </SelectContent>
              </SelectWithLabels>
            </div>
          </div>
        </CardContent>

        <CardContent className="">
          <DataTable
            columns={columns}
            data={filteredParties}
            pageSize={10}
            onRowClick={(item) => router.push(`/admin/parties/${item.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
