import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { basename, join } from "path";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_ACCESS_ROLES, DOCUMENT_VERIFY_ROLES, canAccessParty } from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { verifyDocumentSchema } from "@/lib/api-schemas";
import {
  BusinessRuleError,
  getCorrelationId,
  handleRouteError,
  parseJsonBody,
  requireExistingRecord,
} from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import {
  getRequestDocumentReadiness,
  shouldResumeOwnershipReviewAfterDocumentVerification,
} from "@/domain/documents";

// PATCH /api/documents/[id] - Verify/reject a document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(DOCUMENT_VERIFY_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, verifyDocumentSchema);
    if (!parsed.ok) return parsed.response;

    const existing = await requireExistingRecord(
      prisma.requestDocument.findUnique({
        where: { id },
        include: {
          request: {
            select: {
              status: true,
              operationalStatus: true,
              hasExistingContract: true,
              reviews: {
                where: { action: "NEED_INFO" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { action: true, fromStatus: true, toStatus: true },
              },
            },
          },
        },
      }),
      "مدرک پیدا نشد."
    );
    const auditMetadata = getAuditMetadata(request, parsed.correlationId);
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.requestDocument.updateMany({
        where: { id, verified: existing.verified },
        data: {
          verified: parsed.data.verified,
          verifiedBy: parsed.data.verified ? auth.user.id : null,
        },
      });
      if (result.count !== 1) {
        throw new BusinessRuleError(
          "وضعیت مدرک هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.",
          "CONFLICT",
          409
        );
      }

      const requestDocuments = await transaction.requestDocument.findMany({
        where: { requestId: existing.requestId },
        select: { requestId: true, type: true, verified: true },
      });
      const documentsReady = getRequestDocumentReadiness(
        existing.requestId,
        requestDocuments,
        {
          operationalStatus: existing.request.operationalStatus,
          hasExistingContract: existing.request.hasExistingContract,
        },
      ).ready;
      const shouldResumeOwnershipReview =
        shouldResumeOwnershipReviewAfterDocumentVerification({
          requestStatus: existing.request.status,
          latestNeedInformationReview: existing.request.reviews[0] ?? null,
          documentsReady,
          documentIsBeingVerified: parsed.data.verified,
        });

      if (shouldResumeOwnershipReview) {
        const requestUpdate = await transaction.request.updateMany({
          where: {
            id: existing.requestId,
            status: existing.request.status,
          },
          data: { status: "OWNERSHIP_REVIEW" },
        });
        if (requestUpdate.count !== 1) {
          throw new BusinessRuleError(
            "وضعیت درخواست هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.",
            "CONFLICT",
            409,
          );
        }

        await transaction.requestReview.create({
          data: {
            requestId: existing.requestId,
            reviewerId: auth.user.id,
            action: "START_OWNERSHIP_REVIEW",
            fromStatus: existing.request.status,
            toStatus: "OWNERSHIP_REVIEW",
            notes: "اصلاحات مدارک تأیید شد و پرونده به بررسی مالکیت بازگشت.",
          },
        });
        await transaction.auditLog.create({
          data: {
            entityType: "Request",
            entityId: existing.requestId,
            action: "STATUS_CHANGE",
            userId: auth.user.id,
            changes: {
              before: { status: existing.request.status },
              after: { status: "OWNERSHIP_REVIEW" },
              trigger: "ALL_CORRECTED_DOCUMENTS_VERIFIED",
            },
            ...auditMetadata,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          entityType: "RequestDocument",
          entityId: id,
          action: parsed.data.verified ? "VERIFY_DOCUMENT" : "REOPEN_DOCUMENT",
          userId: auth.user.id,
          changes: {
            requestId: existing.requestId,
            type: existing.type,
            before: { verified: existing.verified, verifiedBy: existing.verifiedBy },
            after: {
              verified: parsed.data.verified,
              verifiedBy: parsed.data.verified ? auth.user.id : null,
            },
          },
          ...auditMetadata,
        },
      });

      return transaction.requestDocument.findUniqueOrThrow({ where: { id } });
    });

    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "verify document");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(DOCUMENT_ACCESS_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const document = await requireExistingRecord(
      prisma.requestDocument.findUnique({
        where: { id },
        include: { request: { select: { partyId: true } } },
      }),
      "مدرک پیدا نشد."
    );
    if (!canAccessParty(auth.user, document.request.partyId)) return forbiddenResponse();
    if (document.verified) {
      throw new BusinessRuleError("مدرک تأییدشده قابل حذف نیست.", "CONFLICT", 409);
    }

    const auditMetadata = getAuditMetadata(request, getCorrelationId(request));
    await prisma.$transaction(async (transaction) => {
      const deleted = await transaction.requestDocument.deleteMany({ where: { id, verified: false } });
      if (deleted.count !== 1) {
        throw new BusinessRuleError("مدرک هم‌زمان تأیید شده و دیگر قابل حذف نیست.", "CONFLICT", 409);
      }

      await transaction.auditLog.create({
        data: {
          entityType: "RequestDocument",
          entityId: id,
          action: "DELETE_DOCUMENT",
          userId: auth.user.id,
          changes: {
            requestId: document.requestId,
            type: document.type,
            fileName: document.fileName,
          },
          ...auditMetadata,
        },
      });
    });

    const storedName = basename(document.fileUrl);
    const directory = document.fileUrl.startsWith("/uploads/")
      ? join(process.cwd(), "public", "uploads")
      : join(process.cwd(), "storage", "uploads");
    const filePath = join(directory, document.requestId, storedName);
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") console.error(`Failed to remove document file ${id}`, error);
    });

    return apiJson({ deleted: true, id });
  } catch (error) {
    return handleRouteError(request, error, "delete document");
  }
}
