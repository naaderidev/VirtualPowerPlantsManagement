import { apiJson } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { deriveNettingStatement } from "@/domain/netting/statement";
import { PAYMENT_WRITE_ROLES } from "@/lib/access-control";
import { createNettingStatementSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { isNettingEnabled } from "@/lib/netting-feature";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { formatApiDate } from "@/lib/persian-date";

function statementNumber(now: Date): string {
  return `NST-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(PAYMENT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    if (!isNettingEnabled()) {
      throw new BusinessRuleError("قابلیت خالص‌سازی در این محیط فعال نیست.", "CONFLICT", 409);
    }
    const parsed = await parseJsonBody(request, createNettingStatementSchema);
    if (!parsed.ok) return parsed.response;
    const { id: batchId } = await params;
    const replay = await prisma.nettingStatement.findUnique({
      where: { idempotencyKey: parsed.data.idempotencyKey },
      include: { batch: true, party: true, allocations: true },
    });
    if (replay) {
      if (replay.batchId !== batchId) {
        throw new BusinessRuleError("کلید idempotency قبلاً برای سند دیگری استفاده شده است.", "CONFLICT", 409);
      }
      return apiJson({ statement: replay, idempotentReplay: true });
    }
    const batch = await prisma.nettingBatch.findUnique({
      where: { id: batchId },
      include: {
        group: true,
        approvals: true,
        statement: true,
        items: {
          include: {
            settlement: {
              include: {
                asset: { select: { id: true, name: true } },
                contract: { select: { id: true, contractNumber: true } },
                schedule: { select: { paymentDueDays: true } },
              },
            },
          },
        },
      },
    });
    if (!batch) throw new BusinessRuleError("دسته خالص‌سازی پیدا نشد.", "NOT_FOUND", 404);
    if (batch.statement) return apiJson({ statement: batch.statement, idempotentReplay: true });
    if (batch.status !== "APPROVED") {
      throw new BusinessRuleError("فقط دسته دارای تأیید نهایی قابل ثبت مالی است.", "CONFLICT", 409);
    }
    const financialApproval = batch.approvals.find(({ type, decision }) => type === "FINANCIAL" && decision === "APPROVED");
    const legalApproval = batch.approvals.find(({ type, decision }) => type === "LEGAL" && decision === "APPROVED");
    if (!financialApproval || !legalApproval || financialApproval.reviewerId === legalApproval.reviewerId) {
      throw new BusinessRuleError("تأیید مستقل مالی و حقوقی برای ثبت سند کامل نیست.");
    }
    const terms = deriveNettingStatement(batch.netAmount.toString());
    const now = new Date();
    const paymentDueDays = Math.max(
      1,
      ...batch.items.map(({ settlement }) => settlement.schedule?.paymentDueDays ?? 30)
    );
    const dueDate = new Date(now);
    dueDate.setUTCDate(dueDate.getUTCDate() + paymentDueDays);
    const snapshot = {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      companyPartyId: batch.group.partyId,
      periodStart: formatApiDate(batch.periodStart, "periodStart"),
      periodEnd: formatApiDate(batch.periodEnd, "periodEnd"),
      direction: terms.direction,
      amount: terms.amount.toFixed(0),
      currency: batch.currency,
      approvals: batch.approvals.map(({ type, decision, reviewerId, decidedAt }) => ({ type, decision, reviewerId, decidedAt: formatApiDate(decidedAt) })),
      batchCalculation: batch.calculationSnapshot,
      items: batch.items.map(({ settlement, direction, amount, settlementSnapshot }) => ({
        settlementId: settlement.id,
        settlementNumber: settlement.settlementNumber,
        contractId: settlement.contract.id,
        contractNumber: settlement.contract.contractNumber,
        assetId: settlement.asset.id,
        assetName: settlement.asset.name,
        direction,
        amount: amount.toString(),
        settlementSnapshot,
      })),
      paymentDueDays,
    } satisfies Prisma.InputJsonObject;
    const relationships = await prisma.relationship.findMany({
      where: {
        toEntityId: batch.group.partyId,
        type: "REPRESENTATIVE",
        active: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
      select: { fromEntity: { select: { users: { where: { active: true }, select: { id: true } } } } },
    });
    const directUsers = await prisma.user.findMany({
      where: { partyId: batch.group.partyId, active: true },
      select: { id: true },
    });
    const notificationUserIds = [
      ...new Set([
        ...directUsers.map(({ id }) => id),
        ...relationships.flatMap(({ fromEntity }) => fromEntity.users.map(({ id }) => id)),
      ]),
    ];
    const audit = getAuditMetadata(request, parsed.correlationId);
    const statement = await prisma.$transaction(async (transaction) => {
      const created = await transaction.nettingStatement.create({
        data: {
          statementNumber: statementNumber(now),
          batchId,
          partyId: batch.group.partyId,
          direction: terms.direction,
          amount: terms.amount.toFixed(0),
          paidAmount: terms.initialStatus === "PAID" ? terms.amount.toFixed(0) : "0",
          currency: batch.currency,
          status: terms.initialStatus,
          issueDate: now,
          dueDate,
          snapshot,
          idempotencyKey: parsed.data.idempotencyKey,
          createdById: auth.user.id,
        },
      });
      const changed = await transaction.nettingBatch.updateMany({
        where: { id: batchId, status: "APPROVED" },
        data: { status: "POSTED", postedAt: now },
      });
      if (changed.count !== 1) {
        throw new BusinessRuleError("وضعیت دسته خالص‌سازی هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      }
      if (terms.initialStatus === "PAID") {
        const settlementIds = batch.items.map(({ settlementId }) => settlementId);
        await transaction.settlement.updateMany({ where: { id: { in: settlementIds }, status: "CONFIRMED" }, data: { status: "PAID" } });
        await transaction.request.updateMany({
          where: {
            OR: batch.items.map(({ settlement }) => ({
              contractId: settlement.contract.id,
              assetId: settlement.asset.id,
              status: { in: ["ACTIVE", "SETTLEMENT_PENDING", "SETTLED"] },
            })),
          },
          data: { status: "COMPLETED" },
        });
      }
      if (notificationUserIds.length > 0) {
        await transaction.notification.createMany({
          data: notificationUserIds.map((userId) => ({
            userId,
            partyId: batch.group.partyId,
            title: "سند خالص‌سازی صادر شد",
            message: `سند ${created.statementNumber} برای نتیجه خالص ${batch.batchNumber} صادر شد.`,
            type: "SETTLEMENT" as const,
            link: "/customer/netting",
          })),
        });
      }
      await transaction.auditLog.create({
        data: {
          entityType: "NettingStatement",
          entityId: created.id,
          action: "ISSUE",
          userId: auth.user.id,
          changes: { batchId, statementNumber: created.statementNumber, direction: created.direction, amount: created.amount.toString(), currency: created.currency },
          ...audit,
        },
      });
      return transaction.nettingStatement.findUniqueOrThrow({
        where: { id: created.id },
        include: { batch: true, party: true, allocations: true },
      });
    });
    return apiJson({ statement, idempotentReplay: false }, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "issue netting statement");
  }
}
