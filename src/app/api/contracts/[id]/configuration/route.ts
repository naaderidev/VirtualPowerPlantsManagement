import { apiJson } from "@/lib/api-response";
import { Prisma } from "@prisma/client";
import { SUPPLY_ROLES } from "@/lib/access-control";
import { configureContractSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { canEditContractConfiguration } from "@/domain/contracts/workflow";
import {
  validateScenario142MasterAgreement,
  type Scenario142PricingModel,
} from "@/domain/contracts/scenario-14-2";
import { getExistingContractConflicts } from "@/domain/contracts/existing-sales-contract";
import { getContractPeriodIssue } from "@/domain/contracts/contract-period";
import { formatApiDate } from "@/lib/persian-date";

function toScenarioPricingModel(model: string): Scenario142PricingModel {
  return model === "FIXED" || model === "MARKET_INDEX" ? model : "OTHER";
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, configureContractSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const data = parsed.data;
    const periodIssue = getContractPeriodIssue({
      effectiveDate: formatApiDate(data.effectiveDate, "effectiveDate"),
      expirationDate: data.expirationDate ? formatApiDate(data.expirationDate, "expirationDate") : "",
    });
    if (periodIssue) {
      throw new BusinessRuleError(periodIssue.message, "VALIDATION_ERROR", 422, {
        [periodIssue.field]: [periodIssue.message],
      });
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        parties: true,
        requests: {
          select: {
            id: true,
            assetId: true,
            createdAt: true,
            hasExistingContract: true,
            existingContractStart: true,
            existingContractEnd: true,
            existingContractCommittedCapacity: true,
            existingContractExclusive: true,
            existingContractRightToSellConfirmed: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
    if (!canEditContractConfiguration(contract.status)) {
      throw new BusinessRuleError("قرارداد امضاشده یا فعال قابل ویرایش مستقیم نیست؛ اصلاحیه ایجاد کنید.", "CONFLICT", 409);
    }

    const seller = contract.parties.find(({ role, isPrimary }) => role === "SELLER" && isPrimary);
    const buyer = contract.parties.find(({ role, isPrimary }) => role === "BUYER" && isPrimary);
    if (!seller || !buyer || seller.partyId === buyer.partyId) {
      throw new BusinessRuleError("خریدار و فروشنده اصلی باید مشخص و متمایز باشند.");
    }

    const assetIds = data.assets.map(({ assetId }) => assetId);
    const pricingPlanIds = [...new Set(data.schedules.map(({ pricingPlanId }) => pricingPlanId))];
    const [assets, pricingPlans] = await Promise.all([
      prisma.asset.findMany({
        where: { id: { in: assetIds }, ownerId: seller.partyId },
        select: { id: true, ownerId: true, name: true, capacityNominal: true, capacitySellable: true },
      }),
      prisma.pricingPlan.findMany({
        where: { id: { in: pricingPlanIds }, status: { in: ["APPROVED", "ACTIVE"] } },
        select: { id: true, model: true, validFrom: true, validTo: true },
      }),
    ]);
    if (assets.length !== assetIds.length) {
      throw new BusinessRuleError("حداقل یک دارایی متعلق به فروشنده نیست یا وجود ندارد.", "VALIDATION_ERROR", 422, {
        assets: ["دارایی باید موجود و متعلق به فروشنده اصلی باشد."],
      });
    }
    if (pricingPlans.length !== pricingPlanIds.length) {
      throw new BusinessRuleError("طرح قیمت‌گذاری معتبر یا تأییدشده نیست.", "VALIDATION_ERROR", 422, {
        schedules: ["همه طرح‌های قیمت‌گذاری باید موجود و تأییدشده یا فعال باشند."],
      });
    }
    for (const schedule of data.schedules) {
      const plan = pricingPlans.find(({ id: planId }) => planId === schedule.pricingPlanId)!;
      if (schedule.startDate < plan.validFrom || (plan.validTo && schedule.endDate > plan.validTo)) {
        const validFrom = formatApiDate(plan.validFrom, "validFrom");
        const validTo = plan.validTo ? formatApiDate(plan.validTo, "validTo") : "بدون تاریخ پایان";
        throw new BusinessRuleError(`بازه مجاز نرخ‌نامه از ${validFrom} تا ${validTo} است.`, "VALIDATION_ERROR", 422, {
          schedules: [`تاریخ برنامه را بین ${validFrom} و ${validTo} قرار دهید.`],
        });
      }
    }

    const existingContractConflicts = assets.flatMap((asset) => {
      const requestRecord = contract.requests.find(({ assetId }) => assetId === asset.id);
      if (!requestRecord) return [];
      return getExistingContractConflicts({
        hasExistingContract: requestRecord.hasExistingContract,
        existingContractStart: requestRecord.existingContractStart,
        existingContractEnd: requestRecord.existingContractEnd,
        existingContractCommittedCapacity: requestRecord.existingContractCommittedCapacity,
        existingContractExclusive: requestRecord.existingContractExclusive,
        existingContractRightToSellConfirmed: requestRecord.existingContractRightToSellConfirmed,
        assetId: asset.id,
        assetName: asset.name,
        capacityNominal: asset.capacityNominal,
        capacitySellable: asset.capacitySellable,
        schedules: data.schedules.filter(({ assetId }) => assetId === asset.id),
      });
    });
    if (existingContractConflicts.length > 0) {
      throw new BusinessRuleError(
        "برنامه تجاری با قرارداد فروش موجود تعارض دارد.",
        "VALIDATION_ERROR",
        422,
        { schedules: existingContractConflicts },
      );
    }

    const isScenario142MasterAgreement = contract.requests.length === 2;
    if (isScenario142MasterAgreement) {
      const expectedAssetIds = contract.requests.map(({ assetId }) => assetId);
      if (
        expectedAssetIds.some((assetId) => !assetId) ||
        assetIds.length !== 2 ||
        assetIds.some((assetId) => !expectedAssetIds.includes(assetId))
      ) {
        throw new BusinessRuleError(
          "دارایی‌های توافق‌نامه مادر باید دقیقاً همان دو نیروگاه پرونده‌ها باشند.",
          "VALIDATION_ERROR",
          422,
          { assets: ["حذف، جایگزینی یا افزودن نیروگاه دیگر در این قرارداد مجاز نیست."] }
        );
      }

      const violations = validateScenario142MasterAgreement({
        sellerPartyId: seller.partyId,
        assets: expectedAssetIds.map((assetId) => {
          const schedule = data.schedules.find((item) => item.assetId === assetId);
          const plan = schedule
            ? pricingPlans.find(({ id: planId }) => planId === schedule.pricingPlanId)
            : null;
          const asset = assets.find(({ id: currentAssetId }) => currentAssetId === assetId);
          return {
            assetId: assetId!,
            ownerPartyId: asset?.ownerId ?? "",
            pricingModel: toScenarioPricingModel(plan?.model ?? ""),
            scheduleCount: data.schedules.filter((item) => item.assetId === assetId).length,
          };
        }),
      });
      if (violations.length > 0) {
        throw new BusinessRuleError(
          "پیکربندی توافق‌نامه مادر با سناریوی ۱۴.۲ سازگار نیست.",
          "VALIDATION_ERROR",
          422,
          {
            assets: ["توافق‌نامه مادر باید دقیقاً دو نیروگاه متعلق به شرکت داشته باشد."],
            schedules: [
              "برای نیروگاه اول دقیقاً یک برنامه قیمت ثابت و برای نیروگاه دوم دقیقاً یک برنامه شاخص بازار لازم است.",
            ],
          }
        );
      }
    }

    const audit = getAuditMetadata(request, parsed.correlationId);
    const updated = await prisma.$transaction(async (transaction) => {
      // Keep contract configuration and deprecation mutually consistent under concurrent requests.
      await transaction.$queryRaw`SELECT id FROM pricing_plans WHERE id IN (${Prisma.join([...pricingPlanIds].sort())}) ORDER BY id FOR UPDATE`;
      const currentPlans = await transaction.pricingPlan.findMany({
        where: { id: { in: pricingPlanIds }, status: { in: ["APPROVED", "ACTIVE"] } },
        select: { id: true },
      });
      if (currentPlans.length !== pricingPlanIds.length) {
        throw new BusinessRuleError("وضعیت یکی از نرخ‌نامه‌ها تغییر کرده است؛ پیکربندی را بازبینی کنید.", "CONFLICT", 409);
      }
      await transaction.commercialSchedule.deleteMany({ where: { contractId: id } });
      await transaction.contractAsset.deleteMany({ where: { contractId: id } });
      await transaction.contractAsset.createMany({
        data: data.assets.map((asset) => ({
          contractId: id,
          assetId: asset.assetId,
          sharePercent: asset.sharePercent ?? null,
          volumeMWh: asset.volumeMWh ?? null,
        })),
      });
      await transaction.commercialSchedule.createMany({
        data: data.schedules.map((schedule) => ({
          contractId: id,
          assetId: schedule.assetId,
          name: schedule.name ?? null,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          volumeType: schedule.volumeType,
          minVolume: schedule.minVolume ?? null,
          maxVolume: schedule.maxVolume ?? null,
          pricingPlanId: schedule.pricingPlanId,
          settlementCycle: schedule.settlementCycle,
          paymentDueDays: schedule.paymentDueDays,
          nettingEnabled: schedule.nettingEnabled,
        })),
      });
      await transaction.meteringAnnex.upsert({
        where: { contractId: id },
        create: {
          contractId: id,
          primarySource: data.meteringAnnex.primarySource,
          backupSource: data.meteringAnnex.backupSource ?? null,
          missingDataPolicy: data.meteringAnnex.missingDataPolicy,
          validationRules: (data.meteringAnnex.validationRules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          correctionDeadline: data.meteringAnnex.correctionDeadline ?? null,
          disputeDeadline: data.meteringAnnex.disputeDeadline ?? null,
        },
        update: {
          primarySource: data.meteringAnnex.primarySource,
          backupSource: data.meteringAnnex.backupSource ?? null,
          missingDataPolicy: data.meteringAnnex.missingDataPolicy,
          validationRules: (data.meteringAnnex.validationRules ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          correctionDeadline: data.meteringAnnex.correctionDeadline ?? null,
          disputeDeadline: data.meteringAnnex.disputeDeadline ?? null,
        },
      });
      const changed = await transaction.contract.updateMany({
        where: { id, status: contract.status },
        data: {
          status: "CONFIGURED",
          effectiveDate: data.effectiveDate,
          expirationDate: data.expirationDate ?? null,
          volumeType: data.volumeType ?? "AS_PRODUCED",
          settlementCycle: data.settlementCycle ?? "MONTHLY",
          paymentDueDays: data.paymentDueDays ?? 30,
          nettingEnabled: data.nettingEnabled ?? false,
          notes: data.notes ?? null,
        },
      });
      if (changed.count !== 1) throw new BusinessRuleError("قرارداد هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      await transaction.contractReview.create({
        data: { contractId: id, reviewerId: auth.user.id, action: "CONFIGURE", fromStatus: contract.status, toStatus: "CONFIGURED" },
      });
      await transaction.auditLog.create({
        data: {
          entityType: "Contract",
          entityId: id,
          action: "CONFIGURE",
          userId: auth.user.id,
          changes: {
            before: { status: contract.status },
            after: {
              status: "CONFIGURED",
              assetIds,
              pricingPlanIds,
              requestIds: contract.requests.map(({ id: requestId }) => requestId),
              schedules: data.schedules.map(({ assetId, pricingPlanId }) => ({
                assetId,
                pricingPlanId,
                pricingModel: pricingPlans.find(({ id: planId }) => planId === pricingPlanId)?.model,
              })),
            },
          },
          ...audit,
        },
      });
      return transaction.contract.findUnique({
        where: { id },
        include: { parties: { include: { party: true } }, assets: { include: { asset: true } }, schedules: true, meteringAnnex: true },
      });
    });

    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "configure contract");
  }
}
