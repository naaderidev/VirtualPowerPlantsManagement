import { apiJson } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateSettlementAmounts } from "@/domain/settlement/calculation";
import { FINANCIAL_ROLES } from "@/lib/access-control";
import { createSettlementRevisionSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { toPersianMonthKey } from "@/lib/persian-date";

const snapshotSchema = z.object({
  pricingPlan: z.object({
    id: z.string(), name: z.string(), version: z.number(), model: z.enum(["FIXED", "MARKET_INDEX", "HYBRID", "FLOOR"]),
    fixedRate: z.number().nullable(), fixedRateHybrid: z.number().nullable(), multiplier: z.number(), differential: z.number(),
    fixedSharePct: z.number().nullable(), marketSharePct: z.number().nullable(), floorValue: z.number().nullable(), ceilingValue: z.number().nullable(),
    currency: z.string(), energyUnit: z.string(), roundingMethod: z.string(), roundingDigits: z.number(),
  }).passthrough(),
  marketIndex: z.object({ value: z.string() }).nullable(),
  financialConfiguration: z.object({ id: z.string(), taxRate: z.string(), deductionRate: z.string(), approvedBy: z.string() }),
  readings: z.array(z.object({ id: z.string(), acceptedEnergy: z.number().nullable() }).passthrough()),
}).passthrough();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(FINANCIAL_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, createSettlementRevisionSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const original = await prisma.settlement.findUnique({ where: { id }, include: { readings: true, invoice: true } });
    if (!original) throw new BusinessRuleError("تسویه پیدا نشد.", "NOT_FOUND", 404);
    if (original.status !== "DISPUTED") throw new BusinessRuleError("نسخه اصلاحی فقط برای تسویه مورد اعتراض قابل ایجاد است.", "CONFLICT", 409);
    if (original.invoice && original.invoice.status !== "CANCELLED") throw new BusinessRuleError("صورتحساب نسخه قبلی باید پیش از اصلاح لغو شود.");
    const snapshotResult = snapshotSchema.safeParse(original.calculationSnapshot);
    if (!snapshotResult.success) throw new BusinessRuleError("snapshot محاسبه نسخه قبلی کامل و قابل بازتولید نیست.", "CONFLICT", 409);
    const snapshot = snapshotResult.data;
    const acceptedEnergy = parsed.data.acceptedEnergy ?? original.energyAccepted;
    const calculation = calculateSettlementAmounts({
      energyRegistered: original.energyRegistered,
      energyAccepted: acceptedEnergy,
      energyRejected: Math.max(0, original.energyRegistered - acceptedEnergy),
      period: toPersianMonthKey(original.periodStart),
      pricingPlan: snapshot.pricingPlan,
      marketIndex: snapshot.marketIndex ? Number(snapshot.marketIndex.value) : undefined,
      taxRate: Number(snapshot.financialConfiguration.taxRate),
      deductionRate: Number(snapshot.financialConfiguration.deductionRate),
      adjustments: parsed.data.adjustments,
    });
    const latest = await prisma.settlement.findFirst({ where: { contractId: original.contractId, assetId: original.assetId, periodStart: original.periodStart, periodEnd: original.periodEnd }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (latest?.version ?? original.version) + 1;
    const audit = getAuditMetadata(request, parsed.correlationId);
    const revisionSnapshot = JSON.parse(JSON.stringify({ ...snapshot, revision: { reason: parsed.data.reason, supersedesId: original.id, actorId: auth.user.id, adjustments: parsed.data.adjustments } })) as Prisma.InputJsonValue;
    const revision = await prisma.$transaction(async (transaction) => {
      const created = await transaction.settlement.create({
        data: {
          settlementNumber: `STL-R${version}-${randomUUID().slice(0, 8).toUpperCase()}`,
          version, supersedesId: original.id, contractId: original.contractId, assetId: original.assetId,
          meterReadingId: original.meterReadingId, scheduleId: original.scheduleId,
          financialConfigurationId: original.financialConfigurationId, periodStart: original.periodStart, periodEnd: original.periodEnd,
          energyRegistered: original.energyRegistered, energyAccepted: acceptedEnergy, energyRejected: Math.max(0, original.energyRegistered - acceptedEnergy),
          energyRejectionReason: parsed.data.reason, pricingPlanId: original.pricingPlanId, pricingVersion: original.pricingVersion,
          calculationSnapshot: revisionSnapshot, formula: calculation.pricing.formula, unitPrice: calculation.pricing.unitPrice,
          baseAmount: calculation.pricing.baseAmount, adjustments: parsed.data.adjustments as Prisma.InputJsonValue,
          adjustmentTotal: calculation.adjustmentTotal, grossAmount: calculation.grossAmount, deductions: calculation.deductions,
          taxAmount: calculation.taxAmount, netAmount: calculation.netAmount, status: "CALCULATED", calculatedBy: auth.user.id,
          readings: { create: original.readings.map((reading) => ({ meterReadingId: reading.meterReadingId, acceptedEnergySnapshot: reading.acceptedEnergySnapshot })) },
        },
        include: { readings: true, supersedes: true },
      });
      await transaction.auditLog.create({ data: { entityType: "Settlement", entityId: created.id, action: "CREATE_REVISION", userId: auth.user.id, changes: { supersedesId: original.id, version, reason: parsed.data.reason, beforeNetAmount: original.netAmount, afterNetAmount: calculation.netAmount }, ...audit } });
      return created;
    });
    return apiJson(revision, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create settlement revision");
  }
}
