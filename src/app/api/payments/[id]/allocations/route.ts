import { apiJson } from "@/lib/api-response";
import Decimal from "decimal.js";
import { NextResponse } from "next/server";
import { calculatePaymentAllocation, PaymentAllocationError } from "@/domain/billing/allocation";
import { allocatePaymentSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { PAYMENT_WRITE_ROLES } from "@/lib/access-control";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(PAYMENT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, allocatePaymentSchema);
    if (!parsed.ok) return parsed.response;
    const { id: paymentId } = await params;
    const replay = await prisma.paymentAllocation.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
    if (replay) {
      if (replay.paymentId !== paymentId || replay.invoiceId !== parsed.data.invoiceId || replay.amount.toString() !== String(parsed.data.amount)) {
        throw new BusinessRuleError("کلید idempotency قبلاً برای تخصیص دیگری استفاده شده است.", "CONFLICT", 409);
      }
      return apiJson({ allocation: replay, idempotentReplay: true });
    }

    const [payment, invoice] = await Promise.all([
      prisma.payment.findUnique({ where: { id: paymentId }, include: { allocations: { select: { amount: true } }, nettingAllocations: { select: { amount: true } } } }),
      prisma.invoice.findUnique({ where: { id: parsed.data.invoiceId }, include: { allocations: { select: { amount: true } }, settlement: { select: { id: true, status: true, contractId: true } } } }),
    ]);
    if (!payment) throw new BusinessRuleError("پرداخت پیدا نشد.", "NOT_FOUND", 404);
    if (!invoice) throw new BusinessRuleError("صورتحساب پیدا نشد.", "NOT_FOUND", 404);
    if (payment.status !== "CONFIRMED") throw new BusinessRuleError("فقط پرداخت تأییدشده قابل تخصیص است.", "CONFLICT", 409);
    if (!["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) throw new BusinessRuleError("وضعیت صورتحساب برای تخصیص پرداخت مجاز نیست.", "CONFLICT", 409);

    const paymentAllocated = [...payment.allocations, ...payment.nettingAllocations].reduce((sum, item) => sum.add(item.amount.toString()), new Decimal(0));
    const invoicePaid = invoice.allocations.reduce((sum, item) => sum.add(item.amount.toString()), new Decimal(0));
    let result;
    try {
      result = calculatePaymentAllocation({
        paymentAmount: payment.amountDecimal.toString(), paymentAllocated: paymentAllocated.toString(),
        invoiceAmount: (invoice.amountDecimal?.toString() ?? String(Math.round(invoice.amount))), invoicePaid: invoicePaid.toString(),
        allocationAmount: parsed.data.amount, paymentCurrency: payment.currency, invoiceCurrency: invoice.currency,
      });
    } catch (error) {
      if (error instanceof PaymentAllocationError) throw new BusinessRuleError(error.message, "VALIDATION_ERROR", 422);
      throw error;
    }

    const audit = getAuditMetadata(request, parsed.correlationId);
    const allocation = await prisma.$transaction(async (transaction) => {
      const paymentChanged = await transaction.payment.updateMany({ where: { id: paymentId, allocationVersion: payment.allocationVersion }, data: { allocationVersion: { increment: 1 }, allocated: result.paymentFullyAllocated, allocatedAt: result.paymentFullyAllocated ? new Date() : null, ...(payment.invoiceId === null && { invoiceId: invoice.id }) } });
      const invoiceChanged = await transaction.invoice.updateMany({ where: { id: invoice.id, allocationVersion: invoice.allocationVersion }, data: { allocationVersion: { increment: 1 }, paidAmount: result.invoicePaid.toString(), status: result.invoiceStatus } });
      if (paymentChanged.count !== 1 || invoiceChanged.count !== 1) throw new BusinessRuleError("مانده پرداخت یا صورتحساب هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.", "CONFLICT", 409);
      const created = await transaction.paymentAllocation.create({ data: { paymentId, invoiceId: invoice.id, amount: parsed.data.amount, idempotencyKey: parsed.data.idempotencyKey, createdBy: auth.user.id } });
      if (result.invoiceStatus === "PAID") {
        await transaction.settlement.updateMany({ where: { id: invoice.settlement.id, status: "INVOICED" }, data: { status: "PAID" } });
        await transaction.request.updateMany({
          where: { contractId: invoice.settlement.contractId, status: { in: ["ACTIVE", "SETTLEMENT_PENDING", "SETTLED"] } },
          data: { status: "COMPLETED" },
        });
      }
      await transaction.auditLog.create({ data: { entityType: "PaymentAllocation", entityId: created.id, action: "ALLOCATE", userId: auth.user.id, changes: { paymentId, invoiceId: invoice.id, amount: String(parsed.data.amount), paymentAllocated: result.paymentAllocated.toString(), invoicePaid: result.invoicePaid.toString(), invoiceStatus: result.invoiceStatus }, ...audit } });
      return created;
    });
    return apiJson({ allocation, invoiceStatus: result.invoiceStatus, idempotentReplay: false }, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "allocate payment");
  }
}
