import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  INTERNAL_ROLES,
  REQUEST_WRITE_ROLES,
  canAccessParty,
  isCustomerUser,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { updateRequestSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { canAddRequestNote, evaluateRequestTransition } from "@/domain/requests/workflow";
import { resolveRequestStatusFromSettlements } from "@/domain/requests/financial-progress";
import { getRequestDocumentReadiness } from "@/domain/documents";

// GET /api/requests/[id] - Get a specific request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      include: {
        party: true,
        initiator: { select: { name: true, role: true } },
        asset: { include: { meters: true, generationProfile: true } },
        contract: { select: { status: true, terminationDate: true, settlements: { select: { status: true } } } },
        documents: true,
        proposals: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            pricePerKwh: true,
            duration: true,
            status: true,
            customerNote: true,
            createdAt: true,
          },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            reviewer: {
              select: { name: true, role: true },
            },
          },
        },
      },
    });

    if (!requestRecord) {
      return apiError(404, "NOT_FOUND", "درخواست پیدا نشد.", { request });
    }

    if (
      isCustomerUser(auth.user) &&
      !canAccessParty(auth.user, requestRecord.partyId)
    ) {
      return forbiddenResponse();
    }

    const verifierIds = requestRecord.documents
      .map(({ verifiedBy }) => verifiedBy)
      .filter((verifiedBy): verifiedBy is string => Boolean(verifiedBy));
    const verifiers = verifierIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: verifierIds } },
          select: { id: true, name: true },
        })
      : [];
    const verifierNames = new Map(verifiers.map(({ id: userId, name }) => [userId, name]));

    const { contract, ...requestData } = requestRecord;
    const eligibleMasterAgreementRequestCount = requestRecord.party.type === "COMPANY"
      ? await prisma.request.count({
          where: {
            partyId: requestRecord.partyId,
            status: "PROPOSAL_ACCEPTED",
            contractId: null,
            assetId: { not: null },
            proposals: { some: { status: "ACCEPTED" } },
          },
        })
      : 0;
    const status = resolveRequestStatusFromSettlements(
      requestRecord.status,
      contract?.settlements.map((settlement) => settlement.status) ?? [],
    );

    return apiJson({
      ...requestData,
      status,
      contract: contract ? { status: contract.status, terminationDate: contract.terminationDate } : null,
      contractCreation: { eligibleMasterAgreementRequestCount },
      documents: requestRecord.documents.map((document) => ({
        ...document,
        fileUrl: `/api/documents/${document.id}/download`,
        verifiedByName: document.verifiedBy
          ? verifierNames.get(document.verifiedBy) ?? null
          : null,
      })),
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch request");
  }
}

