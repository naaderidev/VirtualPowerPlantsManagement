import { apiJson } from "@/lib/api-response";
import { canTransitionPricingPlan } from "@/domain/pricing/workflow";
import { hasOutstandingPricingObligation } from "@/domain/pricing/deprecation";
import { PRICING_USE_ROLES } from "@/lib/access-control";
import { transitionPricingPlanSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

async function getOutstandingSchedules(planId: string, now: Date, database: Pick<typeof prisma, "commercialSchedule">) {
  const schedules = await database.commercialSchedule.findMany({
    where: { pricingPlanId: planId, active: true, endDate: { gt: now } },
    select: { contractId: true, contract: { select: { contractNumber: true, status: true } }, endDate: true, active: true },
  });
  return schedules.filter((schedule) => hasOutstandingPricingObligation({
    scheduleActive: schedule.active,
    scheduleEndDate: schedule.endDate,
    contractStatus: schedule.contract.status,
    now,
  }));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const plan = await prisma.pricingPlan.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!plan) throw new BusinessRuleError("نرخ‌نامه پیدا نشد.", "NOT_FOUND", 404);
    const schedules = await getOutstandingSchedules(id, new Date(), prisma);
    const contracts = [...new Map(schedules.map(({ contractId, contract }) => [contractId, { id: contractId, number: contract.contractNumber }])).values()];
    return apiJson({ canDeprecate: plan.status === "ACTIVE" && contracts.length === 0, blockingCount: contracts.length, blockingContracts: contracts.slice(0, 10) });
  } catch (error) {
    return handleRouteError(request, error, "preview pricing plan deprecation");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, transitionPricingPlanSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const audit = getAuditMetadata(request, parsed.correlationId);
    const updated = await prisma.$transaction(async (transaction) => {
      // Serialize status changes with contract configuration, which locks the same pricing row.
      await transaction.$queryRaw`SELECT id FROM pricing_plans WHERE id = ${id} FOR UPDATE`;
      const plan = await transaction.pricingPlan.findUnique({ where: { id } });
      if (!plan) throw new BusinessRuleError("نرخ‌نامه پیدا نشد.", "NOT_FOUND", 404);
      if (plan.status === parsed.data.status) return plan;
      if (!canTransitionPricingPlan(plan.status, parsed.data.status, auth.user.role)) throw new BusinessRuleError("تغییر وضعیت نرخ‌نامه برای این نقش یا مرحله مجاز نیست.");
      if (parsed.data.status === "DEPRECATED" && !parsed.data.notes?.trim()) {
        throw new BusinessRuleError("برای منسوخ‌کردن نرخ‌نامه، ثبت دلیل الزامی است.", "VALIDATION_ERROR", 422, { notes: ["دلیل منسوخ‌سازی را وارد کنید."] });
      }
      const now = new Date();
      if (parsed.data.status === "DEPRECATED") {
        const schedules = await getOutstandingSchedules(id, now, transaction);
        if (schedules.length > 0) {
          const numbers = [...new Set(schedules.map(({ contract }) => contract.contractNumber))].slice(0, 3).join("، ");
          throw new BusinessRuleError(`این نرخ‌نامه هنوز در برنامهٔ تجاری قراردادهای دارای دورهٔ باز یا آتی استفاده می‌شود (${numbers}). تا پایان تعهد یا اعمال اصلاحیهٔ جایگزین، منسوخ‌سازی مجاز نیست.`, "CONFLICT", 409);
        }
      }
      const changed = await transaction.pricingPlan.updateMany({ where: { id, status: plan.status }, data: { status: parsed.data.status, ...(parsed.data.status === "APPROVED" && { approvedBy: auth.user.id }), ...(parsed.data.status === "DEPRECATED" && { deprecatedAt: now }) } });
      if (changed.count !== 1) throw new BusinessRuleError("نرخ‌نامه هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      await transaction.auditLog.create({ data: { entityType: "PricingPlan", entityId: id, action: "STATUS_CHANGE", userId: auth.user.id, changes: { before: { status: plan.status }, after: { status: parsed.data.status, ...(parsed.data.status === "DEPRECATED" && { deprecatedAt: now }) }, notes: parsed.data.notes }, ...audit } });
      return transaction.pricingPlan.findUnique({ where: { id } });
    });
    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "transition pricing plan");
  }
}
