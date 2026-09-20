"use client";

import { formatPersianDate, formatPersianDateTime } from "@/lib/persian-date";


import { use, useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import type { DocumentType, RequestStatus } from "@prisma/client";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SelectWithLabels,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowTimeline } from "@/components/shared/workflow-timeline";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ArrowRight,
  FileText,
  User,
  Building2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Clock,
  Send,
  Loader2,
  Download,
  Image,
  NotepadText,
  MapPin,
} from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  DOCUMENT_ACCESS_ROLES,
  DOCUMENT_VERIFY_ROLES,
  isAppRole,
  PROPOSAL_MANAGE_ROLES,
  REQUEST_WRITE_ROLES,
  roleIsAllowed,
  SUPPLY_ROLES,
  TECHNICAL_ROLES,
} from "@/lib/access-control";
import { canRoleTransitionRequest } from "@/domain/requests/workflow";
import { getDocumentTypeLabel, getRequestDocumentReadiness } from "@/domain/documents";
import { canCreateScenario142MasterAgreement } from "@/domain/contracts/scenario-14-2";

interface RequestDetail {
  id: string;
  caseNumber: string;
  status: string;
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
  createdAt: string;
  updatedAt: string;
  partyId: string;
  contractId: string | null;
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
    name: string;
    type: string;
    capacityNominal: number;
    province: string;
    city: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    gridCompany: string | null;
    connectionPoint: string | null;
  } | null;
  documents: Array<{
    id: string;
    type: DocumentType;
    fileName: string;
    fileUrl: string;
    verified: boolean;
    verifiedBy?: string;
    verifiedByName?: string | null;
  }>;
  reviews: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    notes: string | null;
    reviewer: {
      id: string;
      name: string;
      role: string;
    } | null;
    createdAt: string;
  }>;
  proposals: Array<{
    id: string;
    pricePerKwh: number;
    status: string;
    customerNote: string | null;
    createdAt: string;
  }>;
  contractCreation: {
    eligibleMasterAgreementRequestCount: number;
  };
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

