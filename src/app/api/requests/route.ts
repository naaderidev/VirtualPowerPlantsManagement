import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, INTERNAL_ROLES, isCustomerUser } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createRequestSchema, requestListQuerySchema } from "@/lib/api-schemas";
import { apiError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { canCreateCustomerRequest } from "@/lib/ui-access";
import { resolveRequestStatusFromSettlements } from "@/domain/requests/financial-progress";

// GET /api/requests - Get all requests
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, requestListQuerySchema);
    if (!query.ok) return query.response;
    const { status, page, limit } = query.data;

    const where: Prisma.RequestWhereInput = {};
    
    // If user is customer, only show their requests
    if (isCustomerUser(auth.user)) {
      where.partyId = { in: auth.user.accessiblePartyIds };
    }

    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        include: {
          party: {
            select: {
              id: true,
              displayName: true,
              type: true,
              phone: true,
            },
          },
          asset: {
            select: {
              id: true,
              name: true,
              type: true,
              capacityNominal: true,
              operationalDate: true,
            },
          },
          proposals: {
            where: { status: "ACCEPTED" },
            select: { duration: true },
            take: 1,
          },
          contract: { select: { settlements: { select: { status: true } } } },
          _count: {
            select: {
              documents: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.request.count({ where }),
    ]);

    const requestsWithFinancialProgress = requests.map(({ contract, ...requestRecord }) => ({
      ...requestRecord,
      status: resolveRequestStatusFromSettlements(
        requestRecord.status,
        contract?.settlements.map((settlement) => settlement.status) ?? [],
      ),
    }));

    return apiJson({
      requests: requestsWithFinancialProgress,
      permissions: {
        canCreate: isCustomerUser(auth.user)
          ? canCreateCustomerRequest(auth.user.role, auth.user.accessiblePartyIds.length)
          : false,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch requests");
  }
}

// POST /api/requests - Create a new request
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(CUSTOMER_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createRequestSchema);
    if (!parsed.ok) return parsed.response;
    const {
      plantType,
      capacity,
      province,
      city,
      operationalStatus,
      avgMonthlyGeneration,
      hasExistingContract,
      existingContractStart,
      existingContractEnd,
      existingContractCounterparty,
      existingContractCommittedCapacity,
      existingContractExclusive,
      existingContractRestrictions,
      existingContractRightToSellConfirmed,
      contactMobile,
      notes,
    } = parsed.data;

    // Get user's party
    const partyId = auth.user.role === "CUSTOMER_REPRESENTATIVE"
      ? auth.user.accessiblePartyIds.length === 1 ? auth.user.accessiblePartyIds[0] : null
      : auth.user.partyId;
    if (!partyId) {
      return apiError(422, "BUSINESS_RULE_VIOLATION", "برای کاربر طرف قرارداد تعیین نشده است.", { request });
    }

    // Generate case number
    const lastRequest = await prisma.request.findFirst({
      orderBy: { createdAt: "desc" },
      select: { caseNumber: true },
    });

    let caseNumber = "VPP-100";
    if (lastRequest) {
      const lastNum = parseInt(lastRequest.caseNumber.replace("VPP-", ""));
      caseNumber = `VPP-${lastNum + 1}`;
    }

    const auditMetadata = getAuditMetadata(request, parsed.correlationId);
    const newRequest = await prisma.$transaction(async (transaction) => {
      const created = await transaction.request.create({
        data: {
          caseNumber,
          partyId,
          initiatorId: auth.user.id,
          status: "SUBMITTED",
          plantType,
          capacity,
          province,
          city,
          operationalStatus,
          avgMonthlyGeneration: avgMonthlyGeneration ?? null,
          hasExistingContract,
          existingContractStart: existingContractStart ?? null,
          existingContractEnd: existingContractEnd ?? null,
          existingContractCounterparty: existingContractCounterparty ?? null,
          existingContractCommittedCapacity: existingContractCommittedCapacity ?? null,
          existingContractExclusive,
          existingContractRestrictions: existingContractRestrictions ?? null,
          existingContractRightToSellConfirmed,
          contactMobile: contactMobile ?? auth.user.mobile,
          notes: notes ?? null,
        },
        include: { party: true },
      });

      await transaction.auditLog.create({
        data: {
          entityType: "Request",
          entityId: created.id,
          action: "CREATE",
          userId: auth.user.id,
          changes: { after: { status: created.status, partyId: created.partyId, caseNumber: created.caseNumber } },
          ...auditMetadata,
        },
      });

      return created;
    });

    return apiJson(newRequest, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create request");
  }
}
