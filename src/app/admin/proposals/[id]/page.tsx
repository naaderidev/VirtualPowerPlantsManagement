"use client";

import { formatPersianDate, formatPersianDateTime } from "@/lib/persian-date";
import { getStatusLabel } from "@/lib/status-labels";


import { use, useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowRight,
  FileText,
  User,
  Building2,
  Clock,
  Loader2,
  DollarSign,
  MessageSquare,
} from "lucide-react";

interface Proposal {
  id: string;
  pricePerKwh: number;
  currency: string;
  duration: number;
  status: string;
  validUntil: string;
  notes: string | null;
  customerNote: string | null;
  createdAt: string;
  request: {
    id: string;
    caseNumber: string;
    status: string;
    capacity: number;
    province: string;
    city: string;
    plantType: string;
    party: {
      id: string;
      displayName: string;
      type: string;
      nationalId: string | null;
      phone: string | null;
      email: string | null;
    };
    asset: {
      id: string;
      name: string;
      type: string;
      capacityNominal: number;
      province: string;
      city: string;
    } | null;
  };
  reviews: Array<{
    id: string;
    action: string;
    notes: string | null;
    reviewer: {
      id: string;
      name: string;
      role: string;
    } | null;
    createdAt: string;
  }>;
}

const proposalStatusLabels: Record<string, string> = {
  PENDING: "در انتظار",
  ACCEPTED: "پذیرفته شده",
  REJECTED: "رد شده",
  EXPIRED: "منقضی شده",
  CANCELLED: "لغو شده",
};

const plantTypeLabels: Record<string, string> = {
  SOLAR: "خورشیدی",
  WIND: "بادی",
  GAS_TURBINE: "گازی",
  STEAM_TURBINE: "بخاری",
  CHP: "تولید هم‌زمان",
  HYDRO: "آبی",
  BIOGAS: "بیوگاز",
  OTHER: "سایر",
};