// PATCH /api/requests/[id] - Update a request
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...REQUEST_WRITE_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateRequestSchema);
    if (!parsed.ok) return parsed.response;
    const { status, notes, action, assetId, deferredUntil } = parsed.data;

    // Check if request exists
    const existing = await prisma.request.findUnique({
      where: { id },
      include: {
        documents: { select: { requestId: true, type: true, verified: true } },
        reviews: {
          where: { action: "NEED_INFO" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { fromStatus: true },
        },
      },
    });

    if (!existing) {
      return apiError(404, "NOT_FOUND", "درخواست پیدا نشد.", { request });
    }


    if (
      isCustomerUser(auth.user) &&
      !canAccessParty(auth.user, existing.partyId)
    ) {
      return forbiddenResponse();
    }

    if (assetId) {
      const [asset, linkedRequest] = await Promise.all([
        prisma.asset.findUnique({
          where: { id: assetId },
          select: { ownerId: true },
        }),
        prisma.request.findFirst({
          where: { assetId, id: { not: id } },
          select: { caseNumber: true },
        }),
      ]);
      if (!asset) {
        return apiError(422, "VALIDATION_ERROR", "دارایی انتخاب‌شده وجود ندارد.", {
          request,
          details: { assetId: ["دارایی انتخاب‌شده وجود ندارد."] },
        });
      }
      if (asset.ownerId !== existing.partyId) {
        return apiError(422, "BUSINESS_RULE_VIOLATION", "دارایی متعلق به متقاضی این درخواست نیست.", {
          request,
          details: { assetId: ["دارایی متعلق به متقاضی این درخواست نیست."] },
        });
      }
      if (linkedRequest) {
        throw new BusinessRuleError(
          `این نیروگاه قبلاً به پرونده ${linkedRequest.caseNumber} متصل شده است.`,
          "CONFLICT",
          409,
          { assetId: ["برای هر پرونده باید نیروگاه مستقلی انتخاب شود."] }
        );
      }
    }

    if (!status && notes && !canAddRequestNote(auth.user.role)) return forbiddenResponse();

    const documentReadiness = getRequestDocumentReadiness(id, existing.documents, {
      operationalStatus: existing.operationalStatus,
      hasExistingContract: existing.hasExistingContract,
    });
    const transition = status
      ? evaluateRequestTransition({
          from: existing.status,
          to: status,
          actorRole: auth.user.role,
          hasAsset: Boolean(assetId ?? existing.assetId),
          documentsSubmitted: documentReadiness.submitted,
          documentsReady: documentReadiness.ready,
          resumingAfterSupplyDocumentRequest:
            existing.reviews[0]?.fromStatus === "INFORMATION_SUBMITTED",
          note: notes,
          deferredUntil,
        })
      : null;
    if (transition && !transition.allowed) {
      throw new BusinessRuleError(transition.reason, "CONFLICT", 409);
    }
    if (transition?.allowed && action && action !== transition.action) {
      throw new BusinessRuleError("عملیات ارسالی با تغییر وضعیت درخواست سازگار نیست.", "VALIDATION_ERROR", 422, {
        action: ["عملیات ارسالی با وضعیت مقصد سازگار نیست."],
      });
    }

    const auditMetadata = getAuditMetadata(request, parsed.correlationId);
    await prisma.$transaction(async (transaction) => {
      if ((status && status !== existing.status) || assetId) {
        const result = await transaction.request.updateMany({
          where: { id, status: existing.status },
          data: {
            ...(status && status !== existing.status && { status }),
            ...(assetId && { assetId }),
            ...(status === "DEFERRED" && { deferredUntil }),
            ...(status && status !== "DEFERRED" && { deferredUntil: null }),
          },
        });
        if (result.count !== 1) {
          throw new BusinessRuleError("وضعیت درخواست هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.", "CONFLICT", 409);
        }
      }

      if (notes || (status && status !== existing.status)) {
        await transaction.requestReview.create({
          data: {
            requestId: id,
            reviewerId: auth.user.id,
            action: transition?.allowed ? transition.action : "NOTE",
            fromStatus: existing.status,
            toStatus: status ?? existing.status,
            notes: notes ?? null,
          },
        });
      }

      if (status === "NEEDS_INFORMATION" && status !== existing.status && notes) {
        const recipients = await transaction.user.findMany({
          where: {
            active: true,
            OR: [
              { partyId: existing.partyId },
              ...(existing.initiatorId ? [{ id: existing.initiatorId }] : []),
            ],
          },
          select: { id: true },
        });

        if (recipients.length > 0) {
          await transaction.notification.createMany({
            data: [...new Set(recipients.map(({ id: userId }) => userId))].map((userId) => ({
              userId,
              partyId: existing.partyId,
              title: `اطلاعات تکمیلی برای درخواست ${existing.caseNumber}`,
              message: notes,
              type: "REQUEST",
              link: `/customer/requests/${id}`,
            })),
          });
        }
      }

      if ((status && status !== existing.status) || assetId || notes) {
        await transaction.auditLog.create({
          data: {
            entityType: "Request",
            entityId: id,
            action: status && status !== existing.status ? "STATUS_CHANGE" : assetId ? "LINK_ASSET" : "NOTE",
            userId: auth.user.id,
            changes: {
              before: { status: existing.status, assetId: existing.assetId },
              after: { status: status ?? existing.status, assetId: assetId ?? existing.assetId },
              ...(notes && { note: notes }),
            },
            ...auditMetadata,
          },
        });
      }
    });

    // Fetch updated request with relations
    const updated = await prisma.request.findUnique({
      where: { id },
      include: {
        party: true,
        asset: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            reviewer: {
              select: { name: true, role: true },
            },
          },
        },
      },
    });

    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "update request");
  }
}
