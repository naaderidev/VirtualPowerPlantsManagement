"use client";

import { formatPersianDate, formatPersianDateTime } from "@/lib/persian-date";


import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MapPin,
  MessageSquare,
  Upload,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { WorkflowTimeline } from "@/components/shared/workflow-timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  REQUEST_DOCUMENT_TYPES,
  canCustomerUploadRequestDocuments,
  getRequiredRequestDocumentTypes,
} from "@/domain/documents";
import { canSubmitOperationalReadiness } from "@/domain/assets/operational-readiness";
import type { RequestStatus } from "@/domain/requests";

interface RequestDetail {
  id: string;
  caseNumber: string;
  status: RequestStatus;
  plantType: string;
  capacity: number;
  province: string;
  city: string;
  operationalStatus: string;
  avgMonthlyGeneration: number | null;
  hasExistingContract: boolean;
  existingContractStart: string | null;
  existingContractEnd: string | null;
  existingContractCounterparty: string | null;
  existingContractCommittedCapacity: number | null;
  existingContractExclusive: boolean;
  existingContractRestrictions: string | null;
  existingContractRightToSellConfirmed: boolean;
  contactMobile: string;
  notes: string | null;
  contractId: string | null;
  contract: { status: string; terminationDate: string | null } | null;
  createdAt: string;
  updatedAt: string;
  initiator: { name: string; role: string } | null;
  party: {
    id: string;
    displayName: string;
    type: string;
    nationalId: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  asset: {
    id: string;
    status?: string | null;
    name?: string | null;
    type?: string | null;
    capacityNominal?: number | null;
    capacitySellable?: number | null;
    province: string;
    city: string;
    address: string | null;
    gridCompany?: string | null;
    connectionPoint?: string | null;
  } | null;
  documents: Array<{
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    verified: boolean;
  }>;
  reviews: Array<{
    id: string;
    action: string;
    fromStatus: string;
    toStatus: string;
    notes: string | null;
    createdAt: string;
    reviewer: { name: string; role: string } | null;
  }>;
}

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

const operationalStatusLabels: Record<string, string> = {
  ACTIVE: "فعال",
  UNDER_CONSTRUCTION: "در حال ساخت",
  PLANNING: "در حال برنامه‌ریزی",
  TEMPORARILY_STOPPED: "موقتاً متوقف",
};

const reviewActionLabels: Record<string, string> = {
  APPROVE: "تأیید درخواست",
  REJECT: "رد درخواست",
  NEED_INFO: "درخواست اطلاعات تکمیلی",
  DEFER: "تعویق بررسی",
  ASSIGN: "ارجاع درخواست",
  ESCALATE: "ارجاع به سطح بالاتر",
  SUBMIT_INFORMATION: "ارسال اطلاعات تکمیلی",
};

function SectionTitle({
  icon: Icon,
  children,
}: Readonly<{ icon: LucideIcon; children: ReactNode }>) {
  return (
    <CardTitle className="flex items-center gap-2">
      <span className="rounded-full bg-teal-600 p-2">
        <Icon className="h-4 w-4 text-white" />
      </span>
      {children}
    </CardTitle>
  );
}

export default function CustomerRequestDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  useEffect(() => {
    let active = true;
    void fetch(`/api/requests/${id}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("خطا در دریافت درخواست");
        return response.json() as Promise<RequestDetail>;
      })
      .then((data) => {
        if (active) setRequest(data);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "خطای غیرمنتظره");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
        {error || "درخواست یافت نشد"}
      </div>
    );
  }

  const customerMessages = request.reviews.filter(
    ({ action, notes }) =>
      Boolean(notes) && ["NEED_INFO", "REJECT"].includes(action),
  );
  const publicHistory = request.reviews.filter(
    ({ action }) => action !== "NOTE",
  );
  const canViewContract =
    request.contractId &&
    [
      "CONTRACT_PENDING",
      "CONTRACT_SIGNED",
      "ACTIVE",
      "SETTLEMENT_PENDING",
      "SETTLED",
      "COMPLETED",
    ].includes(request.status);
  const canUploadDocuments = canCustomerUploadRequestDocuments(request.reviews);
  const canUpdateOperationalReadiness = Boolean(
    request.asset &&
    request.asset.status !== "ACTIVE" &&
    canSubmitOperationalReadiness(request.status),
  );
  const requiredDocumentTypes = getRequiredRequestDocumentTypes({
    operationalStatus: request.operationalStatus,
    hasExistingContract: request.hasExistingContract,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/customer/requests"
          className="text-muted-foreground hover:text-foreground"
          aria-label="بازگشت"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">درخواست {request.caseNumber}</h1>
            <StatusBadge status={request.status} />
            {request.contract?.status === "TERMINATION_PENDING" && <Badge status="TERMINATION_PENDING">قرارداد در حال بررسی فسخ</Badge>}
            {request.contract?.status === "TERMINATED" && <Badge status="TERMINATED">قرارداد فسخ‌شده</Badge>}
            {request.status === "CONTRACT_SIGNED" && request.asset?.status !== "ACTIVE" && <Badge status="PENDING">در انتظار بهره‌برداری</Badge>}
          </div>
          <p className="mt-1 text-muted-foreground">جزئیات درخواست فروش برق</p>
        </div>
      </div>

      {(request.asset?.status ?? request.operationalStatus) !== "ACTIVE" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          پرونده شما می‌تواند تا امضای قرارداد ادامه پیدا کند. فعال‌سازی و شروع تحویل برق پس از بهره‌برداری واقعی، اتصال شبکه و تأیید کنتور انجام می‌شود.
        </div>
      )}

      {customerMessages.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              پیام‌های بررسی
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {customerMessages.map((message) => (
              <div
                key={message.id}
                className="rounded-lg border bg-background p-3"
              >
                <p className="text-sm">{message.notes}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {message.reviewer?.name ?? "کارشناس سامانه"} —{" "}
                  {formatPersianDateTime(message.createdAt)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 lg:grid-cols-6">
              <TabsTrigger value="info">اطلاعات</TabsTrigger>
              <TabsTrigger value="party">متقاضی</TabsTrigger>
              <TabsTrigger value="asset">نیروگاه</TabsTrigger>
              <TabsTrigger value="location">مکان</TabsTrigger>
              <TabsTrigger value="documents">مدارک</TabsTrigger>
              <TabsTrigger value="history">تاریخچه</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <SectionTitle icon={FileText}>اطلاعات درخواست</SectionTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      شماره درخواست
                    </p>
                    <p className="font-mono font-medium">
                      {request.caseNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">نوع نیروگاه</p>
                    <p className="font-medium">
                      {plantTypeLabels[request.plantType] || request.plantType}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ظرفیت</p>
                    <p className="font-medium">
                      {request.capacity.toLocaleString()} کیلووات
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      وضعیت بهره‌برداری
                    </p>
                    <p className="font-medium">
                      {operationalStatusLabels[request.operationalStatus] ||
                        request.operationalStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      قرارداد موجود
                    </p>
                    <p className="font-medium">
                      {request.hasExistingContract ? "دارد" : "ندارد"}
                    </p>
                  </div>
                  {request.hasExistingContract && <>
                    <div><p className="text-sm text-muted-foreground">طرف قرارداد موجود</p><p className="font-medium">{request.existingContractCounterparty ?? "ثبت نشده"}</p></div>
                    <div><p className="text-sm text-muted-foreground">بازه قرارداد موجود</p><p className="font-medium">{request.existingContractStart ? formatPersianDate(request.existingContractStart) : "-"} تا {request.existingContractEnd ? formatPersianDate(request.existingContractEnd) : "-"}</p></div>
                    <div><p className="text-sm text-muted-foreground">ظرفیت متعهدشده</p><p className="font-medium">{request.existingContractCommittedCapacity?.toLocaleString("fa-IR") ?? "-"} کیلووات</p></div>
                    <div><p className="text-sm text-muted-foreground">نوع تعهد</p><p className="font-medium">{request.existingContractExclusive ? "انحصاری" : "غیرانحصاری"}</p></div>
                  </>}
                  <div>
                    <p className="text-sm text-muted-foreground">شماره تماس</p>
                    <p className="font-medium">
                      {request.contactMobile}
                    </p>
                  </div>
                  {request.notes && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">یادداشت</p>
                      <p
                        className={
                          request.status === "REJECTED"
                            ? "font-medium text-destructive"
                            : "font-medium"
                        }
                      >
                        {request.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="party">
              <Card>
                <CardHeader>
                  <SectionTitle icon={User}>اطلاعات متقاضی</SectionTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">نام</p>
                    <p className="font-medium">{request.party.displayName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">نوع</p>
                    <Badge variant="secondary">
                      {request.party.type === "PERSON"
                        ? "شخص حقیقی"
                        : "شخص حقوقی"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {request.party.type === "PERSON" ? "کد ملی" : "شناسه ملی"}
                    </p>
                    <p className="font-mono font-medium">
                      {request.party.nationalId || "ثبت نشده"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">تلفن</p>
                    <p className="font-medium">
                      {request.party.phone || request.contactMobile}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ایمیل</p>
                    <p className="font-medium">
                      {request.party.email || "ثبت نشده"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">آدرس</p>
                    <p className="font-medium">
                      {request.party.address || "ثبت نشده"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="asset">
              <Card>
                <CardHeader>
                  <SectionTitle icon={Building2}>اطلاعات نیروگاه</SectionTitle>
                </CardHeader>
                <CardContent>
                  {request.asset ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          نام نیروگاه
                        </p>
                        <p className="font-medium">
                          {request.asset.name ||
                            `نیروگاه ${request.caseNumber}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">نوع</p>
                        <p className="font-medium">
                          {plantTypeLabels[
                            request.asset.type || request.plantType
                          ] || request.asset.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          ظرفیت نامی
                        </p>
                        <p className="font-medium">
                          {(
                            request.asset.capacityNominal ?? request.capacity
                          ).toLocaleString()}{" "}
                          کیلووات
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          ظرفیت قابل فروش
                        </p>
                        <p className="font-medium">
                          {request.asset.capacitySellable != null
                            ? `${request.asset.capacitySellable.toLocaleString()} کیلووات`
                            : "ثبت نشده"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          شرکت برق منطقه‌ای
                        </p>
                        <p className="font-medium">
                          {request.asset.gridCompany || "ثبت نشده"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          نقطه اتصال
                        </p>
                        <p className="font-medium">
                          {request.asset.connectionPoint || "ثبت نشده"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      <Zap className="mx-auto mb-3 h-10 w-10" />
                      <p>نیروگاه این درخواست هنوز ثبت نهایی نشده است.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="location">
              <Card>
                <CardHeader>
                  <SectionTitle icon={MapPin}>مکان نیروگاه</SectionTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">استان</p>
                    <p className="font-medium">
                      {request.asset?.province || request.province}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">شهر</p>
                    <p className="font-medium">
                      {request.asset?.city || request.city}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">آدرس</p>
                    <p className="font-medium">
                      {request.asset?.address || "ثبت نشده"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <SectionTitle icon={Upload}>مدارک درخواست</SectionTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {REQUEST_DOCUMENT_TYPES.map((documentType) => {
                    const uploadedDocument = request.documents.find(
                      (document) => document.type === documentType.type,
                    );
                    return (
                      <div
                        key={documentType.type}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {uploadedDocument ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex flex-wrap items-center gap-2"><p
                              className={
                                uploadedDocument
                                  ? "font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {documentType.label}
                            </p><Badge variant="outline">{requiredDocumentTypes.includes(documentType.type) ? "الزامی این مرحله" : ["CONNECTION", "METER"].includes(documentType.type) && request.operationalStatus !== "ACTIVE" ? "پیش از بهره‌برداری" : "اختیاری"}</Badge></div>
                            {uploadedDocument && (
                              <p className="text-xs text-muted-foreground">
                                {uploadedDocument.fileName}
                              </p>
                            )}
                          </div>
                        </div>
                        {uploadedDocument ? (
                          <div className="flex items-center gap-2">
                            <Badge
                              status={uploadedDocument.verified ? "APPROVED" : "PENDING"}
                              variant={
                                uploadedDocument.verified
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {uploadedDocument.verified
                                ? "تأیید شده"
                                : "در انتظار تأیید"}
                            </Badge>
                            <a
                              href={`${uploadedDocument.fileUrl}?preview=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                              مشاهده
                            </a>
                          </div>
                        ) : (
                          <Badge status="PENDING">آپلود نشده</Badge>
                        )}
                      </div>
                    );
                  })}
                  {canUploadDocuments && (
                    <Link href={`/customer/requests/${id}/documents`}>
                      <Button variant="outline" className="mt-2 w-full">
                        <Upload className="ml-2 h-4 w-4" />
                        مدیریت مدارک
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <SectionTitle icon={History}>تاریخچه بررسی</SectionTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {publicHistory.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground">
                      رویدادی ثبت نشده است.
                    </p>
                  ) : (
                    publicHistory.map((review) => (
                      <div key={review.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {reviewActionLabels[review.action] ||
                              "به‌روزرسانی درخواست"}
                          </p>
                          <time className="text-xs text-muted-foreground">
                            {formatPersianDateTime(review.createdAt)}
                          </time>
                        </div>
                        {["NEED_INFO", "REJECT"].includes(review.action) &&
                          review.notes && (
                            <p className="mt-2 text-sm text-muted-foreground">
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <WorkflowTimeline currentStatus={request.status} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>اطلاعات ثبت</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">ثبت‌کننده پرونده</p>
                <p className="font-medium">{request.initiator?.name ?? "کاربر ثبت‌کننده"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">تاریخ ثبت</p>
                <p className="font-medium">
                  {formatPersianDate(request.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">آخرین بروزرسانی</p>
                <p className="font-medium">
                  {formatPersianDate(request.updatedAt)}
                </p>
              </div>
              {request.avgMonthlyGeneration != null && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    میانگین تولید ماهانه
                  </p>
                  <p className="font-medium">
                    {request.avgMonthlyGeneration.toLocaleString()} کیلووات‌ساعت
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>عملیات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {["NEEDS_INFORMATION", "APPROVED"].includes(request.status) && (
                <Link href={`/customer/requests/${id}/complete`}>
                  <Button className="w-full justify-start">
                    <Upload className="ml-2 h-4 w-4" />
                    تکمیل اطلاعات
                  </Button>
                </Link>
              )}
              {canUpdateOperationalReadiness && (
                <Link href={`/customer/requests/${id}/operational-readiness`}>
                  <Button className="w-full justify-start">
                    <Zap className="ml-2 h-4 w-4" />
                    اعلام آمادگی بهره‌برداری
                  </Button>
                </Link>
              )}
              {[
                "PROPOSAL_READY",
                "PROPOSAL_ACCEPTED",
                "PROPOSAL_REJECTED",
              ].includes(request.status) && (
                <Link href={`/customer/requests/${id}/proposal`}>
                  <Button className="w-full justify-start">
                    <FileText className="ml-2 h-4 w-4" />
                    مشاهده پیشنهاد قیمت
                  </Button>
                </Link>
              )}
              {canViewContract && (
                <Link href={`/customer/requests/${id}/contract`}>
                  <Button className="w-full justify-start">
                    <FileText className="ml-2 h-4 w-4" />
                    مشاهده قرارداد
                  </Button>
                </Link>
              )}
              {canUploadDocuments && (
                <Link href={`/customer/requests/${id}/documents`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="ml-2 h-4 w-4" />
                    مشاهده مدارک
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
