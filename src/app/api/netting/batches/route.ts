import { apiJson } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  calculateNettingTotals,
  validateNettingCandidates,
  type NettingCandidate,
  type NettingEligibilityViolation,
} from "@/domain/netting/calculation";
import { NETTING_CREATE_ROLES, NETTING_READ_ROLES } from "@/lib/access-control";
import { createNettingBatchSchema, nettingBatchListQuerySchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { isNettingEnabled } from "@/lib/netting-feature";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { formatApiDate } from "@/lib/persian-date";

const batchInclude = {
  group: { include: { party: { select: { id: true, displayName: true } } } },
  items: {
    include: {
      settlement: {
        include: {
          asset: { select: { id: true, name: true } },
          contract: { select: { id: true, contractNumber: true } },
        },
      },
    },
  },
  approvals: {
    include: { reviewer: { select: { id: true, name: true, role: true } } },
    orderBy: { decidedAt: "asc" as const },
  },
  statement: { include: { allocations: true } },
} as const;

const violationMessages: Record<NettingEligibilityViolation, string> = {
  AT_LEAST_TWO_SETTLEMENTS_REQUIRED: "حداقل دو تسویه برای خالص‌سازی لازم است.",
  DUPLICATE_SETTLEMENT: "هر تسویه فقط یک بار قابل انتخاب است.",
  SETTLEMENT_NOT_CONFIRMED: "فقط تسویه‌های تأییدشده قابل خالص‌سازی هستند.",
  SETTLEMENT_PERIOD_MISMATCH: "دوره تمام تسویه‌ها باید یکسان باشد.",
  SETTLEMENT_CURRENCY_MISMATCH: "ارز تمام تسویه‌ها باید یکسان باشد.",
  DISTINCT_ASSETS_REQUIRED: "تسویه‌ها باید متعلق به حداقل دو نیروگاه متفاوت باشند.",
  SETTLEMENT_ALREADY_NETTED: "حداقل یکی از تسویه‌ها قبلاً برای خالص‌سازی رزرو یا قطعی شده است.",
  SETTLEMENT_PARTY_MISMATCH: "تمام تسویه‌ها باید متعلق به قراردادهای همین گروه و شرکت باشند.",
  NETTING_NOT_ENABLED: "خالص‌سازی برای قرارداد یا برنامه تجاری یکی از تسویه‌ها فعال نیست.",
  INVALID_AMOUNT: "مبلغ تسویه باید عدد صحیح و نامنفی ریالی باشد.",
};

function batchNumber(now: Date): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `NET-${now.getUTCFullYear()}${month}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function resolveDirection(
  partyId: string,
  parties: readonly { partyId: string; role: string }[]
): "RECEIVABLE" | "PAYABLE" | null {
  const membership = parties.find((party) => party.partyId === partyId);
  if (membership?.role === "SELLER") return "RECEIVABLE";
  if (membership?.role === "BUYER") return "PAYABLE";
  return null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(NETTING_READ_ROLES);
    if (!auth.ok) return auth.response;
    const query = parseSearchParams(request, nettingBatchListQuerySchema);
    if (!query.ok) return query.response;
    const { groupId, page, limit } = query.data;
    const selectedGroup = groupId
      ? await prisma.nettingGroup.findUnique({ where: { id: groupId } })
      : null;
    if (groupId && !selectedGroup) {
      throw new BusinessRuleError("گروه خالص‌سازی پیدا نشد.", "NOT_FOUND", 404);
    }
    const [batches, eligibleSettlements] = await Promise.all([
      prisma.nettingBatch.findMany({
        where: groupId ? { groupId } : {},
        include: batchInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      groupId
        ? prisma.settlement.findMany({
            where: {
              status: "CONFIRMED",
              contract: { nettingGroupId: groupId, nettingEnabled: true },
              schedule: { nettingEnabled: true },
              pricingPlan: { currency: selectedGroup!.currency },
              periodStart: { gte: selectedGroup!.validFrom },
              ...(selectedGroup!.validTo && { periodEnd: { lte: selectedGroup!.validTo } }),
              nettingItems: { none: { eligibilityLockKey: { not: null } } },
            },
            include: {
              asset: { select: { id: true, name: true } },
              contract: { select: { id: true, contractNumber: true } },
              pricingPlan: { select: { currency: true } },
            },
            orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
    ]);
    return apiJson({ enabled: isNettingEnabled(), batches, eligibleSettlements });
  } catch (error) {
    return handleRouteError(request, error, "fetch netting batches");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(NETTING_CREATE_ROLES);
    if (!auth.ok) return auth.response;
    if (!isNettingEnabled()) {
      throw new BusinessRuleError("قابلیت خالص‌سازی در این محیط فعال نیست.", "CONFLICT", 409);
    }
    const parsed = await parseJsonBody(request, createNettingBatchSchema);
    if (!parsed.ok) return parsed.response;
    const { groupId, settlementIds, idempotencyKey } = parsed.data;
    const replay = await prisma.nettingBatch.findUnique({
      where: { idempotencyKey },
      include: batchInclude,
    });
    if (replay) {
      const replayIds = replay.items.map(({ settlementId }) => settlementId).sort();
      const requestedIds = [...settlementIds].sort();
      if (replay.groupId !== groupId || replayIds.join(":") !== requestedIds.join(":")) {
        throw new BusinessRuleError(
          "این کلید idempotency قبلاً برای درخواست دیگری استفاده شده است.",
          "CONFLICT",
          409
        );
      }
      return apiJson({ batch: replay, idempotentReplay: true });
    }

    const [group, settlements] = await Promise.all([
      prisma.nettingGroup.findUnique({ where: { id: groupId } }),
      prisma.settlement.findMany({
        where: { id: { in: settlementIds } },
        include: {
          asset: { select: { id: true, name: true } },
          contract: { include: { parties: true } },
          schedule: true,
          pricingPlan: { select: { currency: true } },
          nettingItems: { where: { eligibilityLockKey: { not: null } }, select: { id: true } },
        },
      }),
    ]);
    if (!group) throw new BusinessRuleError("گروه خالص‌سازی پیدا نشد.", "NOT_FOUND", 404);
    if (!group.active || group.mode === "OFF" || group.type !== "FINANCIAL") {
      throw new BusinessRuleError("گروه خالص‌سازی مالی فعال نیست.");
    }
    if (settlements.length !== settlementIds.length) {
      throw new BusinessRuleError("حداقل یکی از تسویه‌های انتخاب‌شده پیدا نشد.", "NOT_FOUND", 404);
    }
    const candidates: NettingCandidate[] = settlements.map((settlement) => ({
      settlementId: settlement.id,
      assetId: settlement.assetId,
      status: settlement.status,
      periodStart: settlement.periodStart,
      periodEnd: settlement.periodEnd,
      currency: settlement.pricingPlan.currency,
      direction: resolveDirection(group.partyId, settlement.contract.parties),
      amount: String(settlement.netAmount),
      locked: settlement.nettingItems.length > 0,
      belongsToGroup: settlement.contract.nettingGroupId === group.id,
      nettingEnabled: settlement.contract.nettingEnabled && Boolean(settlement.schedule?.nettingEnabled),
    }));
    const violations = validateNettingCandidates(candidates);
    if (violations.length > 0) {
      throw new BusinessRuleError(violationMessages[violations[0]], "BUSINESS_RULE_VIOLATION", 422, {
        settlementIds: violations.map((violation) => violationMessages[violation]),
      });
    }
    const [first] = candidates;
    if (group.currency !== first.currency) {
      throw new BusinessRuleError("ارز تسویه‌ها با ارز گروه خالص‌سازی یکسان نیست.");
    }
    if (
      group.validFrom > first.periodStart ||
      (group.validTo && group.validTo < first.periodEnd)
    ) {
      throw new BusinessRuleError("دوره تسویه‌ها خارج از بازه اعتبار گروه خالص‌سازی است.");
    }
    const totals = calculateNettingTotals(candidates);
    const now = new Date();
    const snapshot = {
      group: { id: group.id, partyId: group.partyId, currency: group.currency, mode: group.mode },
      period: { start: formatApiDate(first.periodStart, "periodStart"), end: formatApiDate(first.periodEnd, "periodEnd") },
      totals,
      settlements: settlements.map((settlement) => ({
        id: settlement.id,
        number: settlement.settlementNumber,
        contractId: settlement.contractId,
        contractNumber: settlement.contract.contractNumber,
        assetId: settlement.assetId,
        assetName: settlement.asset.name,
        status: settlement.status,
        amount: String(settlement.netAmount),
        currency: settlement.pricingPlan.currency,
        direction: resolveDirection(group.partyId, settlement.contract.parties),
        calculationSnapshot: settlement.calculationSnapshot,
      })),
    } satisfies Prisma.InputJsonObject;
    const audit = getAuditMetadata(request, parsed.correlationId);
    const batch = await prisma.$transaction(async (transaction) => {
      const created = await transaction.nettingBatch.create({
        data: {
          batchNumber: batchNumber(now),
          groupId,
          periodStart: first.periodStart,
          periodEnd: first.periodEnd,
          currency: first.currency,
          totalReceivable: totals.totalReceivable,
          totalPayable: totals.totalPayable,
          netAmount: totals.netAmount,
          calculationSnapshot: snapshot,
          idempotencyKey,
          createdById: auth.user.id,
          items: {
            create: settlements.map((settlement) => {
              const direction = resolveDirection(group.partyId, settlement.contract.parties)!;
              return {
                settlementId: settlement.id,
                direction,
                amount: String(settlement.netAmount),
                currency: settlement.pricingPlan.currency,
                eligibilityLockKey: `NETTING:${settlement.id}`,
                settlementSnapshot: snapshot.settlements.find(({ id }) => id === settlement.id)!,
              };
            }),
          },
        },
      });
      await transaction.auditLog.create({
        data: {
          entityType: "NettingBatch",
          entityId: created.id,
          action: "CALCULATE",
          userId: auth.user.id,
          changes: { groupId, settlementIds, ...totals },
          ...audit,
        },
      });
      return transaction.nettingBatch.findUniqueOrThrow({ where: { id: created.id }, include: batchInclude });
    });
    return apiJson({ batch, idempotentReplay: false }, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create netting batch");
  }
}
