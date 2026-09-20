import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { SUPPLY_ROLES } from "@/lib/access-control";
import { BusinessRuleError, handleRouteError, getCorrelationId } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const source = await prisma.pricingPlan.findUnique({ where: { id } });
    if (!source) throw new BusinessRuleError("نرخ‌نامه پیدا نشد.", "NOT_FOUND", 404);
    if (!["APPROVED", "ACTIVE", "DEPRECATED"].includes(source.status)) throw new BusinessRuleError("نسخه جدید فقط از نرخ‌نامه تثبیت‌شده قابل ایجاد است.");
    const nextVersion = source.version + 1;
    const correlationId = getCorrelationId(request);
    const audit = getAuditMetadata(request, correlationId);
    const version = await prisma.$transaction(async (transaction) => {
      const created = await transaction.pricingPlan.create({
        data: {
          name: source.name, code: `${source.code}-V${nextVersion}`, version: nextVersion, status: "DRAFT", model: source.model,
          currency: source.currency, energyUnit: source.energyUnit, roundingMethod: source.roundingMethod, roundingDigits: source.roundingDigits,
          fixedRate: source.fixedRate, escalationMethod: source.escalationMethod, marketName: source.marketName, indexName: source.indexName,
          indexSource: source.indexSource, indexTimeframe: source.indexTimeframe, averagingMethod: source.averagingMethod,
          multiplier: source.multiplier, differential: source.differential, missingIndexPolicy: source.missingIndexPolicy,
          fixedSharePct: source.fixedSharePct, fixedRateHybrid: source.fixedRateHybrid, marketSharePct: source.marketSharePct,
          baseFormula: source.baseFormula, basePricingId: source.id, floorValue: source.floorValue, ceilingValue: source.ceilingValue,
          validFrom: source.validFrom, validTo: source.validTo, createdBy: auth.user.id, versionNote: `نسخه ${nextVersion} از ${source.code}`,
        },
      });
      await transaction.auditLog.create({ data: { entityType: "PricingPlan", entityId: created.id, action: "CREATE_VERSION", userId: auth.user.id, changes: { basePricingId: source.id, version: nextVersion }, ...audit } });
      return created;
    });
    return apiJson(version, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create pricing plan version");
  }
}