export default function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const [reviewNote, setReviewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProposal();
  }, [id]);

  const fetchProposal = async () => {
    try {
      const response = await fetch(`/api/proposals/${id}`);
      if (!response.ok) throw new Error("خطا در دریافت پیشنهاد");
      const data = await response.json();
      setProposal(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!proposal || !reviewNote.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: reviewNote, action: "NOTE" }),
      });
      if (!response.ok) throw new Error("خطا در ذخیره یادداشت");
      await fetchProposal();
      setReviewNote("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "پیشنهاد یافت نشد"}
      </div>
    );
  }

  const request = proposal.request;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/proposals"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">پیشنهاد {request.caseNumber}</h1>
            <StatusBadge
              status={proposal.status as any}
              className={`${
                proposal.status === "ACCEPTED"
                  ? "bg-teal-600 text-white"
                  : proposal.status === "REJECTED"
                    ? "bg-rose-600 text-white"
                    : "bg-amber-500 text-white"
              }`}
            />
          </div>
          <p className="text-muted-foreground">
            ثبت شده در {formatPersianDate(proposal.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="info">اطلاعات</TabsTrigger>
              <TabsTrigger value="request">درخواست</TabsTrigger>
              <TabsTrigger value="party">طرف</TabsTrigger>
              <TabsTrigger value="asset">دارایی</TabsTrigger>
              <TabsTrigger value="history">تاریخچه</TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <DollarSign className="h-5 w-5 text-white" />
                    </div>
                    اطلاعات پیشنهاد
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">قیمت هر کیلووات‌ساعت</p>
                      <p className="font-medium text-lg">
                        {proposal.pricePerKwh.toLocaleString()} {proposal.currency === "IRR" ? "ریال" : "دلار"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">مدت قرارداد</p>
                      <p className="font-medium">{proposal.duration} ماه</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">اعتبار تا</p>
                      <p className="font-medium">
                        {formatPersianDate(proposal.validUntil)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">وضعیت</p>
                      <Badge status={proposal.status} variant={proposal.status === "ACCEPTED" ? "default" : proposal.status === "REJECTED" ? "destructive" : "secondary"}>
                        {proposalStatusLabels[proposal.status] || getStatusLabel(proposal.status)}
                      </Badge>
                    </div>
                  </div>
                  {proposal.status === "REJECTED" && proposal.customerNote && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">دلیل رد فروشنده</p>
                      <p className="mt-1">{proposal.customerNote}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Request Tab */}
            <TabsContent value="request">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="bg-teal-600 p-2 rounded-full">
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                      اطلاعات درخواست
                    </div>
                    <Link href={`/admin/requests/${request.id}`}>
                      <Button variant="outline" size="sm">
                        <ArrowRight className="h-4 w-4 ml-2" />
                        مشاهده درخواست
                      </Button>
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">شماره درخواست</p>
                      <p className="font-medium font-mono">{request.caseNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">وضعیت درخواست</p>
                      <StatusBadge status={request.status as any} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">نوع نیروگاه</p>
                      <p className="font-medium">{plantTypeLabels[request.plantType]}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">ظرفیت</p>
                      <p className="font-medium">{request.capacity.toLocaleString()} کیلووات</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">استان</p>
                      <p className="font-medium">{request.province}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">شهر</p>
                      <p className="font-medium">{request.city}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Party Tab */}
            <TabsContent value="party">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    اطلاعات طرف
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">نام</p>
                      <p className="font-medium">{request.party.displayName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">نوع</p>
                      <p className="font-medium">
                        {request.party.type === "PERSON" ? "شخص حقیقی" : "شخص حقوقی"}
                      </p>
                    </div>
                    {request.party.nationalId && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {request.party.type === "PERSON" ? "کد ملی" : "شناسه ملی"}
                        </p>
                        <p className="font-medium font-mono">{request.party.nationalId}</p>
                      </div>
                    )}
                    {request.party.phone && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">تلفن</p>
                        <p className="font-medium">{request.party.phone}</p>
                      </div>
                    )}
                    {request.party.email && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">ایمیل</p>
                        <p className="font-medium">{request.party.email}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Asset Tab */}
            <TabsContent value="asset">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    اطلاعات دارایی
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {request.asset ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">نام</p>
                        <p className="font-medium">{request.asset.name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">نوع</p>
                        <p className="font-medium">
                          {plantTypeLabels[request.asset.type] || request.asset.type}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">ظرفیت نامی</p>
                        <p className="font-medium">
                          {request.asset.capacityNominal.toLocaleString()} کیلووات
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">موقعیت</p>
                        <p className="font-medium">
                          {request.asset.province} - {request.asset.city}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      دارایی به این درخواست لینک نشده است
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    تاریخچه یادداشت‌ها
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {proposal.reviews.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      هنوز یادداشتی ثبت نشده است
                    </p>
                  ) : (
                    proposal.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {review.reviewer?.name || "سیستم"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 ml-1" />
                              یادداشت
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {formatPersianDateTime(review.createdAt)}
                          </span>
                        </div>
                        {review.notes && (
                          <p className="text-sm text-muted-foreground">
                            {review.notes}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Review Note */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">یادداشت بررسی</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Textarea
                  placeholder="یادداشت خود را اینجا بنویسید..."
                  value={reviewNote}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setReviewNote(e.target.value);
                    }
                  }}
                  rows={3}
                  maxLength={500}
                />
                <span className={`absolute bottom-2 left-2 text-xs ${reviewNote.length >= 450 ? "text-destructive" : "text-muted-foreground"}`}>
                  {reviewNote.length}/500
                </span>
              </div>
              <Button
                className="w-full"
                onClick={handleAddNote}
                disabled={isSubmitting || !reviewNote.trim()}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 ml-2" />
                )}
                ثبت یادداشت
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">قیمت پیشنهادی</p>
                <p className="text-3xl font-bold text-primary mt-1">
                  {proposal.pricePerKwh.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  ریال / کیلووات‌ساعت
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">مدت</p>
                  <p className="font-medium">{proposal.duration} ماه</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">ظرفیت</p>
                  <p className="font-medium">{request.capacity.toLocaleString()} kW</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
