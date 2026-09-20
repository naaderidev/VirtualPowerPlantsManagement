import { apiJson } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { PAYMENT_READ_ROLES, PAYMENT_WRITE_ROLES, isCustomerUser } from "@/lib/access-control";
import { createPaymentSchema, paymentListQuerySchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(PAYMENT_READ_ROLES);
    if (!auth.ok) return auth.response;
    const query = parseSearchParams(request, paymentListQuerySchema);
    if (!query.ok) return query.response;
    if (isCustomerUser(auth.user) && auth.user.accessiblePartyIds.length === 0) return apiJson([]);

    const partyScope = isCustomerUser(auth.user)
      ? {
          OR: [
            { allocations: { some: { invoice: { settlement: { contract: { parties: { some: { partyId: { in: auth.user.accessiblePartyIds } } } } } } } } },
            { invoice: { settlement: { contract: { parties: { some: { partyId: { in: auth.user.accessiblePartyIds } } } } } } },
            { nettingAllocations: { some: { statement: { partyId: { in: auth.user.accessiblePartyIds } } } } },
          ],
        }
      : {};
    const payments = await prisma.payment.findMany({
      where: { ...partyScope, ...(query.data.status && { status: query.data.status }) },
      include: {
        allocations: { include: { invoice: { select: { id: true, invoiceNumber: true } } } },
        nettingAllocations: { include: { statement: { select: { id: true, statementNumber: true } } } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.data.page - 1) * query.data.limit,
      take: query.data.limit,
    });
    return apiJson(payments);
  } catch (error) {
    return handleRouteError(request, error, "fetch payments");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(PAYMENT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, createPaymentSchema);
    if (!parsed.ok) return parsed.response;
    if (parsed.data.paymentDate > new Date()) {
      throw new BusinessRuleError("تاریخ پرداخت انجام‌شده نمی‌تواند در آینده باشد.", "VALIDATION_ERROR", 422, {
        paymentDate: ["تاریخ پرداخت واقعی را انتخاب کنید."],
      });
    }
    const existing = await prisma.payment.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
    if (existing) {
      if (existing.amountDecimal.toString() !== String(parsed.data.amount) || existing.reference !== parsed.data.reference) {
        throw new BusinessRuleError("کلید idempotency قبلاً برای پرداخت دیگری استفاده شده است.", "CONFLICT", 409);
      }
      return apiJson({ payment: existing, idempotentReplay: true });
    }

    const now = new Date();
    const paymentNumber = `PAY-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const audit = getAuditMetadata(request, parsed.correlationId);
    const payment = await prisma.$transaction(async (transaction) => {
      const created = await transaction.payment.create({
        data: {
          paymentNumber,
          invoiceId: null,
          amount: parsed.data.amount,
          amountDecimal: parsed.data.amount,
          currency: "IRR",
          paymentDate: parsed.data.paymentDate,
          method: parsed.data.method,
          bankName: parsed.data.bankName ?? null,
          reference: parsed.data.reference,
          notes: parsed.data.notes ?? null,
          idempotencyKey: parsed.data.idempotencyKey,
          status: "PENDING",
          createdBy: auth.user.id,
        },
      });
      await transaction.auditLog.create({ data: { entityType: "Payment", entityId: created.id, action: "RECORD", userId: auth.user.id, changes: { paymentNumber, amount: String(parsed.data.amount), currency: "IRR", reference: parsed.data.reference }, ...audit } });
      return created;
    });
    return apiJson({ payment, idempotentReplay: false }, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "record payment");
  }
}
