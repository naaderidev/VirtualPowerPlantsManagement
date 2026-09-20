import { FINANCIAL_ROLES } from "@/lib/access-control";
import { updateFinancialConfigurationPeriodSchema } from "@/lib/api-schemas";
import { apiJson, BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { financialConfigurationPeriodsOverlap } from "@/domain/settlement/financial-configuration-period";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, updateFinancialConfigurationPeriodSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await context.params;
    const current = await prisma.financialConfiguration.findUnique({
      where: { id },
      include: { settlements: { select: { periodEnd: true }, orderBy: { periodEnd: "desc" }, take: 1 } },
    });
    if (!current) throw new BusinessRuleError("تنظیم مالی پیدا نشد.", "NOT_FOUND", 404);
    if (!current.active) throw new BusinessRuleError("تنظیم مالی غیرفعال قابل ویرایش نیست.");

    const latestUsedEnd = current.settlements[0]?.periodEnd;
    if (latestUsedEnd && parsed.data.validFrom.getTime() !== current.validFrom.getTime()) {
      throw new BusinessRuleError("شروع اعتبار تنظیم مالی استفاده‌شده قابل تغییر نیست.");
    }
    if (latestUsedEnd && parsed.data.validTo && parsed.data.validTo < latestUsedEnd) {
      throw new BusinessRuleError("پایان جدید نباید قبل از پایان آخرین دوره تسویه ثبت‌شده باشد.");
    }
    const others = await prisma.financialConfiguration.findMany({
      where: { active: true, id: { not: id } }, select: { validFrom: true, validTo: true },
    });
    if (others.some((period) => financialConfigurationPeriodsOverlap(period, { validFrom: parsed.data.validFrom, validTo: parsed.data.validTo ?? null }))) {
      throw new BusinessRuleError("بازه این تنظیم مالی با تنظیم فعال دیگری هم‌پوشانی دارد.", "CONFLICT", 409);
    }

    const audit = getAuditMetadata(request, parsed.correlationId);
    const updated = await prisma.$transaction(async (transaction) => {
      const row = await transaction.financialConfiguration.update({
        where: { id }, data: { validFrom: parsed.data.validFrom, validTo: parsed.data.validTo ?? null },
      });
      await transaction.auditLog.create({ data: {
        entityType: "FinancialConfiguration", entityId: id, action: "UPDATE_PERIOD", userId: auth.user.id,
        changes: { previousValidFrom: current.validFrom, previousValidTo: current.validTo, validFrom: row.validFrom, validTo: row.validTo },
        ...audit,
      } });
      return row;
    });
    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "update financial configuration period");
  }
}
