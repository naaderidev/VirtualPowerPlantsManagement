"use client";

import { formatPersianDate } from "@/lib/persian-date";


import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileSignature,
  Building,
  Calendar,
  Loader2,
} from "lucide-react";

interface Party {
  id: string;
  displayName: string;
  type: string;
  nationalId: string | null;
  economicCode: string | null;
  registrationNo: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  createdAt: string;
  assets?: {
    id: string;
    name: string;
    type: string;
    capacityNominal: number;
  }[];
  contracts?: { id: string; contractNumber: string; status: string }[];
}

export default function PartyDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = use(params);
  const [party, setParty] = useState<Party | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchParty();
  }, [id]);

  const fetchParty = async () => {
    try {
      const response = await fetch(`/api/parties/${id}`);
      if (!response.ok) throw new Error("خطا در دریافت اطلاعات طرف");
      const data = await response.json();
      setParty(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !party) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/parties"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">خطا</h1>
        </div>
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
          {error || "طرف یافت نشد"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/parties"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{party.displayName}</h1>
            <Badge
              status={party.status}
              variant={party.status === "ACTIVE" ? "default" : "secondary"}
            >
              {party.status === "ACTIVE" ? "فعال" : "غیرفعال"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {party.type === "PERSON" ? "شخص حقیقی" : "شخص حقوقی"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {party.type === "PERSON" ? (
                  <div className="bg-teal-600 p-2 rounded-full">
                    <User className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <div className="bg-teal-600 p-2 rounded-full">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                )}
                اطلاعات پایه
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">نام</p>
                  <p className="font-medium">{party.displayName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">نوع</p>
                  <p className="font-medium">
                    {party.type === "PERSON" ? "شخص حقیقی" : "شخص حقوقی"}
                  </p>
                </div>
                {party.nationalId && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {party.type === "PERSON" ? "کد ملی" : "شناسه ملی"}
                    </p>
                    <p className="font-medium font-mono">{party.nationalId}</p>
                  </div>
                )}
                {party.economicCode && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">کد اقتصادی</p>
                    <p className="font-medium font-mono">
                      {party.economicCode}
                    </p>
                  </div>
                )}
                {party.registrationNo && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">شماره ثبت</p>
                    <p className="font-medium font-mono">
                      {party.registrationNo}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">تاریخ عضویت</p>
                  <p className="font-medium">
                    {formatPersianDate(party.createdAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="bg-teal-600 p-2 rounded-full">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                اطلاعات تماس
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {party.phone && (
                  <div className="flex items-center gap-3">
                    {/* <Phone className="h-4 w-4 text-muted-foreground" /> */}
                    <div>
                      <p className="text-sm text-muted-foreground">تلفن</p>
                      <p className="font-medium" dir="ltr">
                        {party.phone}
                      </p>
                    </div>
                  </div>
                )}
                {party.email && (
                  <div className="flex items-center gap-3">
                    {/* <Mail className="h-4 w-4 text-muted-foreground" /> */}
                    <div>
                      <p className="text-sm text-muted-foreground">ایمیل</p>
                      <p className="font-medium" dir="ltr">
                        {party.email}
                      </p>
                    </div>
                  </div>
                )}
                {party.address && (
                  <div className="flex items-start gap-3">
                    {/* <MapPin className="h-4 w-4 text-muted-foreground mt-1" /> */}
                    <div>
                      <p className="text-sm text-muted-foreground">آدرس</p>
                      <p className="font-medium">{party.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Assets */}
          {party.assets && party.assets.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="bg-teal-600 p-2 rounded-full">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  دارایی‌ها ({party.assets.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {party.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-full">
                        <Building className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium">{asset.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {asset.capacityNominal} کیلووات
                        </p>
                      </div>
                    </div>
                    <Link href={`/admin/assets/${asset.id}`}>
                      <Button variant="ghost" size="sm">
                        مشاهده
                      </Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contracts */}
          {party.contracts && party.contracts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="bg-teal-600 p-2 rounded-full">
                    <FileSignature className="h-5 w-5 text-white" />
                  </div>
                  قراردادها ({party.contracts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {party.contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium font-mono">
                        {contract.contractNumber}
                      </span>
                      <Badge
                        status={contract.status}
                        variant={
                          contract.status === "ACTIVE" ? "default" : "secondary"
                        }
                      >
                        {contract.status === "ACTIVE" ? "فعال" : "سایر"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