export default function AdminRequestDetailPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("info");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewNoteError, setReviewNoteError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reviewNoteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const fetchRequest = async () => {
    try {
      const response = await fetch(`/api/requests/${id}`);
      if (!response.ok) throw new Error("خطا در دریافت درخواست");
      const data = await response.json();
      setRequest(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در دریافت درخواست");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string): Promise<boolean> => {
    if (!request) return false;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          notes: reviewNote || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(getApiErrorMessage(payload, "خطا در بروزرسانی درخواست"));
      }
      await fetchRequest();
      setReviewNote("");
      setReviewNoteError("");
      return true;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در بروزرسانی درخواست");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartProposalRevision = async () => {
    const started = await handleStatusChange("PROPOSAL_PENDING");
    if (started) router.push(`/admin/requests/${id}/proposal`);
  };

  const handleRequiredNoteTransition = async (newStatus: RequestStatus) => {
    if (!reviewNote.trim()) {
      setReviewNoteError("ابتدا پیام قابل نمایش برای متقاضی را در کادر یادداشت بنویسید.");
      reviewNoteRef.current?.focus();
      return;
    }

    await handleStatusChange(newStatus);
  };

  const handleAddNote = async () => {
    if (!request || !reviewNote.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: reviewNote,
          action: "NOTE",
        }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(getApiErrorMessage(payload, "خطا در ذخیره یادداشت"));
      }
      await fetchRequest();
      setReviewNote("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "خطا در ذخیره یادداشت");
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

  if (error || !request) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg">
        {error || "درخواست یافت نشد"}
      </div>
    );
  }

  const role = isAppRole(session?.user?.role) ? session.user.role : null;
  const canTransitionTo = (status: RequestStatus) =>
    Boolean(role && canRoleTransitionRequest(request.status as RequestStatus, status, role));
  const canCreateProposal = Boolean(role && roleIsAllowed(role, PROPOSAL_MANAGE_ROLES));
  const canCreateContract = Boolean(role && roleIsAllowed(role, SUPPLY_ROLES));
  const canManageRequest = Boolean(role && roleIsAllowed(role, REQUEST_WRITE_ROLES));
  const canAccessDocuments = Boolean(role && roleIsAllowed(role, DOCUMENT_ACCESS_ROLES));
  const canVerifyDocuments = Boolean(role && roleIsAllowed(role, DOCUMENT_VERIFY_ROLES));
  const documentReadiness = getRequestDocumentReadiness(request.id, request.documents.map((document) => ({
    requestId: request.id,
    type: document.type,
    verified: document.verified,
  })), {
    operationalStatus: request.operationalStatus,
    hasExistingContract: request.hasExistingContract,
  });
  const resumingAfterSupplyDocumentRequest = request.reviews.find(
    ({ action }) => action === "NEED_INFO",
  )?.fromStatus === "INFORMATION_SUBMITTED";
  const canResumeSupplyDocumentReview = resumingAfterSupplyDocumentRequest &&
    canTransitionTo("OWNERSHIP_REVIEW");
  const canCreateAsset = Boolean(role && roleIsAllowed(role, TECHNICAL_ROLES));
  const transitionTargets: RequestStatus[] = [
    "INITIAL_REVIEW", "APPROVED", "NEEDS_INFORMATION", "REJECTED", "OWNERSHIP_REVIEW", "PROPOSAL_PENDING",
  ];
  const hasActions = transitionTargets.some(canTransitionTo) ||
    (request.status === "PROPOSAL_PENDING" && canCreateProposal) ||
    (request.status === "PROPOSAL_ACCEPTED" && canCreateContract) ||
    (request.status === "CONTRACT_PENDING" && Boolean(request.contractId));

  const canReject = canTransitionTo("REJECTED");
  const latestRejectedProposal = request.proposals.find(({ status }) => status === "REJECTED") ?? null;
  const canCreateMasterAgreement = canCreateScenario142MasterAgreement(
    request.party.type,
    request.contractCreation.eligibleMasterAgreementRequestCount,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/requests"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">درخواست {request.caseNumber}</h1>
            <StatusBadge status={request.status as any} />
            {request.status === "CONTRACT_SIGNED" && request.asset?.status !== "ACTIVE" && <Badge status="PENDING">در انتظار بهره‌برداری</Badge>}
          </div>
          <p className="text-muted-foreground">
            ثبت شده در {formatPersianDate(request.createdAt)}
          </p>
        </div>
      </div>

      {(request.asset?.status ?? request.operationalStatus) !== "ACTIVE" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          این نیروگاه هنوز عملیاتی نیست. بررسی، پیشنهاد و امضای قرارداد مجاز است؛ فعال‌سازی قرارداد تا ثبت بهره‌برداری واقعی، اتصال شبکه و کنتور تأییدشده مسدود می‌ماند.
        </div>
      )}
      {request.hasExistingContract && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">
          <p className="font-semibold">کنترل تعارض قرارداد فروش موجود</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <span>طرف قرارداد: {request.existingContractCounterparty ?? "ثبت نشده"}</span>
            <span>بازه: {request.existingContractStart ? formatPersianDate(request.existingContractStart) : "-"} تا {request.existingContractEnd ? formatPersianDate(request.existingContractEnd) : "-"}</span>
            <span>ظرفیت متعهد: {request.existingContractCommittedCapacity?.toLocaleString("fa-IR") ?? "-"} کیلووات</span>
            <span>{request.existingContractExclusive ? "انحصاری" : "غیرانحصاری"} · {request.existingContractRightToSellConfirmed ? "تعهد حق فروش ثبت شده" : "تعهد حق فروش ثبت نشده"}</span>
          </div>
          {request.existingContractRestrictions && <p className="mt-2 text-muted-foreground">محدودیت‌ها: {request.existingContractRestrictions}</p>}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`grid w-full ${canAccessDocuments ? "grid-cols-6" : "grid-cols-5"}`}>
              <TabsTrigger value="info">اطلاعات</TabsTrigger>
              <TabsTrigger value="party">طرف</TabsTrigger>
              <TabsTrigger value="asset">دارایی</TabsTrigger>
              <TabsTrigger value="location">مکان</TabsTrigger>
              {canAccessDocuments && <TabsTrigger value="documents">مدارک</TabsTrigger>}
              <TabsTrigger value="history">تاریخچه</TabsTrigger>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    اطلاعات درخواست
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        نوع نیروگاه
                      </p>
                      <p className="font-medium">
                        {plantTypeLabels[request.plantType]}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">ظرفیت</p>
                      <p className="font-medium">
                        {request.capacity.toLocaleString()} کیلووات
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">استان</p>
                      <p className="font-medium">{request.province}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">شهر</p>
                      <p className="font-medium">{request.city}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        وضعیت بهره‌برداری
                      </p>
                      <p className="font-medium">
                        {operationalStatusLabels[request.operationalStatus]}
                      </p>
                    </div>
                    {request.avgMonthlyGeneration && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          میانگین تولید ماهانه
                        </p>
                        <p className="font-medium">
                          {request.avgMonthlyGeneration.toLocaleString()}{" "}
                          کیلووات‌ساعت
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="location">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="rounded-full bg-teal-600 p-2">
                      <MapPin className="h-5 w-5 text-white" />
                    </div>
                    مکان نیروگاه
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">استان</p>
                    <p className="font-medium">{request.asset?.province ?? request.province}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">شهر</p>
                    <p className="font-medium">{request.asset?.city ?? request.city}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">آدرس</p>
                    <p className="font-medium">{request.asset?.address || "ثبت نشده"}</p>
                  </div>
                  {request.asset?.gridCompany && (
                    <div>
                      <p className="text-sm text-muted-foreground">شرکت برق مرتبط</p>
                      <p className="font-medium">{request.asset.gridCompany}</p>
                    </div>
                  )}
                  {request.asset?.connectionPoint && (
                    <div>
                      <p className="text-sm text-muted-foreground">نقطه اتصال</p>
                      <p className="font-medium">{request.asset.connectionPoint}</p>
                    </div>
                  )}
                  {request.asset?.latitude != null && request.asset.longitude != null && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">مختصات جغرافیایی</p>
                      <p className="font-medium" dir="ltr">{request.asset.latitude}, {request.asset.longitude}</p>
                    </div>
                  )}
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
                        {request.party.type === "PERSON"
                          ? "شخص حقیقی"
                          : "شخص حقوقی"}
                      </p>
                    </div>
                    {request.party.nationalId && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {request.party.type === "PERSON"
                            ? "کد ملی"
                            : "شناسه ملی"}
                        </p>
                        <p className="font-medium font-mono">
                          {request.party.nationalId}
                        </p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">تماس</p>
                      <p className="font-medium">{request.contactMobile}</p>
                    </div>
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
                          {plantTypeLabels[request.asset.type]}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          ظرفیت نامی
                        </p>
                        <p className="font-medium">
                          {request.asset.capacityNominal.toLocaleString()}{" "}
                          کیلووات
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
                    canManageRequest && <AssetLinkSection
                      requestId={request.id}
                      partyId={request.partyId}
                      canCreateAsset={canCreateAsset}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            {canAccessDocuments && <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <Image className="h-5 w-5 text-white" />
                    </div>
                    مدارک بارگذاری شده
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  {request.documents.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      هنوز مدرکی بارگذاری نشده است
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {request.documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          className={`flex items-start justify-between p-4 border rounded-lg ${
                            doc.verified ? "bg-white border-gray-200" : ""
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`p-1.5 rounded-full border ${doc.verified ? "border-teal-600" : "border-gray-100"}`}
                            >
                              <NotepadText
                                className={`h-5 w-5 ${doc.verified ? "text-teal-600" : "text-gray-400"}`}
                              />
                            </div>
                            <div>
                              <p className="font-medium">{getDocumentTypeLabel(doc.type)}</p>
                              <p className="text-sm text-muted-foreground">
                                {doc.fileName}
                              </p>
                              {doc.verifiedBy && (
                                <p className="text-xs text-muted-foreground">
                                  تایید شده توسط: {doc.verifiedByName ?? "کارشناس سامانه"}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.verified ? (
                              <Badge
                                status="APPROVED"
                              >
                                <CheckCircle2 className="h-3 w-3 ml-1" />
                                تایید شده
                              </Badge>
                            ) : canVerifyDocuments ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  await fetch(`/api/documents/${doc.id}`, {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({ verified: true }),
                                  });
                                  fetchRequest();
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 ml-1" />
                                تایید
                              </Button>
                            ) : null}
                            <a
                              href={doc.fileUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="ghost">
                                <Download className="h-4 w-4" />
                              </Button>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>}

            {/* History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="bg-teal-600 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    تاریخچه بررسی
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {request.reviews.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      هنوز بررسی انجام نشده است
                    </p>
                  ) : (
                    request.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {review.reviewer?.name || "سیستم"}
                            </Badge>
                            {review.action === "NOTE" ? (
                              <Badge variant="outline" className="text-xs">
                                <MessageSquare className="h-3 w-3 ml-1" />
                                یادداشت
                              </Badge>
                            ) : (
                              <StatusBadge status={review.toStatus as any} />
                            )}
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
          <div className="flex items-start w-full gap-4">
            {/* Review Note */}
            {canManageRequest && <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-sm">پیام و یادداشت بررسی</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  برای درخواست اطلاعات یا رد درخواست، پیام را بنویسید و مستقیماً همان دکمه عملیات را بزنید. «ثبت یادداشت داخلی» فقط یادداشت را بدون تغییر وضعیت ذخیره می‌کند.
                </p>
                <div className="relative">
                  <Textarea
                    ref={reviewNoteRef}
                    placeholder="پیام یا دلیل تصمیم را اینجا بنویسید..."
                    value={reviewNote}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setReviewNote(e.target.value);
                        if (e.target.value.trim()) setReviewNoteError("");
                      }
                    }}
                    rows={3}
                    maxLength={500}
                  />
                  <span className={`absolute bottom-2 left-2 text-xs ${reviewNote.length >= 450 ? "text-destructive" : "text-muted-foreground"}`}>
                    {reviewNote.length}/500
                  </span>
                </div>
                {reviewNoteError && (
                  <p className="text-xs text-destructive" role="alert">{reviewNoteError}</p>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleAddNote}
                  disabled={isSubmitting || !reviewNote.trim()}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4 ml-2" />
                  )}
                  ثبت یادداشت داخلی
                </Button>
              </CardContent>
            </Card>}

            {/* Actions */}
            {hasActions && (
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-sm">عملیات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {request.status === "SUBMITTED" && canTransitionTo("INITIAL_REVIEW") && (
                    <Button
                      className="w-full justify-start"
                      onClick={() => handleStatusChange("INITIAL_REVIEW")}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 ml-2" />
                      )}
                      بررسی اولیه
                    </Button>
                  )}
                  {request.status === "INITIAL_REVIEW" && (
                    <>
                      {canTransitionTo("APPROVED") && <Button
                        className="w-full justify-start"
                        onClick={() => handleStatusChange("APPROVED")}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 ml-2" />
                        )}
                        تأیید اولیه
                      </Button>}
                      {canTransitionTo("NEEDS_INFORMATION") && <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleRequiredNoteTransition("NEEDS_INFORMATION")}
                        disabled={isSubmitting}
                      >
                        <MessageSquare className="h-4 w-4 ml-2" />
                        درخواست اطلاعات
                      </Button>}
                      {canTransitionTo("REJECTED") && <Button
                        variant="destructive"
                        className="w-full justify-start"
                        onClick={() => handleRequiredNoteTransition("REJECTED")}
                        disabled={isSubmitting}
                      >
                        <XCircle className="h-4 w-4 ml-2" />
                        رد درخواست
                      </Button>}
                    </>
                  )}
                  {request.status === "NEEDS_INFORMATION" && (
                    <>
                      {canResumeSupplyDocumentReview && documentReadiness.submitted && (
                        <Button
                          className="w-full justify-start"
                          onClick={() => handleStatusChange("OWNERSHIP_REVIEW")}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                          ارجاع به بررسی فنی
                        </Button>
                      )}
                      {canResumeSupplyDocumentReview && !documentReadiness.submitted && (
                        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                          <p>پس از بارگذاری تمام مدارک الزامی، ارجاع به بررسی فنی فعال می‌شود.</p>
                          <p>مدارک باقیمانده: {documentReadiness.missingTypes.map(getDocumentTypeLabel).join("، ")}</p>
                        </div>
                      )}
                      {!canResumeSupplyDocumentReview && (
                        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                          منتظر ارسال اطلاعات توسط متقاضی باشید.
                        </div>
                      )}
                    </>
                  )}
                  {request.status === "INFORMATION_SUBMITTED" && (
                    <>
                      {documentReadiness.submitted && canTransitionTo("OWNERSHIP_REVIEW") ? (
                        <Button
                          className="w-full justify-start"
                          onClick={() => handleStatusChange("OWNERSHIP_REVIEW")}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 ml-2" />
                          )}
                          ارجاع به بررسی فنی
                        </Button>
                      ) : (
                        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                          <p>ارجاع فنی تا بارگذاری تمام مدارک الزامی امکان‌پذیر نیست.</p>
                          <p>مدارک باقیمانده: {documentReadiness.missingTypes.map(getDocumentTypeLabel).join("، ")}</p>
                        </div>
                      )}
                      {!documentReadiness.submitted && canTransitionTo("NEEDS_INFORMATION") && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => handleRequiredNoteTransition("NEEDS_INFORMATION")}
                          disabled={isSubmitting}
                        >
                          <MessageSquare className="h-4 w-4 ml-2" />
                          درخواست بارگذاری مدارک
                        </Button>
                      )}
                    </>
                  )}
                  {request.status === "APPROVED" && (
                    <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                      منتظر تکمیل و ارسال اطلاعات نیروگاه توسط متقاضی باشید.
                    </div>
                  )}
                  {request.status === "OWNERSHIP_REVIEW" && (
                    <>
                      {canTransitionTo("PROPOSAL_PENDING") && (
                        <>
                          <Button
                            className="w-full justify-start"
                            onClick={() => handleStatusChange("PROPOSAL_PENDING")}
                            disabled={isSubmitting || !documentReadiness.ready}
                          >
                            {isSubmitting ? (
                              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 ml-2" />
                            )}
                            ارجاع به مرحله پیشنهاد
                          </Button>
                          {!documentReadiness.ready && (
                            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                              ابتدا مدارک این پرونده تکمیل و تأیید شوند. ناقص یا تأییدنشده: {[...documentReadiness.missingTypes, ...documentReadiness.unverifiedTypes].map(getDocumentTypeLabel).join("، ")}
                            </p>
                          )}
                        </>
                      )}
                      {canTransitionTo("NEEDS_INFORMATION") && <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleRequiredNoteTransition("NEEDS_INFORMATION")}
                        disabled={isSubmitting}
                      >
                        <MessageSquare className="h-4 w-4 ml-2" />
                        درخواست اطلاعات
                      </Button>}
                    </>
                  )}
                  {request.status === "PROPOSAL_PENDING" && canCreateProposal && (
                    <Link href={`/admin/requests/${id}/proposal`}>
                      <Button className="w-full justify-start">
                        <Send className="h-4 w-4 ml-2" />
                        تهیه پیشنهاد قیمت
                      </Button>
                    </Link>
                  )}
                  {request.status === "PROPOSAL_READY" && (
                    <div className="p-3 text-sm bg-blue-50 text-blue-700 rounded-lg">
                      پیشنهاد ارسال شده. منتظر پاسخ مشتری باشید.
                    </div>
                  )}
                  {request.status === "PROPOSAL_ACCEPTED" && canCreateContract && (
                    <div className="space-y-2">
                      <Link href={`/admin/requests/${id}/contract`}>
                        <Button className="w-full justify-start">
                          <FileText className="h-4 w-4 ml-2" />
                          تنظیم قرارداد تک‌نیروگاهی
                        </Button>
                      </Link>
                      {canCreateMasterAgreement && (
                        <Link href={`/admin/contracts/new?mode=master&requestId=${id}`}>
                          <Button variant="outline" className="w-full justify-start">
                            <Building2 className="h-4 w-4 ml-2" />
                            ایجاد توافق‌نامه مادر
                          </Button>
                        </Link>
                      )}
                      {request.party.type === "COMPANY" && !canCreateMasterAgreement && (
                        <p className="rounded-md bg-muted p-2 text-xs leading-5 text-muted-foreground">
                          این شرکت فعلاً یک پرونده واجد شرایط دارد؛ بنابراین قرارداد عادی برای همین نیروگاه ساخته می‌شود. توافق‌نامه مادر پس از پذیرش پیشنهاد حداقل دو نیروگاه مستقل در دسترس خواهد بود.
                        </p>
                      )}
                    </div>
                  )}
                  {request.status === "CONTRACT_PENDING" && (
                    <div className="p-3 text-sm bg-blue-50 text-blue-700 rounded-lg">
                      قرارداد در حال تنظیم است.
                      {request.contractId && (
                        <Link
                          href={`/admin/contracts/${request.contractId}`}
                          className="block mt-2 underline"
                        >
                          مشاهده قرارداد
                        </Link>
                      )}
                    </div>
                  )}
                  {request.status === "PROPOSAL_REJECTED" && (
                    <div className="space-y-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-medium">پیشنهاد قبلی توسط فروشنده رد شده و پرونده آماده بازنگری است.</p>
                      {latestRejectedProposal && (
                        <div className="space-y-1 text-xs">
                          <p>نرخ قبلی: {latestRejectedProposal.pricePerKwh.toLocaleString("fa-IR")} ریال به‌ازای هر کیلووات‌ساعت</p>
                          <p>دلیل فروشنده: {latestRejectedProposal.customerNote}</p>
                        </div>
                      )}
                      {canTransitionTo("PROPOSAL_PENDING") && (
                        <Button className="w-full justify-start" onClick={handleStartProposalRevision} disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                          تهیه پیشنهاد جدید
                        </Button>
                      )}
                    </div>
                  )}
                  {canReject && request.status !== "INITIAL_REVIEW" && (
                    <>
                      <Separator className="my-2" />
                      <Button
                        variant="outline"
                        className="w-full justify-start text-destructive"
                        onClick={() => handleRequiredNoteTransition("REJECTED")}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4 ml-2" />
                        )}
                        رد درخواست
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Workflow Timeline */}
          <Card>
            <CardContent className="">
              <WorkflowTimeline currentStatus={request.status as any} />
            </CardContent>
          </Card>

          {/* Documents */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="text-sm">مدارک</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {request.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  مدارکی آپلود نشده
                </p>
              ) : (
                request.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between text-sm">
                    <span>{doc.fileName}</span>
                    {doc.verified ? (
                      <CheckCircle2 className="h-4 w-4 text-teal-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card> */}
        </div>
      </div>
    </div>
  );
}

// کامپوننت لینک دارایی
function AssetLinkSection({
  requestId,
  partyId,
  canCreateAsset,
}: Readonly<{
  requestId: string;
  partyId: string;
  canCreateAsset: boolean;
}>) {
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const res = await fetch(`/api/assets?ownerId=${partyId}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedAssetId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selectedAssetId }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-center">
        دارایی به این درخواست لینک نشده است
      </p>
      {assets.length > 0 ? (
        <div className="flex items-center gap-2">
          <SelectWithLabels
            value={selectedAssetId}
            onValueChange={(v) => setSelectedAssetId(v || "")}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="انتخاب دارایی" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((asset: any) => (
                <SelectItem key={asset.id} value={asset.id}>
                  {asset.name} - {asset.capacityNominal} kW
                </SelectItem>
              ))}
            </SelectContent>
          </SelectWithLabels>
          <Button onClick={handleLink} disabled={!selectedAssetId || linking}>
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : "لینک"}
          </Button>
        </div>
      ) : canCreateAsset ? (
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            هیچ دارایی برای این مشتری یافت نشد
          </p>
          <Link href="/admin/assets/new">
            <Button size="sm">
              <Building2 className="h-4 w-4 ml-2" />
              ایجاد دارایی جدید
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
