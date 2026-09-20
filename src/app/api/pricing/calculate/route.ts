import { apiJson } from "@/lib/api-response";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePrice, PricingCalculationError, PricingPlanData } from "@/lib/pricing-engine";
import { PRICING_USE_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { calculatePriceSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { calendarMonthPeriod } from "@/domain/settlement/calendar-month";
import { isPricingPlanUsableForSettlement } from "@/domain/pricing/deprecation";
import { parseApiDate } from "@/lib/persian-date";

// POST /api/pricing/calculate - Calculate price
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, calculatePriceSchema);
    if (!parsed.ok) return parsed.response;
    const { energy, period, pricingPlanId } = parsed.data;

    // Get pricing plan from database
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: pricingPlanId },
    });

    if (!plan) {
      throw new BusinessRuleError("طرح قیمت‌گذاری پیدا نشد.", "NOT_FOUND", 404);
    }

    const month = calendarMonthPeriod(period);
    const periodStart = month ? parseApiDate(month.periodStart) : null;
    const periodEnd = month ? parseApiDate(month.periodEnd) : null;
    if (!periodStart || !periodEnd || !isPricingPlanUsableForSettlement({
      status: plan.status,
      deprecatedAt: plan.deprecatedAt,
      periodEnd,
    }) || plan.validFrom > periodStart || (plan.validTo && plan.validTo < periodEnd)) {
      throw new BusinessRuleError("نرخ‌نامه در دورهٔ انتخاب‌شده معتبر نیست.", "VALIDATION_ERROR", 422);
    }

    const needsIndex = ["MARKET_INDEX", "HYBRID", "FLOOR"].includes(plan.model);
    const observation = needsIndex
      ? await prisma.marketIndexObservation.findUnique({ where: { pricingPlanId_period: { pricingPlanId, period } } })
      : null;
    if (needsIndex && !observation) throw new BusinessRuleError("شاخص معتبر بازار برای این نرخ‌نامه و دوره ثبت نشده است.");
    let result;
    try {
      result = calculatePrice({ energy, period, pricingPlan: plan as PricingPlanData, marketIndex: observation?.value.toNumber() });
    } catch (error) {
      if (error instanceof PricingCalculationError) throw new BusinessRuleError(error.message, "VALIDATION_ERROR", 422);
      throw error;
    }

    return apiJson({ ...result, pricingPlanVersion: plan.version, marketIndexObservationId: observation?.id ?? null });
  } catch (error) {
    return handleRouteError(request, error, "calculate price");
  }
}
