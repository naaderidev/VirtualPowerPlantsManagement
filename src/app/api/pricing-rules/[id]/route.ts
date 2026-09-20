import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRICING_USE_ROLES, SUPPLY_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { updatePricingPlanSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const plan = await prisma.pricingPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      return apiError(404, "NOT_FOUND", "طرح قیمت‌گذاری پیدا نشد.", { request });
    }

    return apiJson(plan);
  } catch (error) {
    return handleRouteError(request, error, "fetch pricing plan");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updatePricingPlanSchema);
    if (!parsed.ok) return parsed.response;
    const {
      name,
      code,
      model,
      fixedRate,
      fixedRateHybrid,
      fixedSharePct,
      marketSharePct,
      multiplier,
      differential,
      floorValue,
      ceilingValue,
      marketName,
      indexName,
      indexSource,
      indexTimeframe,
      averagingMethod,
      currency,
      validFrom,
      validTo,
      notes,
    } = parsed.data;

    const existing = await prisma.pricingPlan.findUnique({
      where: { id },
      select: { status: true, validFrom: true, validTo: true, fixedSharePct: true, marketSharePct: true },
    });
    if (!existing) throw new BusinessRuleError("طرح قیمت‌گذاری پیدا نشد.", "NOT_FOUND", 404);
    if (existing.status !== "DRAFT") throw new BusinessRuleError("نرخ‌نامه پس از ارسال برای بررسی قابل ویرایش نیست؛ نسخه جدید ایجاد کنید.", "CONFLICT", 409);

    const finalValidFrom = validFrom ?? existing.validFrom;
    const finalValidTo = validTo === undefined ? existing.validTo : validTo;
    if (finalValidTo && finalValidTo <= finalValidFrom) {
      throw new BusinessRuleError("پایان اعتبار باید بعد از شروع باشد.", "VALIDATION_ERROR", 422, {
        validTo: ["پایان اعتبار باید بعد از شروع باشد."],
      });
    }

    const finalFixedShare = fixedSharePct === undefined ? existing.fixedSharePct : fixedSharePct;
    const finalMarketShare = marketSharePct === undefined ? existing.marketSharePct : marketSharePct;
    if (finalFixedShare != null || finalMarketShare != null) {
      const totalShare = (finalFixedShare ?? 0) + (finalMarketShare ?? 0);
      if (Math.abs(totalShare - 100) > 0.0001) {
        throw new BusinessRuleError("مجموع سهم ثابت و بازار باید ۱۰۰ درصد باشد.", "VALIDATION_ERROR", 422, {
          marketSharePct: ["مجموع سهم ثابت و بازار باید دقیقاً ۱۰۰ درصد باشد."],
        });
      }
    }

    const audit = getAuditMetadata(request, parsed.correlationId);
    const plan = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.pricingPlan.update({ where: { id }, data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(model && { model }),
        ...(fixedRate !== undefined && { fixedRate }),
        ...(fixedRateHybrid !== undefined && { fixedRateHybrid }),
        ...(fixedSharePct !== undefined && { fixedSharePct }),
        ...(marketSharePct !== undefined && { marketSharePct }),
        ...(multiplier !== undefined && { multiplier }),
        ...(differential !== undefined && { differential }),
        ...(floorValue !== undefined && { floorValue }),
        ...(ceilingValue !== undefined && { ceilingValue }),
        ...(marketName !== undefined && { marketName }),
        ...(indexName !== undefined && { indexName }),
        ...(indexSource !== undefined && { indexSource }),
        ...(indexTimeframe !== undefined && { indexTimeframe }),
        ...(averagingMethod !== undefined && { averagingMethod }),
        ...(currency && { currency }),
        ...(validFrom && { validFrom }),
        ...(validTo !== undefined && { validTo }),
        ...(notes !== undefined && { versionNote: notes }),
      } });
      await transaction.auditLog.create({ data: { entityType: "PricingPlan", entityId: id, action: "UPDATE_DRAFT", userId: auth.user.id, changes: { fields: Object.keys(parsed.data) }, ...audit } });
      return updated;
    });

    return apiJson(plan);
  } catch (error) {
    return handleRouteError(request, error, "update pricing plan");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const plan = await prisma.pricingPlan.findUnique({ where: { id }, include: { _count: { select: { schedules: true, marketIndexObservations: true } } } });
    if (!plan) throw new BusinessRuleError("نرخ‌نامه پیدا نشد.", "NOT_FOUND", 404);
    if (plan.status !== "DRAFT" || plan._count.schedules > 0 || plan._count.marketIndexObservations > 0) throw new BusinessRuleError("فقط پیش‌نویس استفاده‌نشده قابل حذف است.", "CONFLICT", 409);
    await prisma.pricingPlan.delete({ where: { id } });

    return apiJson({ message: "طرح قیمت‌گذاری حذف شد" });
  } catch (error) {
    return handleRouteError(request, error, "delete pricing plan");
  }
}
