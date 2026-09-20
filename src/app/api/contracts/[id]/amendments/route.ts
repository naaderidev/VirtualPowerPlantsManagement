import { apiJson } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { CONTRACT_WRITE_ROLES } from "@/lib/access-control";
import { createAmendmentSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(CONTRACT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, createAmendmentSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const contract = await prisma.contract.findUnique({ where: { id }, select: { status: true } });
    if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
    if (contract.status !== "ACTIVE") throw new BusinessRuleError("اصلاحیه فقط برای قرارداد فعال قابل ایجاد است.", "CONFLICT", 409);
    const last = await prisma.amendment.findFirst({ where: { contractId: id }, orderBy: { number: "desc" } });
    const audit = getAuditMetadata(request, parsed.correlationId);
    const amendment = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.contract.updateMany({ where: { id, status: "ACTIVE" }, data: { status: "AMENDMENT_PENDING" } });
      if (changed.count !== 1) throw new BusinessRuleError("وضعیت قرارداد هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      const created = await transaction.amendment.create({
        data: {
          contractId: id,
          number: (last?.number ?? 0) + 1,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          changes: parsed.data.changes as Prisma.InputJsonValue,
          effectiveDate: parsed.data.effectiveDate,
        },
      });
      await transaction.contractReview.create({ data: { contractId: id, reviewerId: auth.user.id, action: "AMENDMENT_CREATED", fromStatus: "ACTIVE", toStatus: "AMENDMENT_PENDING" } });
      await transaction.auditLog.create({ data: { entityType: "Amendment", entityId: created.id, action: "CREATE", userId: auth.user.id, changes: { contractId: id, number: created.number }, ...audit } });
      return created;
    });
    return apiJson(amendment, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create contract amendment");
  }
}
