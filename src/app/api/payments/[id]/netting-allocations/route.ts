import { apiJson } from "@/lib/api-response";
import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import {
  NettingStatementAllocationError,
  calculateNettingStatementAllocation,
} from "@/domain/netting/statement";
import { PAYMENT_WRITE_ROLES } from "@/lib/access-control";
import { allocateNettingPaymentSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(PAYMENT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, allocateNettingPaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { id: paymentId } = await params;
    const { nettingStatementId, amount, idempotencyKey } = parsed.data;
    const replay = await prisma.nettingPaymentAllocation.findUnique({ where: { idempotencyKey } });
    if (replay) {
      if (replay.paymentId !== paymentId || replay.statementId !== nettingStatementId || replay.amount.toString() !== String(amount)) {
        throw new BusinessRuleError("کلید idempotency قبلاً برای تخصیص دیگری استفاده شده است.", "CONFLICT", 409);
      }
      return apiJson({ allocation: replay, idempotentReplay: true });
    }
    const [payment, statement] = await Promise.all([
      prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          allocations: { select: { amount: true } },
          nettingAllocations: { select: { amount: true } },
        },
      }),
      prisma.nettingStatement.findUnique({
        where: { id: nettingStatementId },
        include: {
          allocations: { select: { amount: true } },
          batch: { include: { items: { select: { settlementId: true, settlement: { select: { contractId: true, assetId: true } } } } } },
        },
      }),
    ]);
    if (!payment) throw new BusinessRuleError("پرداخت پیدا نشد.", "NOT_FOUND", 404);
    if (!statement) throw new BusinessRuleError("سند خالص‌سازی پیدا نشد.", "NOT_FOUND", 404);
    if (payment.status !== "CONFIRMED") {
      throw new BusinessRuleError("فقط پرداخت تأییدشده قابل تخصیص است.", "CONFLICT", 409);
    }
    if (!['ISSUED', 'PARTIALLY_PAID'].includes(statement.status)) {
      throw new BusinessRuleError("وضعیت سند خالص‌سازی برای تخصیص پرداخت مجاز نیست.", "CONFLICT", 409);
    }
    const paymentAllocated = [...payment.allocations, ...payment.nettingAllocations]
      .reduce((sum, item) => sum.add(item.amount.toString()), new Decimal(0));
    const statementPaid = statement.allocations
      .reduce((sum, item) => sum.add(item.amount.toString()), new Decimal(0));
    let result;
    try {
      result = calculateNettingStatementAllocation({
        paymentAmount: payment.amountDecimal.toString(),
        paymentAllocated: paymentAllocated.toString(),
        statementAmount: statement.amount.toString(),
        statementPaid: statementPaid.toString(),
        allocationAmount: amount,
        paymentCurrency: payment.currency,
        statementCurrency: statement.currency,
      });
    } catch (error) {
      if (error instanceof NettingStatementAllocationError) {
        throw new BusinessRuleError(error.message, "VALIDATION_ERROR", 422);
      }
      throw error;
    }
    const now = new Date();
    const audit = getAuditMetadata(request, parsed.correlationId);
    const allocation = await prisma.$transaction(async (transaction) => {
      const paymentChanged = await transaction.payment.updateMany({
        where: { id: paymentId, allocationVersion: payment.allocationVersion },
        data: {
          allocationVersion: { increment: 1 },
          allocated: result.paymentFullyAllocated,
          allocatedAt: result.paymentFullyAllocated ? now : null,
        },
      });
      const statementChanged = await transaction.nettingStatement.updateMany({
        where: { id: statement.id, allocationVersion: statement.allocationVersion },
        data: {
          allocationVersion: { increment: 1 },
          paidAmount: result.statementPaid.toFixed(0),
          status: result.statementStatus,
        },
      });
      if (paymentChanged.count !== 1 || statementChanged.count !== 1) {
        throw new BusinessRuleError("مانده پرداخت یا سند هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.", "CONFLICT", 409);
      }
      const created = await transaction.nettingPaymentAllocation.create({
        data: { paymentId, statementId: statement.id, amount, idempotencyKey, createdBy: auth.user.id },
      });
      if (result.statementStatus === "PAID") {
        const settlementIds = statement.batch.items.map(({ settlementId }) => settlementId);
        await transaction.settlement.updateMany({
          where: { id: { in: settlementIds }, status: "CONFIRMED" },
          data: { status: "PAID" },
        });
        await transaction.request.updateMany({
          where: {
            OR: statement.batch.items.map(({ settlement }) => ({
              contractId: settlement.contractId,
              assetId: settlement.assetId,
              status: { in: ["ACTIVE", "SETTLEMENT_PENDING", "SETTLED"] as const },
            })),
          },
          data: { status: "COMPLETED" },
        });
      }
      await transaction.auditLog.create({
        data: {
          entityType: "NettingPaymentAllocation",
          entityId: created.id,
          action: "ALLOCATE",
          userId: auth.user.id,
          changes: {
            paymentId,
            statementId: statement.id,
            amount: String(amount),
            paymentAllocated: result.paymentAllocated.toFixed(0),
            statementPaid: result.statementPaid.toFixed(0),
            statementStatus: result.statementStatus,
          },
          ...audit,
        },
      });
      return created;
    });
    return apiJson({ allocation, statementStatus: result.statementStatus, idempotentReplay: false }, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "allocate payment to netting statement");
  }
}
