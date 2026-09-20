import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { isContractConfigurationComplete } from "@/domain/contracts/completeness";
import { evaluateContractTransition } from "@/domain/contracts/workflow";
import { CONTRACT_WRITE_ROLES, CUSTOMER_ROLES, INTERNAL_ROLES, SUPPLY_ROLES, isCustomerUser } from "@/lib/access-control";
import { contractListQuerySchema, createContractSchema, updateContractStatusSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { getStoredContractActivationReadiness } from "@/lib/contract-activation-readiness";
import { getContractPeriodIssue } from "@/domain/contracts/contract-period";
import { formatApiDate } from "@/lib/persian-date";
import { currentTerminationBoundary, nextTerminationBoundary } from "@/domain/contracts/termination";

async function nextContractNumber(): Promise<string> {
  const last = await prisma.contract.findFirst({ orderBy: { createdAt: "desc" }, select: { contractNumber: true } });
  const number = last ? Number.parseInt(last.contractNumber.replace("CTR-", ""), 10) + 1 : 1000;
  return `CTR-${number}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(SUPPLY_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, createContractSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;
    const periodIssue = data.expirationDate
      ? getContractPeriodIssue({
          effectiveDate: formatApiDate(data.effectiveDate, "effectiveDate"),
          expirationDate: formatApiDate(data.expirationDate, "expirationDate"),
        })
      : null;
    if (periodIssue) {
      throw new BusinessRuleError(
        periodIssue.message,
        "VALIDATION_ERROR",
        422,
        { [periodIssue.field]: [periodIssue.message] },
      );
    }
    const contractNumber = await nextContractNumber();
    const audit = getAuditMetadata(request, parsed.correlationId);

    if ("requestIds" in data) {
      const requestRecords = await prisma.request.findMany({
        where: { id: { in: data.requestIds } },
        include: {
          party: { select: { id: true, type: true, status: true } },
          asset: { select: { id: true, ownerId: true } },
          proposals: { where: { status: "ACCEPTED" }, select: { id: true }, take: 1 },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      if (requestRecords.length !== 2) {
        throw new BusinessRuleError("هر دو درخواست قرارداد مادر باید موجود باشند.", "NOT_FOUND", 404);
      }

      const linkedContractIds = [
        ...new Set(
          requestRecords
            .map(({ contractId }) => contractId)
            .filter((contractId): contractId is string => Boolean(contractId))
        ),
      ];
      if (linkedContractIds.length === 1 && requestRecords.every(({ contractId }) => contractId === linkedContractIds[0])) {
        const existing = await prisma.contract.findUnique({
          where: { id: linkedContractIds[0] },
          include: { parties: true, assets: true, requests: true },
        });
        if (existing) return apiJson(existing);
      }
      if (linkedContractIds.length > 0) {
        throw new BusinessRuleError("حداقل یکی از درخواست‌ها قبلاً وارد قرارداد دیگری شده است.", "CONFLICT", 409);
      }
      if (
        requestRecords.some(
          ({ status, proposals }) => status !== "PROPOSAL_ACCEPTED" || proposals.length !== 1
        )
      ) {
        throw new BusinessRuleError(
          "قرارداد مادر فقط از دو درخواست دارای پیشنهاد پذیرفته‌شده قابل ایجاد است.",
          "CONFLICT",
          409
        );
      }

      const sellerIds = new Set(requestRecords.map(({ partyId }) => partyId));
      const assetIds = requestRecords.map(({ assetId }) => assetId);
      if (
        sellerIds.size !== 1 ||
        requestRecords.some(({ party }) => party.type !== "COMPANY" || party.status !== "ACTIVE")
      ) {
        throw new BusinessRuleError("هر دو درخواست باید متعلق به یک شرکت فروشنده فعال باشند.");
      }
      if (
        assetIds.some((assetId): assetId is null => assetId === null) ||
        new Set(assetIds).size !== 2
      ) {
        throw new BusinessRuleError("دو نیروگاه مستقل برای قرارداد مادر لازم است.");
      }
      const sellerId = requestRecords[0].partyId;
      if (requestRecords.some(({ asset }) => !asset || asset.ownerId !== sellerId)) {
        throw new BusinessRuleError("هر دو نیروگاه باید موجود و متعلق به شرکت فروشنده باشند.");
      }

      const contract = await prisma.$transaction(async (transaction) => {
        const buyer = await transaction.party.upsert({
          where: { systemCode: "BARTOO_BUYER" },
          update: { status: "ACTIVE" },
          create: {
            systemCode: "BARTOO_BUYER",
            type: "COMPANY",
            displayName: "شرکت برقتو",
            status: "ACTIVE",
          },
        });
        if (buyer.id === sellerId) {
          throw new BusinessRuleError("خریدار و فروشنده قرارداد مادر باید متفاوت باشند.");
        }

        const created = await transaction.contract.create({
          data: {
            contractNumber,
            type: data.type,
            status: "DRAFT",
            effectiveDate: data.effectiveDate,
            expirationDate: data.expirationDate ?? null,
            volumeType: data.volumeType ?? "AS_PRODUCED",
            settlementCycle: data.settlementCycle ?? "MONTHLY",
            paymentDueDays: data.paymentDueDays ?? 30,
            nettingEnabled: data.nettingEnabled ?? false,
            notes: data.notes ?? "توافق‌نامه مادر سناریوی شرکت چندنیروگاهی",
            createdBy: auth.user.id,
            parties: {
              create: [
                { partyId: sellerId, role: "SELLER", isPrimary: true },
                { partyId: buyer.id, role: "BUYER", isPrimary: true },
              ],
            },
            assets: {
              create: requestRecords.map(({ assetId }) => ({ assetId: assetId!, sharePercent: null })),
            },
          },
          include: { parties: true, assets: true },
        });

        const linked = await transaction.request.updateMany({
          where: {
            id: { in: data.requestIds },
            status: "PROPOSAL_ACCEPTED",
            contractId: null,
          },
          data: { status: "CONTRACT_PENDING", contractId: created.id },
        });
        if (linked.count !== 2) {
          throw new BusinessRuleError("درخواست‌ها هم‌زمان تغییر کرده‌اند.", "CONFLICT", 409);
        }

        await transaction.auditLog.create({
          data: {
            entityType: "Contract",
            entityId: created.id,
            action: "CREATE_MASTER_AGREEMENT",
            userId: auth.user.id,
            changes: {
              requestIds: requestRecords.map(({ id }) => id),
              assetIds,
              buyerId: buyer.id,
              sellerId,
            },
            ...audit,
          },
        });

        return created;
      });

      return apiJson(contract, { status: 201 });
    }

    if ("requestId" in data) {
      const requestRecord = await prisma.request.findUnique({
        where: { id: data.requestId },
        include: { proposals: { where: { status: "ACCEPTED" }, take: 1 } },
      });
      if (!requestRecord) throw new BusinessRuleError("درخواست پیدا نشد.", "NOT_FOUND", 404);
      if (requestRecord.contractId) {
        const existing = await prisma.contract.findUnique({ where: { id: requestRecord.contractId }, include: { parties: true, assets: true } });
        if (existing) return apiJson(existing);
      }
      if (requestRecord.status !== "PROPOSAL_ACCEPTED" || requestRecord.proposals.length === 0) {
        throw new BusinessRuleError("قرارداد فقط از پیشنهاد پذیرفته‌شده قابل ایجاد است.", "CONFLICT", 409);
      }
      if (!requestRecord.assetId) throw new BusinessRuleError("دارایی درخواست برای ایجاد قرارداد مشخص نشده است.");
      const contract = await prisma.$transaction(async (transaction) => {
        const buyer = await transaction.party.upsert({
          where: { systemCode: "BARTOO_BUYER" },
          update: { status: "ACTIVE" },
          create: {
            systemCode: "BARTOO_BUYER",
            type: "COMPANY",
            displayName: "شرکت برقتو",
            status: "ACTIVE",
          },
        });
        const created = await transaction.contract.create({
          data: {
            contractNumber,
            type: data.type,
            status: "DRAFT",
            effectiveDate: data.effectiveDate,
            expirationDate: data.expirationDate ?? null,
            volumeType: data.volumeType ?? "AS_PRODUCED",
            settlementCycle: data.settlementCycle ?? "MONTHLY",
            paymentDueDays: data.paymentDueDays ?? 30,
            nettingEnabled: data.nettingEnabled ?? false,
            notes: data.notes ?? `قرارداد خرید برق درخواست ${requestRecord.caseNumber}`,
            createdBy: auth.user.id,
            parties: { create: [
              { partyId: requestRecord.partyId, role: "SELLER", isPrimary: true },
              { partyId: buyer.id, role: "BUYER", isPrimary: true },
            ] },
            assets: { create: { assetId: requestRecord.assetId!, sharePercent: 100 } },
          },
          include: { parties: true, assets: true },
        });
        const linked = await transaction.request.updateMany({
          where: { id: data.requestId, status: "PROPOSAL_ACCEPTED", contractId: null },
          data: { status: "CONTRACT_PENDING", contractId: created.id },
        });
        if (linked.count !== 1) throw new BusinessRuleError("درخواست هم‌زمان تغییر کرده است.", "CONFLICT", 409);
        await transaction.auditLog.create({
          data: { entityType: "Contract", entityId: created.id, action: "CREATE_FROM_REQUEST", userId: auth.user.id, changes: { requestId: data.requestId, buyerId: buyer.id, sellerId: requestRecord.partyId }, ...audit },
        });
        return created;
      });
      return apiJson(contract, { status: 201 });
    }

    const primarySellers = data.parties.filter((party) => party.role === "SELLER" && party.isPrimary);
    if (primarySellers.length !== 1) {
      throw new BusinessRuleError("قرارداد باید دقیقاً یک فروشنده اصلی داشته باشد.");
    }
    const buyer = await prisma.party.upsert({
      where: { systemCode: "BARTOO_BUYER" },
      update: { status: "ACTIVE" },
      create: {
        systemCode: "BARTOO_BUYER",
        type: "COMPANY",
        displayName: "شرکت برقتو",
        status: "ACTIVE",
      },
    });
    if (buyer.id === primarySellers[0].partyId) throw new BusinessRuleError("طرف خریدار برقتو معتبر نیست.", "CONFLICT", 409);
    const suppliedParties = data.parties.filter(({ role }) => role !== "BUYER");
    const partyIds = [...new Set([...suppliedParties.map(({ partyId }) => partyId), buyer.id])];
    const assetIds = [...new Set((data.assets ?? []).map(({ assetId }) => assetId))];
    const [partyCount, assets] = await Promise.all([
      prisma.party.count({ where: { id: { in: partyIds }, status: "ACTIVE" } }),
      prisma.asset.findMany({ where: { id: { in: assetIds } }, select: { id: true, ownerId: true } }),
    ]);
    if (partyCount !== partyIds.length) throw new BusinessRuleError("حداقل یکی از طرف‌های قرارداد معتبر نیست.");
    if (assets.length !== assetIds.length || assets.some(({ ownerId }) => ownerId !== primarySellers[0].partyId)) {
      throw new BusinessRuleError("دارایی‌های قرارداد باید موجود و متعلق به فروشنده اصلی باشند.");
    }
    const contract = await prisma.$transaction(async (transaction) => {
      const created = await transaction.contract.create({
        data: {
          contractNumber,
          type: data.type,
          status: "DRAFT",
          effectiveDate: data.effectiveDate,
          expirationDate: data.expirationDate ?? null,
          volumeType: data.volumeType ?? "AS_PRODUCED",
          settlementCycle: data.settlementCycle ?? "MONTHLY",
          paymentDueDays: data.paymentDueDays ?? 30,
          nettingEnabled: data.nettingEnabled ?? false,
          notes: data.notes ?? null,
          createdBy: auth.user.id,
          parties: { create: [
            ...suppliedParties.map((party) => ({ ...party, isPrimary: party.isPrimary ?? false })),
            { partyId: buyer.id, role: "BUYER" as const, isPrimary: true },
          ] },
          assets: data.assets?.length ? { create: data.assets.map((asset) => ({ assetId: asset.assetId, sharePercent: asset.sharePercent ?? null })) } : undefined,
        },
        include: { parties: true, assets: true },
      });
      await transaction.auditLog.create({ data: { entityType: "Contract", entityId: created.id, action: "CREATE", userId: auth.user.id, changes: { partyIds, assetIds }, ...audit } });
      return created;
    });
    return apiJson(contract, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create contract");
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;
    const query = parseSearchParams(request, contractListQuerySchema);
    if (!query.ok) return query.response;
    const { id, page, limit } = query.data;
    if (id) {
      const contract = await prisma.contract.findUnique({
        where: { id },
        include: {
          parties: { include: { party: true } },
          assets: { include: { asset: true } },
          schedules: { include: { pricingPlan: true, asset: true } },
          meteringAnnex: true,
          signatures: true,
          requests: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        },
      });
      if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
      if (isCustomerUser(auth.user) && !contract.parties.some(({ partyId }) => auth.user.accessiblePartyIds.includes(partyId))) return forbiddenResponse();
      const activationReadiness = await getStoredContractActivationReadiness(contract.id);
      return apiJson({ ...contract, activationReadiness });
    }
    const contracts = await prisma.contract.findMany({
      where: isCustomerUser(auth.user) ? { parties: { some: { partyId: { in: auth.user.accessiblePartyIds } } } } : {},
      include: { parties: { include: { party: true } }, assets: { include: { asset: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return apiJson(contracts);
  } catch (error) {
    return handleRouteError(request, error, "fetch contracts");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireApiUser(CONTRACT_WRITE_ROLES);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, updateContractStatusSchema);
    if (!parsed.ok) return parsed.response;
    const { id, status, notes } = parsed.data;
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { parties: true, assets: true, schedules: true, meteringAnnex: true, signatures: true },
    });
    if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
    if (contract.status === status) return apiJson(contract);
    if (status === "SIGNED") throw new BusinessRuleError("وضعیت امضاشده فقط با ثبت امضای هر دو طرف ایجاد می‌شود.", "CONFLICT", 409);
    if (status === "ACTIVE" && contract.status === "SIGNED") {
      const readiness = await getStoredContractActivationReadiness(id);
      if (!readiness?.ready) {
        throw new BusinessRuleError(
          readiness?.awaitingOperation
            ? "قرارداد امضا شده و در انتظار بهره‌برداری نیروگاه است."
            : "قرارداد به‌دلیل تعارض با قرارداد فروش موجود قابل فعال‌سازی نیست.",
          "CONFLICT",
          409,
          { activation: readiness?.blockers ?? ["وضعیت آمادگی قرارداد قابل تشخیص نیست."] },
        );
      }
    }
    const requiredPartyIds = contract.parties.filter((party) => party.isPrimary && ["BUYER", "SELLER"].includes(party.role)).map((party) => party.partyId);
    const decision = evaluateContractTransition({
      from: contract.status,
      to: status,
      actorRole: auth.user.role,
      configurationComplete: isContractConfigurationComplete(contract),
      allRequiredPartiesSigned: new Set(requiredPartyIds).size === 2 && contract.signatures.filter(({ partyId }) => requiredPartyIds.includes(partyId)).length === 2,
      effectiveDate: contract.effectiveDate,
      note: notes,
    });
    if (!decision.allowed) throw new BusinessRuleError(decision.reason);
    const now = new Date();
    const terminationDate = status === "TERMINATED" ? currentTerminationBoundary(now) : null;
    if (status === "TERMINATED" && !terminationDate) {
      throw new BusinessRuleError(
        `فسخ نهایی فقط در آغاز ماه شمسی و پس از پایان دوره تحویل مجاز است. تاریخ مجاز بعدی: ${nextTerminationBoundary(now) ?? "ابتدای ماه بعد"}.`,
        "CONFLICT",
        409,
      );
    }
    if (terminationDate) {
      const assetIds = contract.assets.map(({ assetId }) => assetId);
      const [laterReading, laterSettlement] = await Promise.all([
        prisma.meterReading.findFirst({
          where: {
            assetId: { in: assetIds },
            periodStart: { lt: terminationDate },
            periodEnd: { gt: terminationDate },
            status: { not: "REJECTED" },
          },
          select: { id: true },
        }),
        prisma.settlement.findFirst({
          where: { contractId: id, periodEnd: { gt: terminationDate } },
          select: { id: true },
        }),
      ]);
      if (laterReading || laterSettlement) {
        throw new BusinessRuleError(
          "قرائتی از تاریخ فسخ عبور می‌کند یا تسویه‌ای پس از آن ثبت شده است؛ ابتدا تعارض دوره‌های مالی را بررسی کنید.",
          "CONFLICT",
          409,
        );
      }
    }
    const audit = getAuditMetadata(request, parsed.correlationId);
    const updated = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.contract.updateMany({
        where: { id, status: contract.status },
        data: {
          status,
          ...(status === "ACTIVE" && contract.status === "SIGNED" && { activatedAt: now }),
          ...(terminationDate && { terminationDate }),
        },
      });
      if (changed.count !== 1) throw new BusinessRuleError("وضعیت قرارداد هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      await transaction.contractReview.create({ data: { contractId: id, reviewerId: auth.user.id, action: "STATUS_CHANGE", fromStatus: contract.status, toStatus: status, notes: notes ?? null } });
      await transaction.auditLog.create({ data: { entityType: "Contract", entityId: id, action: "STATUS_CHANGE", userId: auth.user.id, changes: { before: { status: contract.status }, after: { status, ...(terminationDate && { terminationDate }), reason: notes ?? null } }, ...audit } });
      if (["TERMINATION_PENDING", "TERMINATED"].includes(status) || (contract.status === "TERMINATION_PENDING" && status === "ACTIVE")) {
        const sellerPartyIds = contract.parties.filter(({ role }) => role === "SELLER").map(({ partyId }) => partyId);
        const linkedRequests = await transaction.request.findMany({ where: { contractId: id }, select: { initiatorId: true } });
        const initiatorIds = linkedRequests.map(({ initiatorId }) => initiatorId).filter((userId): userId is string => Boolean(userId));
        const recipients = await transaction.user.findMany({
          where: { active: true, OR: [{ partyId: { in: sellerPartyIds } }, { id: { in: initiatorIds } }] },
          select: { id: true },
        });
        const title = status === "TERMINATION_PENDING"
          ? `درخواست فسخ قرارداد ${contract.contractNumber} ثبت شد`
          : status === "TERMINATED"
            ? `قرارداد ${contract.contractNumber} فسخ شد`
            : `درخواست فسخ قرارداد ${contract.contractNumber} رد شد`;
        if (recipients.length > 0) await transaction.notification.createMany({
          data: [...new Set(recipients.map(({ id: userId }) => userId))].map((userId) => ({
            userId,
            partyId: sellerPartyIds[0],
            title,
            message: notes?.trim() ?? "وضعیت فسخ قرارداد به‌روزرسانی شد.",
            type: "CONTRACT" as const,
            link: `/customer/contracts/${id}`,
          })),
        });
        if (status === "TERMINATION_PENDING") {
          const reviewers = await transaction.user.findMany({
            where: {
              active: true,
              role: { in: ["ADMIN", "STAFF_LEGAL", "MANAGER"] },
              id: { not: auth.user.id },
            },
            select: { id: true },
          });
          if (reviewers.length > 0) await transaction.notification.createMany({
            data: reviewers.map(({ id: userId }) => ({
              userId,
              title: `درخواست فسخ قرارداد ${contract.contractNumber} نیازمند بررسی است`,
              message: notes?.trim() ?? "درخواست فسخ جدید ثبت شد.",
              type: "CONTRACT" as const,
              link: `/admin/contracts/${id}`,
            })),
          });
        }
      }
      if (status === "ACTIVE") {
        await transaction.request.updateMany({ where: { contractId: id, status: "CONTRACT_SIGNED" }, data: { status: "ACTIVE" } });
        const sellerPartyIds = contract.parties.filter(({ role }) => role === "SELLER").map(({ partyId }) => partyId);
        const linkedRequests = await transaction.request.findMany({ where: { contractId: id }, select: { initiatorId: true } });
        const initiatorIds = linkedRequests.map(({ initiatorId }) => initiatorId).filter((userId): userId is string => Boolean(userId));
        const recipients = await transaction.user.findMany({
          where: { active: true, OR: [{ partyId: { in: sellerPartyIds } }, { id: { in: initiatorIds } }] },
          select: { id: true },
        });
        if (recipients.length > 0) await transaction.notification.createMany({
          data: [...new Set(recipients.map(({ id: userId }) => userId))].map((userId) => ({
            userId,
            partyId: sellerPartyIds[0],
            title: `قرارداد ${contract.contractNumber} فعال شد`,
            message: "الزامات بهره‌برداری و محدودیت‌های فروش بررسی شد و دوره تحویل می‌تواند آغاز شود.",
            type: "CONTRACT" as const,
            link: `/customer/contracts/${id}`,
          })),
        });
      }
      return transaction.contract.findUnique({ where: { id } });
    });
    return apiJson(updated);
  } catch (error) {
    return handleRouteError(request, error, "update contract status");
  }
}
