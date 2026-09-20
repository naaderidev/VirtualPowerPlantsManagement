import { apiJson } from "@/lib/api-response";
import { PRICING_USE_ROLES } from "@/lib/access-control";
import { createMarketIndexSchema, paginationSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { toPersianMonthKey } from "@/lib/persian-date";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;
    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const rows = await prisma.marketIndexObservation.findMany({
      include: { pricingPlan: { select: { id: true, name: true, version: true } } },
      orderBy: { observedAt: "desc" },
      skip: (query.data.page - 1) * query.data.limit,
      take: query.data.limit,
    });
    return apiJson(rows);
  } catch (error) {
    return handleRouteError(request, error, "fetch market indices");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, createMarketIndexSchema);
    if (!parsed.ok) return parsed.response;
    if (parsed.data.period > toPersianMonthKey(new Date()) || parsed.data.observedAt > new Date()) {
      throw new BusinessRuleError("دوره یا زمان مشاهدهٔ شاخص نمی‌تواند در آینده باشد.", "VALIDATION_ERROR", 422, {
        period: ["دورهٔ جاری یا گذشته را انتخاب کنید."],
        observedAt: ["زمان مشاهدهٔ واقعی را انتخاب کنید."],
      });
    }
    const plan = await prisma.pricingPlan.findUnique({ where: { id: parsed.data.pricingPlanId } });
    if (!plan) throw new BusinessRuleError("نرخ‌نامه پیدا نشد.", "NOT_FOUND", 404);
    if (!["APPROVED", "ACTIVE"].includes(plan.status)) throw new BusinessRuleError("شاخص فقط برای نرخ‌نامه تأییدشده قابل ثبت است.");
    if (plan.indexName !== parsed.data.indexName || plan.indexSource !== parsed.data.source) {
      throw new BusinessRuleError("نام یا منبع شاخص با نرخ‌نامه سازگار نیست.", "VALIDATION_ERROR", 422);
    }
    const audit = getAuditMetadata(request, parsed.correlationId);
    const observation = await prisma.$transaction(async (transaction) => {
      const created = await transaction.marketIndexObservation.create({ data: { ...parsed.data, createdBy: auth.user.id } });
      await transaction.auditLog.create({ data: { entityType: "MarketIndexObservation", entityId: created.id, action: "CREATE", userId: auth.user.id, changes: { pricingPlanId: plan.id, period: created.period, value: created.value.toString(), source: created.source }, ...audit } });
      return created;
    });
    return apiJson(observation, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create market index");
  }
}
