import { apiJson } from "@/lib/api-response";
import { FINANCIAL_ROLES } from "@/lib/access-control";
import { createFinancialConfigurationSchema, paginationSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { financialConfigurationPeriodsOverlap } from "@/domain/settlement/financial-configuration-period";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;
    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const rows = await prisma.financialConfiguration.findMany({ orderBy: { validFrom: "desc" }, skip: (query.data.page - 1) * query.data.limit, take: query.data.limit, include: { _count: { select: { settlements: true } } } });
    return apiJson(rows.map(({ _count, ...row }) => ({ ...row, usageCount: _count.settlements })));
  } catch (error) {
    return handleRouteError(request, error, "fetch financial configurations");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, createFinancialConfigurationSchema);
    if (!parsed.ok) return parsed.response;
    const existing = await prisma.financialConfiguration.findMany({ where: { active: true }, select: { validFrom: true, validTo: true } });
    const overlap = existing.some((period) => financialConfigurationPeriodsOverlap(period, { validFrom: parsed.data.validFrom, validTo: parsed.data.validTo ?? null }));
    if (overlap) throw new BusinessRuleError("بازه این تنظیم مالی با تنظیم فعال دیگری هم‌پوشانی دارد.", "CONFLICT", 409);
    const audit = getAuditMetadata(request, parsed.correlationId);
    const configuration = await prisma.$transaction(async (transaction) => {
      const created = await transaction.financialConfiguration.create({ data: { ...parsed.data, validTo: parsed.data.validTo ?? null, approvedBy: auth.user.id, createdBy: auth.user.id } });
      await transaction.auditLog.create({ data: { entityType: "FinancialConfiguration", entityId: created.id, action: "CREATE", userId: auth.user.id, changes: { taxRate: created.taxRate.toString(), deductionRate: created.deductionRate.toString(), validFrom: created.validFrom, validTo: created.validTo, approvedBy: created.approvedBy }, ...audit } });
      return created;
    });
    return apiJson(configuration, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create financial configuration");
  }
}
