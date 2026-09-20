import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, PROPOSAL_MANAGE_ROLES, isCustomerUser } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createProposalSchema, decideProposalSchema, proposalListQuerySchema } from "@/lib/api-schemas";
import {
  BusinessRuleError,
  handleRouteError,
  parseJsonBody,
  parseSearchParams,
  requireExistingRecord,
} from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";

// GET /api/proposals - Get all proposals
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser([...PROPOSAL_MANAGE_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, proposalListQuerySchema);
    if (!query.ok) return query.response;
    const { status, requestId, page, limit } = query.data;

    const where: Prisma.ProposalWhereInput = {};
    if (status) where.status = status;
    if (requestId) where.requestId = requestId;
    if (isCustomerUser(auth.user)) {
      if (auth.user.accessiblePartyIds.length === 0) {
        return apiJson({ proposals: [], pagination: { page, limit, total: 0, pages: 0 } });
      }
      where.request = { partyId: { in: auth.user.accessiblePartyIds } };
    }

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        include: {
          request: {
            select: {
              id: true,
              caseNumber: true,
              capacity: true,
              province: true,
              city: true,
              party: {
                select: {
                  id: true,
                  displayName: true,
                  type: true,
                },
              },
              asset: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  capacityNominal: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposal.count({ where }),
    ]);

    return apiJson({
      proposals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch proposals");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(PROPOSAL_MANAGE_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createProposalSchema);
    if (!parsed.ok) return parsed.response;
    const { requestId, pricePerKwh, minVolume, maxVolume, duration, validDays, notes } = parsed.data;

    const requestRecord = await requireExistingRecord(
      prisma.request.findUnique({
        where: { id: requestId },
        select: { id: true, status: true, partyId: true, initiatorId: true, caseNumber: true },
      }),
      "درخواست موردنظر پیدا نشد."
    );
    if (requestRecord.status !== "PROPOSAL_PENDING") {
      throw new BusinessRuleError("پیشنهاد فقط برای درخواست آماده تهیه پیشنهاد قابل ایجاد است.", "CONFLICT", 409);
    }

    const existing = await prisma.proposal.findFirst({
      where: { requestId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return apiJson(existing);

    const validUntil = new Date();
    validUntil.setUTCDate(validUntil.getUTCDate() + validDays);
    const auditMetadata = getAuditMetadata(request, parsed.correlationId);

    const proposal = await prisma.$transaction(async (transaction) => {
      const created = await transaction.proposal.create({
        data: {
          requestId,
          pricePerKwh,
          minVolume: minVolume ?? null,
          maxVolume: maxVolume ?? null,
          duration,
          notes: notes ?? null,
          validUntil,
          createdById: auth.user.id,
        },
      });
      const requestUpdate = await transaction.request.updateMany({
        where: { id: requestId, status: "PROPOSAL_PENDING" },
        data: { status: "PROPOSAL_READY" },
      });
      if (requestUpdate.count !== 1) {
        throw new BusinessRuleError("وضعیت درخواست هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      }
      await transaction.requestReview.create({
        data: {
          requestId,
          reviewerId: auth.user.id,
          action: "APPROVE",
          fromStatus: "PROPOSAL_PENDING",
          toStatus: "PROPOSAL_READY",
          notes: "پیشنهاد تجاری صادر شد.",
        },
      });
      const recipients = await transaction.user.findMany({
        where: {
          active: true,
          OR: [
            { partyId: requestRecord.partyId },
            ...(requestRecord.initiatorId ? [{ id: requestRecord.initiatorId }] : []),
          ],
        },
        select: { id: true },
      });
      if (recipients.length > 0) {
        await transaction.notification.createMany({
          data: [...new Set(recipients.map(({ id: userId }) => userId))].map((userId) => ({
            userId,
            partyId: requestRecord.partyId,
            title: `پیشنهاد قیمت جدید برای درخواست ${requestRecord.caseNumber}`,
            message: `پیشنهاد جدید با نرخ ${pricePerKwh.toLocaleString("fa-IR")} ریال به‌ازای هر کیلووات‌ساعت آماده بررسی است.`,
            type: "REQUEST" as const,
            link: `/customer/requests/${requestId}/proposal`,
          })),
        });
      }
      await transaction.auditLog.create({
        data: {
          entityType: "Proposal",
          entityId: created.id,
          action: "CREATE",
          userId: auth.user.id,
          changes: { requestId, after: { status: created.status, validUntil: created.validUntil } },
          ...auditMetadata,
        },
      });
      return created;
    });

    return apiJson(proposal, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create proposal");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiUser(CUSTOMER_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, decideProposalSchema);
    if (!parsed.ok) return parsed.response;
    const { id, status, customerNote } = parsed.data;

    const proposal = await requireExistingRecord(
      prisma.proposal.findUnique({
        where: { id },
        include: {
          request: {
            select: { id: true, partyId: true, initiatorId: true, caseNumber: true },
          },
        },
      }),
      "پیشنهاد پیدا نشد."
    );

    if (!auth.user.accessiblePartyIds.includes(proposal.request.partyId)) {
      throw new BusinessRuleError("این پیشنهاد متعلق به حساب شما نیست.", "FORBIDDEN", 403);
    }
    if (proposal.status === status) return apiJson(proposal);
    if (proposal.status !== "PENDING") {
      throw new BusinessRuleError("این پیشنهاد قبلاً تعیین تکلیف شده است.", "CONFLICT", 409);
    }
    if (proposal.validUntil <= new Date()) {
      throw new BusinessRuleError("مهلت این پیشنهاد پایان یافته است.");
    }
    const auditMetadata = getAuditMetadata(request, parsed.correlationId);

    const updated = await prisma.$transaction(async (transaction) => {
      if (status === "ACCEPTED") {
        const acceptedProposal = await transaction.proposal.findFirst({
          where: { requestId: proposal.request.id, status: "ACCEPTED", id: { not: id } },
          select: { id: true },
        });
        if (acceptedProposal) {
          throw new BusinessRuleError("برای این درخواست قبلاً پیشنهاد دیگری پذیرفته شده است.", "CONFLICT", 409);
        }
      }

      const proposalUpdate = await transaction.proposal.updateMany({
        where: { id, status: "PENDING" },
        data: { status, customerNote: customerNote ?? null },
      });
      if (proposalUpdate.count !== 1) {
        throw new BusinessRuleError("پیشنهاد هم‌زمان تعیین تکلیف شده است.", "CONFLICT", 409);
      }
      const nextRequestStatus = status === "ACCEPTED" ? "PROPOSAL_ACCEPTED" : "PROPOSAL_REJECTED";
      const requestUpdate = await transaction.request.updateMany({
        where: { id: proposal.request.id, status: "PROPOSAL_READY" },
        data: { status: status === "ACCEPTED" ? "PROPOSAL_ACCEPTED" : "PROPOSAL_REJECTED" },
      });
      if (requestUpdate.count !== 1) {
        throw new BusinessRuleError("وضعیت درخواست با پیشنهاد سازگار نیست.", "CONFLICT", 409);
      }
      await transaction.requestReview.create({
        data: {
          requestId: proposal.request.id,
          reviewerId: auth.user.id,
          action: status === "ACCEPTED" ? "APPROVE" : "REJECT",
          fromStatus: "PROPOSAL_READY",
          toStatus: nextRequestStatus,
          notes: customerNote ?? null,
        },
      });
      if (status === "REJECTED") {
        const recipients = await transaction.user.findMany({
          where: { active: true, role: { in: [...PROPOSAL_MANAGE_ROLES] } },
          select: { id: true },
        });
        if (recipients.length > 0) {
          await transaction.notification.createMany({
            data: recipients.map(({ id: userId }) => ({
              userId,
              title: `پیشنهاد درخواست ${proposal.request.caseNumber} رد شد`,
              message: customerNote!,
              type: "REQUEST" as const,
              link: `/admin/requests/${proposal.request.id}`,
            })),
          });
        }
      }
      await transaction.auditLog.create({
        data: {
          entityType: "Proposal",
          entityId: id,
          action: status === "ACCEPTED" ? "ACCEPT" : "REJECT",
          userId: auth.user.id,
          changes: {
            before: { status: proposal.status },
            after: { status, ...(customerNote && { customerNote }) },
            requestId: proposal.request.id,
          },
          ...auditMetadata,
        },
      });
      return transaction.proposal.findUnique({ where: { id } });
    });

    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "decide proposal");
  }
}
