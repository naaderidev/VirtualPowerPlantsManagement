import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRICING_USE_ROLES, SUPPLY_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createPricingPlanSchema, paginationSchema } from "@/lib/api-schemas";
import { handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(PRICING_USE_ROLES);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const { page, limit } = query.data;

    const plans = await prisma.pricingPlan.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return apiJson(plans);
  } catch (error) {
    return handleRouteError(request, error, "fetch pricing plans");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createPricingPlanSchema);
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

    const audit = getAuditMetadata(request, parsed.correlationId);
    const plan = await prisma.$transaction(async (transaction) => {
      const created = await transaction.pricingPlan.create({ data: {
        name,
        code,
        model,
        status: "DRAFT",
        fixedRate: fixedRate ?? null,
        fixedRateHybrid: fixedRateHybrid ?? null,
        fixedSharePct: fixedSharePct ?? null,
        marketSharePct: marketSharePct ?? null,
        multiplier,
        differential,
        floorValue: floorValue ?? null,
        ceilingValue: ceilingValue ?? null,
        marketName: marketName ?? null,
        indexName: indexName ?? null,
        indexSource: indexSource ?? null,
        indexTimeframe: indexTimeframe ?? null,
        averagingMethod: averagingMethod ?? null,
        currency,
        validFrom,
        validTo: validTo ?? null,
        versionNote: notes ?? null,
        createdBy: auth.user.id,
      } });
      await transaction.auditLog.create({ data: { entityType: "PricingPlan", entityId: created.id, action: "CREATE", userId: auth.user.id, changes: { code: created.code, version: created.version, status: created.status, model: created.model }, ...audit } });
      return created;
    });

    return apiJson(plan, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create pricing plan");
  }
}
