import { apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  FINANCIAL_ROLES,
  isCustomerUser,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { updateSettlementSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { evaluateSettlementTransition } from "@/domain/settlement/workflow";
import { getAuditMetadata } from "@/lib/audit";
import { independentInvoiceRestriction } from "@/domain/billing/independent-invoice";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...FINANCIAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const settlement = await prisma.settlement.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            nettingGroup: { select: { active: true, mode: true } },
            parties: {
              include: {
                party: true,
              },
            },
          },
        },
        asset: true,
        readings: { include: { meterReading: true } },
        schedule: { include: { pricingPlan: true } },
        nettingItems: { where: { eligibilityLockKey: { not: null } }, select: { id: true }, take: 1 },
        financialConfiguration: true,
        supersedes: true,
        revisions: { orderBy: { version: "asc" } },
      },
    });

    if (!settlement) {
      return apiError(404, "NOT_FOUND", "تسویه پیدا نشد.", { request });
    }

    const partyIds = settlement.contract.parties.map(({ party }) => party.id);
    if (
      isCustomerUser(auth.user) &&
      !partyIds.some((partyId) => auth.user.accessiblePartyIds.includes(partyId))
    ) {
      return forbiddenResponse();
    }

    return apiJson({
      ...settlement,
      independentInvoiceRestriction: independentInvoiceRestriction({
        hasNettingReservation: settlement.nettingItems.length > 0,
        contractNettingEnabled: settlement.contract.nettingEnabled,
        scheduleNettingEnabled: settlement.schedule?.nettingEnabled ?? false,
        nettingGroup: settlement.contract.nettingGroup,
      }),
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch settlement");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...FINANCIAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateSettlementSchema);
    if (!parsed.ok) return parsed.response;
    const { status, disputeReason } = parsed.data;

    const existing = await prisma.settlement.findUnique({
      where: { id },
      include: { contract: { include: { parties: true, meteringAnnex: true } }, invoice: true },
    });

    if (!existing) {
      return apiError(404, "NOT_FOUND", "تسویه پیدا نشد.", { request });
    }

    if (isCustomerUser(auth.user)) {
      const ownsSettlement = Boolean(
        existing.contract.parties.some(({ partyId }) => auth.user.accessiblePartyIds.includes(partyId))
      );
      if (!ownsSettlement) return forbiddenResponse();
    }
    const decision = evaluateSettlementTransition({ from: existing.status, to: status, actorRole: auth.user.role, disputeReason, disputeDeadline: existing.disputeDeadline });
    if (!decision.allowed) throw new BusinessRuleError(decision.reason);
    const now = new Date();
    const disputeDeadline = status === "CONFIRMED"
      ? new Date(now.getTime() + (existing.contract.meteringAnnex?.disputeDeadline ?? 10) * 86_400_000)
      : existing.disputeDeadline;
    const audit = getAuditMetadata(request, parsed.correlationId);
    const settlement = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.settlement.updateMany({
        where: { id, status: existing.status },
        data: {
          status,
          ...(status === "CONFIRMED" && { confirmedBy: auth.user.id, confirmedAt: now, disputeDeadline }),
          ...(status === "DISPUTED" && { disputeReason: disputeReason!.trim() }),
        },
      });
      if (changed.count !== 1) throw new BusinessRuleError("وضعیت تسویه هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      if (status === "DISPUTED" && existing.invoice) {
        await transaction.invoice.update({ where: { id: existing.invoice.id }, data: { status: "CANCELLED", notes: `لغو خودکار به علت اعتراض تسویه: ${disputeReason}` } });
      }
      if (status === "UNDER_REVIEW") {
        await transaction.request.updateMany({
          where: { contractId: existing.contractId, assetId: existing.assetId, status: "ACTIVE" },
          data: { status: "SETTLEMENT_PENDING" },
        });
      }
      if (status === "CONFIRMED") {
        await transaction.request.updateMany({
          where: {
            contractId: existing.contractId,
            assetId: existing.assetId,
            status: { in: ["ACTIVE", "SETTLEMENT_PENDING"] },
          },
          data: { status: "SETTLED" },
        });
      }
      await transaction.auditLog.create({ data: { entityType: "Settlement", entityId: id, action: "STATUS_CHANGE", userId: auth.user.id, changes: { before: { status: existing.status }, after: { status, disputeReason: disputeReason ?? null, disputeDeadline } }, ...audit } });
      return transaction.settlement.findUnique({ where: { id }, include: { contract: { include: { parties: { include: { party: true } } } }, asset: true, readings: { include: { meterReading: true } }, invoice: true } });
    });

    return apiJson(settlement);
  } catch (error) {
    return handleRouteError(request, error, "update settlement");
  }
}
