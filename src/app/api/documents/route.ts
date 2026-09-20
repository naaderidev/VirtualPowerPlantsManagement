import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { Prisma, type DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { DOCUMENT_ACCESS_ROLES, canAccessParty, isCustomerUser } from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { documentListQuerySchema, uploadDocumentSchema } from "@/lib/api-schemas";
import {
  BusinessRuleError,
  apiError,
  handleRouteError,
  parseSearchParams,
  validateInput,
} from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import {
  REQUEST_DOCUMENT_TYPES,
  canCustomerUploadRequestDocuments,
} from "@/domain/documents";

const CUSTOMER_DOCUMENT_TYPES: ReadonlySet<DocumentType> = new Set(
  REQUEST_DOCUMENT_TYPES.map(({ type }) => type)
);

// POST /api/documents - Upload a document
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(DOCUMENT_ACCESS_ROLES);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const parsed = validateInput(
      { file: formData.get("file"), requestId: formData.get("requestId"), type: formData.get("type") },
      uploadDocumentSchema,
      request
    );
    if (!parsed.ok) return parsed.response;
    const { file, requestId, type: documentType } = parsed.data;

    const requestRecord = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        partyId: true,
        reviews: {
          where: {
            fromStatus: "INITIAL_REVIEW",
            OR: [
              { action: "APPROVE", toStatus: "APPROVED" },
              { action: "NEED_INFO", toStatus: "NEEDS_INFORMATION" },
            ],
          },
          take: 1,
          select: { action: true, fromStatus: true, toStatus: true },
        },
      },
    });
    if (!requestRecord) {
      return apiError(404, "NOT_FOUND", "درخواست پیدا نشد.", { request });
    }
    if (!canAccessParty(auth.user, requestRecord.partyId)) return forbiddenResponse();
    if (
      isCustomerUser(auth.user) &&
      !canCustomerUploadRequestDocuments(requestRecord.reviews)
    ) {
      throw new BusinessRuleError(
        "بارگذاری مدارک پس از پایان بررسی اولیه درخواست امکان‌پذیر است.",
        "CONFLICT",
        409,
        {
          requestId: [
            "کارشناس تأمین هنوز نتیجه بررسی اولیه درخواست را ثبت نکرده است.",
          ],
        },
      );
    }
    if (isCustomerUser(auth.user) && !CUSTOMER_DOCUMENT_TYPES.has(documentType)) {
      return apiError(422, "VALIDATION_ERROR", "نوع مدرک برای بارگذاری در پرونده مجاز نیست.", {
        request,
        details: { type: ["این نوع مدرک مخصوص گردش کار داخلی است."] },
      });
    }

    const existingDocument = await prisma.requestDocument.findUnique({
      where: { requestId_type: { requestId, type: documentType } },
      select: { id: true },
    });
    if (existingDocument) {
      throw new BusinessRuleError(
        "برای این نوع مدرک قبلاً فایل ثبت شده است؛ ابتدا فایل قبلی را حذف کنید.",
        "CONFLICT",
        409,
        { type: ["برای هر پرونده از هر نوع مدرک فقط یک فایل فعال مجاز است."] }
      );
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), "storage", "uploads", requestId);
    await mkdir(uploadDir, { recursive: true });

    // Generate filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filepath = join(uploadDir, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const auditMetadata = getAuditMetadata(request, parsed.correlationId);
    let document;
    try {
      document = await prisma.$transaction(async (transaction) => {
        const created = await transaction.requestDocument.create({
          data: {
            requestId,
            type: documentType,
            fileName: file.name,
            fileUrl: `/private-uploads/${requestId}/${filename}`,
            fileSize: file.size,
            uploadedById: auth.user.id,
          },
        });

        await transaction.auditLog.create({
          data: {
            entityType: "RequestDocument",
            entityId: created.id,
            action: "UPLOAD_DOCUMENT",
            userId: auth.user.id,
            changes: { requestId, type: documentType, fileName: file.name, fileSize: file.size },
            ...auditMetadata,
          },
        });

        return created;
      });
    } catch (error) {
      await unlink(filepath).catch((fileError: NodeJS.ErrnoException) => {
        if (fileError.code !== "ENOENT") console.error("Failed to clean up document file", fileError);
      });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BusinessRuleError(
          "برای این نوع مدرک قبلاً فایل ثبت شده است.",
          "CONFLICT",
          409,
          { type: ["برای هر پرونده از هر نوع مدرک فقط یک فایل فعال مجاز است."] }
        );
      }
      throw error;
    }

    return apiJson(
      { ...document, fileUrl: `/api/documents/${document.id}/download` },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(request, error, "upload document");
  }
}

// GET /api/documents?requestId=xxx - Get documents for a request
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(DOCUMENT_ACCESS_ROLES);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, documentListQuerySchema);
    if (!query.ok) return query.response;
    const { requestId } = query.data;

    const requestRecord = await prisma.request.findUnique({
      where: { id: requestId },
      select: { partyId: true },
    });
    if (!requestRecord) {
      return apiError(404, "NOT_FOUND", "درخواست پیدا نشد.", { request });
    }
    if (!canAccessParty(auth.user, requestRecord.partyId)) return forbiddenResponse();

    const documents = await prisma.requestDocument.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
    });

    return apiJson(
      documents.map((document) => ({
        ...document,
        fileUrl: `/api/documents/${document.id}/download`,
      }))
    );
  } catch (error) {
    return handleRouteError(request, error, "fetch documents");
  }
}
