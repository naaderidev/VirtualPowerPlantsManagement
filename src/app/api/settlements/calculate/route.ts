import { apiJson } from "@/lib/api-response";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { calculateSettlementAmounts } from "@/domain/settlement/calculation";
import { evaluateReadingCoverage } from "@/domain/settlement/calendar-month";
import { SETTLEMENT_CALCULATION_ROLES } from "@/lib/access-control";
import { calculateSettlementSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { PricingCalculationError } from "@/lib/pricing-engine";
import { requireApiUser } from "@/lib/server-auth";
import { formatApiDate, toPersianMonthKey } from "@/lib/persian-date";
import { canSettleContractPeriod } from "@/domain/contracts/termination";
import { isPricingPlanUsableForSettlement } from "@/domain/pricing/deprecation";

function settlementNumber(now: Date): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `STL-${now.getUTCFullYear()}${month}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(SETTLEMENT_CALCULATION_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, calculateSettlementSchema);
    if (!parsed.ok) return parsed.response;
    const { contractId, assetId, periodStart, periodEnd, pricingPlanId: requestedPricingPlanId } = parsed.data;
    if (periodEnd > new Date()) {
      throw new BusinessRuleError("ماه تسویه هنوز به پایان نرسیده است.", "VALIDATION_ERROR", 422, {
        periodEnd: ["ماه کامل و پایان‌یافته را انتخاب کنید."],
      });
    }

    const existing = await prisma.settlement.findFirst({
      where: { contractId, assetId, periodStart, periodEnd },
      orderBy: { version: "desc" },
      include: { pricingPlan: true, financialConfiguration: true, readings: true },
    });
    if (existing) {
      return apiJson({
        settlement: existing,
        calculation: {
          readingsCount: existing.readings.length,
          totalEnergyRegistered: existing.energyRegistered,
          totalEnergyAccepted: existing.energyAccepted,
          totalEnergyRejected: existing.energyRejected,
          unitPrice: existing.unitPrice,
          baseAmount: existing.baseAmount,
          grossAmount: existing.grossAmount,
          taxAmount: existing.taxAmount,
          netAmount: existing.netAmount,
          formula: existing.formula ?? "",
          breakdown: {},
          currency: existing.pricingPlan.currency,
          pricingPlanName: existing.pricingPlan.name,
          pricingPlanModel: existing.pricingPlan.model,
          taxRate: existing.financialConfiguration?.taxRate.toNumber() ?? 0,
          deductionRate: existing.financialConfiguration?.deductionRate.toNumber() ?? 0,
        },
        idempotentReplay: true,
      });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { assets: { select: { assetId: true } }, meteringAnnex: true },
    });
    if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
    if (!canSettleContractPeriod(contract.status, periodEnd, contract.terminationDate)) {
      throw new BusinessRuleError("تسویه فقط برای دوره‌های پیش از تاریخ فسخ یا قرارداد در حال اجرا قابل محاسبه است.", "CONFLICT", 409);
    }
    if (!contract.assets.some(({ assetId: linkedAssetId }) => linkedAssetId === assetId)) {
      throw new BusinessRuleError("دارایی در این قرارداد تعریف نشده است.", "VALIDATION_ERROR", 422);
    }

    const schedule = await prisma.commercialSchedule.findUnique({
      where: { contractId_assetId: { contractId, assetId } },
      include: { pricingPlan: true },
    });
    if (
      !schedule ||
      !schedule.active ||
      schedule.startDate > periodStart ||
      schedule.endDate < periodEnd
    ) {
      throw new BusinessRuleError("برنامه تجاری معتبر برای کل این دوره وجود ندارد.");
    }
    if (schedule.settlementCycle !== "MONTHLY") {
      throw new BusinessRuleError("در این نسخه فقط تسویه با چرخه ماهانه پشتیبانی می‌شود.");
    }
    if (requestedPricingPlanId && requestedPricingPlanId !== schedule.pricingPlanId) {
      throw new BusinessRuleError("نرخ‌نامه دستی با برنامه تجاری قرارداد سازگار نیست.", "VALIDATION_ERROR", 422);
    }
    if (!isPricingPlanUsableForSettlement({ status: schedule.pricingPlan.status, deprecatedAt: schedule.pricingPlan.deprecatedAt, periodEnd }) || schedule.pricingPlan.validFrom > periodStart || (schedule.pricingPlan.validTo && schedule.pricingPlan.validTo < periodEnd)) {
      throw new BusinessRuleError("نرخ‌نامه در دورهٔ تسویه معتبر نیست؛ برای دورهٔ پس از منسوخ‌سازی، اصلاحیه و نرخ‌نامهٔ جایگزین لازم است.");
    }

    const readings = await prisma.meterReading.findMany({
      where: {
        assetId,
        status: "ACCEPTED",
        periodStart: { lt: periodEnd },
        periodEnd: { gt: periodStart },
      },
      orderBy: { periodStart: "asc" },
    });
    const coverage = evaluateReadingCoverage(periodStart, periodEnd, readings);
    if (!coverage.complete) {
      const status = coverage.code === "EMPTY" ? 404 : 422;
      const code = coverage.code === "EMPTY" ? "NOT_FOUND" : "VALIDATION_ERROR";
      throw new BusinessRuleError(coverage.message, code, status, {
        periodEnd: ["تمام بازه ماه باید با قرائت‌های پذیرفته‌شده، بدون شکاف یا هم‌پوشانی پوشش داده شود."],
      });
    }
    if (readings.some(({ acceptedEnergy }) => acceptedEnergy == null)) {
      throw new BusinessRuleError("قرائت پذیرفته‌شده بدون مقدار انرژی پذیرفته‌شده وجود دارد.");
    }

    const period = toPersianMonthKey(periodStart);
    const needsIndex = ["MARKET_INDEX", "HYBRID", "FLOOR"].includes(schedule.pricingPlan.model);
    const marketIndex = needsIndex
      ? await prisma.marketIndexObservation.findUnique({ where: { pricingPlanId_period: { pricingPlanId: schedule.pricingPlanId, period } } })
      : null;
    if (needsIndex && !marketIndex) throw new BusinessRuleError("شاخص معتبر بازار برای نرخ‌نامه و دوره ثبت نشده است.");

    const financialConfiguration = await prisma.financialConfiguration.findFirst({
      where: { active: true, validFrom: { lte: periodStart }, OR: [{ validTo: null }, { validTo: { gte: periodEnd } }] },
      orderBy: { validFrom: "desc" },
    });
    if (!financialConfiguration) throw new BusinessRuleError("تنظیم مالی تأییدشده برای این دوره وجود ندارد.");

    const energyRegistered = readings.reduce((sum, reading) => sum + reading.rawEnergy, 0);
    const energyAccepted = readings.reduce((sum, reading) => sum + (reading.acceptedEnergy ?? 0), 0);
    const energyRejected = readings.reduce((sum, reading) => sum + (reading.rejectedEnergy ?? 0), 0);
    let calculation;
    try {
      calculation = calculateSettlementAmounts({
        energyRegistered,
        energyAccepted,
        energyRejected,
        period,
        pricingPlan: schedule.pricingPlan,
        marketIndex: marketIndex?.value.toNumber(),
        taxRate: financialConfiguration.taxRate.toNumber(),
        deductionRate: financialConfiguration.deductionRate.toNumber(),
      });
    } catch (error) {
      if (error instanceof PricingCalculationError || error instanceof Error) throw new BusinessRuleError(error.message);
      throw error;
    }

    const snapshot = {
      contract: { id: contract.id, version: contract.version },
      schedule: { id: schedule.id, startDate: formatApiDate(schedule.startDate, "startDate"), endDate: formatApiDate(schedule.endDate, "endDate") },
      pricingPlan: { ...schedule.pricingPlan, createdAt: formatApiDate(schedule.pricingPlan.createdAt), updatedAt: formatApiDate(schedule.pricingPlan.updatedAt), validFrom: formatApiDate(schedule.pricingPlan.validFrom, "validFrom"), validTo: schedule.pricingPlan.validTo ? formatApiDate(schedule.pricingPlan.validTo, "validTo") : null },
      marketIndex: marketIndex ? { id: marketIndex.id, value: marketIndex.value.toString(), indexName: marketIndex.indexName, source: marketIndex.source, timezone: marketIndex.timezone, observedAt: formatApiDate(marketIndex.observedAt) } : null,
      financialConfiguration: { id: financialConfiguration.id, taxRate: financialConfiguration.taxRate.toString(), deductionRate: financialConfiguration.deductionRate.toString(), approvedBy: financialConfiguration.approvedBy },
      readings: readings.map((reading) => ({ id: reading.id, periodStart: formatApiDate(reading.periodStart, "periodStart"), periodEnd: formatApiDate(reading.periodEnd, "periodEnd"), rawEnergy: reading.rawEnergy, acceptedEnergy: reading.acceptedEnergy, rejectedEnergy: reading.rejectedEnergy, validatedBy: reading.validatedBy })),
      rounding: calculation.pricing.rounding,
    } satisfies Prisma.InputJsonObject;
    const now = new Date();
    const audit = getAuditMetadata(request, parsed.correlationId);
    const settlement = await prisma.$transaction(async (transaction) => {
      const created = await transaction.settlement.create({
        data: {
          settlementNumber: settlementNumber(now), contractId, assetId, meterReadingId: readings[0].id,
          scheduleId: schedule.id, financialConfigurationId: financialConfiguration.id, periodStart, periodEnd,
          energyRegistered, energyAccepted, energyRejected, pricingPlanId: schedule.pricingPlanId,
          pricingVersion: String(schedule.pricingPlan.version), calculationSnapshot: snapshot, formula: calculation.pricing.formula,
          unitPrice: calculation.pricing.unitPrice, baseAmount: calculation.pricing.baseAmount,
          adjustmentTotal: calculation.adjustmentTotal, grossAmount: calculation.grossAmount,
          deductions: calculation.deductions, taxAmount: calculation.taxAmount, netAmount: calculation.netAmount,
          status: "CALCULATED", calculatedBy: auth.user.id,
          readings: { create: readings.map((reading) => ({ meterReadingId: reading.id, acceptedEnergySnapshot: reading.acceptedEnergy! })) },
        },
        include: { readings: { include: { meterReading: true } }, schedule: true, financialConfiguration: true },
      });
      await transaction.request.updateMany({
        where: { contractId, assetId, status: "ACTIVE" },
        data: { status: "SETTLEMENT_PENDING" },
      });
      await transaction.auditLog.create({ data: { entityType: "Settlement", entityId: created.id, action: "CALCULATE", userId: auth.user.id, changes: { contractId, assetId, periodStart, periodEnd, coverage: "COMPLETE_CALENDAR_MONTH", pricingPlanId: schedule.pricingPlanId, readingIds: readings.map(({ id }) => id), netAmount: calculation.netAmount }, ...audit } });
      return created;
    });
    return apiJson({
      settlement,
      calculation: {
        ...calculation,
        readingsCount: readings.length,
        totalEnergyRegistered: energyRegistered,
        totalEnergyAccepted: energyAccepted,
        totalEnergyRejected: energyRejected,
        unitPrice: calculation.pricing.unitPrice,
        baseAmount: calculation.pricing.baseAmount,
        formula: calculation.pricing.formula,
        breakdown: calculation.pricing.breakdown,
        currency: calculation.pricing.currency,
        pricingPlanName: schedule.pricingPlan.name,
        pricingPlanModel: schedule.pricingPlan.model,
        taxRate: financialConfiguration.taxRate.toNumber(),
        deductionRate: financialConfiguration.deductionRate.toNumber(),
      },
      idempotentReplay: false,
    }, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "calculate settlement");
  }
}
