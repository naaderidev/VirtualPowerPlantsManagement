import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { canTransitionPayment } from "@/domain/billing/payment-workflow";
import { updatePaymentStatusSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { PAYMENT_WRITE_ROLES } from "@/lib/access-control";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(PAYMENT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, updatePaymentStatusSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const existing = await prisma.payment.findUnique({ where: { id }, include: { allocations: { select: { id: true } } } });
    if (!existing) throw new BusinessRuleError("پرداخت پیدا نشد.", "NOT_FOUND", 404);
    if (!canTransitionPayment(existing.status, parsed.data.status)) throw new BusinessRuleError("تغییر وضعیت پرداخت مجاز نیست.", "CONFLICT", 409);
    if (parsed.data.status === "REJECTED" && existing.allocations.length > 0) throw new BusinessRuleError("پرداخت تخصیص‌یافته قابل رد نیست.", "CONFLICT", 409);
    const now = new Date();
    const audit = getAuditMetadata(request, parsed.correlationId);
    const payment = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.payment.updateMany({
        where: { id, status: existing.status, allocationVersion: existing.allocationVersion },
        data: {
          status: parsed.data.status,
          ...(parsed.data.status === "CONFIRMED" && { confirmedBy: auth.user.id, confirmedAt: now, rejectionReason: null }),
          ...(parsed.data.status === "REJECTED" && { rejectionReason: parsed.data.rejectionReason }),
        },
      });
      if (changed.count !== 1) throw new BusinessRuleError("پرداخت هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      await transaction.auditLog.create({ data: { entityType: "Payment", entityId: id, action: "STATUS_CHANGE", userId: auth.user.id, changes: { from: existing.status, to: parsed.data.status, rejectionReason: parsed.data.rejectionReason ?? null }, ...audit } });
      return transaction.payment.findUnique({ where: { id }, include: { allocations: true } });
    });
    return apiJson(payment);
  } catch (error) {
    return handleRouteError(request, error, "update payment");
  }
}
