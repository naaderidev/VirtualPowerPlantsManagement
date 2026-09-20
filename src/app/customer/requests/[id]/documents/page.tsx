"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Upload, File, CheckCircle2, Trash2, Loader2, ExternalLink, Download } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  REQUEST_DOCUMENT_TYPES,
  canCustomerUploadRequestDocuments,
  getRequiredRequestDocumentTypes,
} from "@/domain/documents";

const DOCUMENT_TYPES = REQUEST_DOCUMENT_TYPES;

interface UploadedDoc {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  verified: boolean;
}

interface RequestContext {
  caseNumber: string;
  party: { displayName: string };
  asset: { name: string } | null;
  operationalStatus: string;
  hasExistingContract: boolean;
  reviews: Array<{
    action: string;
    fromStatus: string;
    toStatus: string;
  }>;
}

export default function UploadDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [requestContext, setRequestContext] = useState<RequestContext | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch(`/api/documents?requestId=${id}`).then(async (response) => {
        if (!response.ok) throw new Error("خطا در بارگذاری مدارک");
        return response.json() as Promise<UploadedDoc[]>;
      }),
      fetch(`/api/requests/${id}`).then(async (response) => {
        if (!response.ok) throw new Error("خطا در دریافت مشخصات پرونده");
        return response.json() as Promise<RequestContext>;
      }),
    ])
      .then(([documentData, contextData]) => {
        if (active) {
          setDocuments(documentData);
          setRequestContext(contextData);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "خطا در بارگذاری مدارک");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleFileUpload = async (docType: string, file: File) => {
    if (
      !requestContext ||
      !canCustomerUploadRequestDocuments(requestContext.reviews)
    ) {
      setError("بارگذاری مدارک پس از پایان بررسی اولیه درخواست امکان‌پذیر است.");
      return;
    }

    setUploading(docType);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("requestId", id);
      formData.append("type", docType);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(getApiErrorMessage(err, "خطا در بارگذاری"));
      }

      const data = await res.json();
      setDocuments((prev) => [...prev, data]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطا در بارگذاری");
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveFile = async (docId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getApiErrorMessage(body, "خطا در حذف فایل"));
      setDocuments((prev) => prev.filter((document) => document.id !== docId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطا در حذف فایل");
    }
  };

  const getDocForType = (type: string) => documents.find((d) => d.type === type);
  const requiredTypes = getRequiredRequestDocumentTypes({
    operationalStatus: requestContext?.operationalStatus,
    hasExistingContract: requestContext?.hasExistingContract,
  });
  const uploadedCount = requiredTypes.filter((type) => getDocForType(type)).length;
  const canUploadDocuments = Boolean(
    requestContext &&
      canCustomerUploadRequestDocuments(requestContext.reviews),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/customer/requests/${id}`} className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">بارگذاری مدارک</h1>
          <p className="text-muted-foreground">
            {requestContext
              ? `${requestContext.caseNumber} • ${requestContext.party.displayName} • ${requestContext.asset?.name ?? "نیروگاه تکمیل‌نشده"}`
              : "مدارک مورد نیاز همین پرونده را بارگذاری کنید"}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>
      )}

      {!canUploadDocuments && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="text-sm text-amber-900">
            بارگذاری مدارک هنوز فعال نیست. پس از ثبت نتیجه بررسی اولیه توسط
            کارشناس تأمین، امکان بارگذاری مدارک برای این پرونده فعال می‌شود.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">پیشرفت بارگذاری</span>
            <span className="text-sm font-medium">
              {uploadedCount} از {requiredTypes.length} مدرک الزامی
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${requiredTypes.length ? (uploadedCount / requiredTypes.length) * 100 : 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {DOCUMENT_TYPES.map((docType) => {
          const uploaded = getDocForType(docType.type);
          const isUploading = uploading === docType.type;

          return (
            <Card key={docType.type}>
              <CardContent className="">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${uploaded ? "bg-green-100" : "bg-gray-100"}`}>
                      <File className={`h-6 w-6 ${uploaded ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{docType.label}</p><Badge variant="outline">{requiredTypes.includes(docType.type) ? "الزامی این مرحله" : ["CONNECTION", "METER"].includes(docType.type) && requestContext?.operationalStatus !== "ACTIVE" ? "الزامی پیش از بهره‌برداری" : "اختیاری"}</Badge></div>
                      {uploaded ? (
                        <p className="text-sm text-muted-foreground">{uploaded.fileName}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">فایلی بارگذاری نشده</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploaded ? (
                      <>
                        <Badge status={uploaded.verified ? "APPROVED" : "PENDING"}>
                          <CheckCircle2 className="h-3 w-3 ml-1" />
                          {uploaded.verified ? "تأیید شده" : "بارگذاری شد"}
                        </Badge>
                        <a
                          href={`${uploaded.fileUrl}?preview=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`مشاهده ${docType.label}`}
                          className={buttonVariants({ variant: "outline", size: "icon" })}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <a
                          href={uploaded.fileUrl}
                          aria-label={`دانلود ${docType.label}`}
                          className={buttonVariants({ variant: "outline", size: "icon" })}
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        {!uploaded.verified && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`حذف ${docType.label}`}
                            onClick={() => handleRemoveFile(uploaded.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    ) : canUploadDocuments ? (
                      <>
                        <input
                          ref={(el) => { fileInputRefs.current[docType.type] = el; }}
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(docType.type, file);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[docType.type]?.click()}
                        >
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 ml-2" />
                          )}
                          {isUploading ? "در حال بارگذاری..." : "بارگذاری"}
                        </Button>
                      </>
                    ) : (
                      <Badge status="PENDING">پس از بررسی اولیه</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-start mt-6">
        <Link href={`/customer/requests/${id}`}>
          <Button variant="outline">بازگشت</Button>
        </Link>
      </div>
    </div>
  );
}
