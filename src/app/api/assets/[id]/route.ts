import { apiJson } from "@/lib/api-response";
import { NextRequest } from "next/server";
import { Prisma, type ContractStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  INTERNAL_ROLES,
  TECHNICAL_ROLES,
  canAccessParty,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { disposeAssetSchema, updateAssetSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { evaluateOperationalReadiness } from "@/domain/assets/operational-readiness";
import { getAssetDisposition } from "@/domain/assets/disposition";
import { getAuditMetadata } from "@/lib/audit";

const dependencySelection = {
  meters: true,
  requests: true,
  settlements: true,
  assetDocuments: true,
  contractAssets: true,
  commercialSchedules: true,
  meterReadings: true,
  generationProfileVersions: true,
} as const;

const closedContractStatuses: ContractStatus[] = ["TERMINATED", "EXPIRED", "REJECTED", "CANCELLED"];
const openContractLinks = {
  where: { contract: { status: { notIn: closedContractStatuses } } },
  select: { contract: { select: { id: true, contractNumber: true, status: true } } },
} as const;

function resolveAssetDisposition(asset: {
  generationProfile: { id: string } | null;
  _count: Record<keyof typeof dependencySelection, number>;
}) {
  return getAssetDisposition({
    requests: asset._count.requests,
    meters: asset._count.meters,
    documents: asset._count.assetDocuments,
    contracts: asset._count.contractAssets,
    schedules: asset._count.commercialSchedules,
    settlements: asset._count.settlements,
    readings: asset._count.meterReadings,
    generationProfiles: asset._count.generationProfileVersions + (asset.generationProfile ? 1 : 0),
  });
}

// GET /api/assets/[id] - Get a single asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...INTERNAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;

    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            type: true,
          },
        },
        meters: true,
        requests: {
          select: {
            initiatorId: true,
            documents: { select: { type: true, verified: true } },
          },
        },
        _count: {
          select: dependencySelection,
        },
        contractAssets: openContractLinks,
        generationProfile: { select: { id: true } },
      },
    });

    if (!asset) {
      return apiError(404, "NOT_FOUND", "دارایی پیدا نشد.", { request });
    }

    if (!canAccessParty(auth.user, asset.owner.id)) return forbiddenResponse();

    const verifiedDocumentTypes = asset.requests.flatMap(({ documents }) =>
      documents.filter(({ verified }) => verified).map(({ type }) => type),
    );
    const { generationProfile, contractAssets, ...assetPayload } = asset;
    return apiJson({
      ...assetPayload,
      disposition: resolveAssetDisposition({ ...asset, generationProfile }),
      blockingContracts: contractAssets.map(({ contract }) => contract),
      operationalReadiness: evaluateOperationalReadiness({
        status: asset.status,
        operationalDate: asset.operationalDate,
        connectionStatus: asset.connectionStatus,
        hasActiveMainMeter: asset.meters.some(({ type, active }) => type === "MAIN" && active),
        verifiedDocumentTypes,
      }),
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch asset");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, disposeAssetSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const audit = getAuditMetadata(request, parsed.correlationId);

    const result = await prisma.$transaction(async (transaction) => {
      const asset = await transaction.asset.findUnique({
        where: { id },
        include: {
          generationProfile: { select: { id: true } },
          requests: { select: { initiatorId: true } },
          contractAssets: openContractLinks,
          _count: { select: dependencySelection },
        },
      });
      if (!asset) throw new BusinessRuleError("دارایی پیدا نشد.", "NOT_FOUND", 404);

      const disposition = resolveAssetDisposition(asset);
      if (asset.contractAssets.length > 0) {
        throw new BusinessRuleError(
          "تا زمانی که قرارداد مرتبط باز است، بایگانی این دارایی مجاز نیست. ابتدا وضعیت قرارداد را تعیین تکلیف کنید.",
          "CONFLICT",
          409,
          { contracts: asset.contractAssets.map(({ contract }) => contract.contractNumber) },
        );
      }
      if (disposition.mode === "DELETE") {
        await transaction.auditLog.create({
          data: {
            entityType: "Asset",
            entityId: asset.id,
            action: "DELETE_UNUSED_ASSET",
            userId: auth.user.id,
            changes: {
              reason: parsed.data.reason,
              snapshot: {
                ownerId: asset.ownerId,
                name: asset.name,
                type: asset.type,
                status: asset.status,
                province: asset.province,
                city: asset.city,
                capacityNominal: asset.capacityNominal,
                capacitySellable: asset.capacitySellable,
              },
            },
            ...audit,
          },
        });
        await transaction.asset.delete({ where: { id: asset.id } });
        return { outcome: "DELETED" as const, message: "دارایی استفاده‌نشده حذف شد." };
      }

      if (asset.archivedAt) {
        return { outcome: "ARCHIVED" as const, message: "دارایی قبلاً بایگانی شده است.", disposition };
      }

      const archivedAt = new Date();
      await transaction.asset.update({
        where: { id: asset.id },
        data: {
          archivedAt,
          archivedById: auth.user.id,
          archiveReason: parsed.data.reason,
        },
      });
      await transaction.auditLog.create({
        data: {
          entityType: "Asset",
          entityId: asset.id,
          action: "ARCHIVE_ASSET",
          userId: auth.user.id,
          changes: {
            reason: parsed.data.reason,
            dependencies: disposition.dependencies,
          },
          ...audit,
        },
      });

      const initiatorIds = asset.requests
        .map(({ initiatorId }) => initiatorId)
        .filter((userId): userId is string => Boolean(userId));
      const recipients = await transaction.user.findMany({
        where: {
          active: true,
          OR: [{ partyId: asset.ownerId }, { id: { in: initiatorIds } }],
        },
        select: { id: true },
      });
      if (recipients.length > 0) {
        await transaction.notification.createMany({
          data: [...new Set(recipients.map(({ id: userId }) => userId))].map((userId) => ({
            userId,
            partyId: asset.ownerId,
            title: `نیروگاه ${asset.name} بایگانی شد`,
            message: `دلیل بایگانی: ${parsed.data.reason}`,
            type: "ALERT" as const,
            link: `/customer/assets/${asset.id}`,
          })),
        });
      }

      return { outcome: "ARCHIVED" as const, message: "دارایی وابسته بایگانی شد.", disposition };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return apiJson(result);
  } catch (error) {
    return handleRouteError(request, error, "dispose asset");
  }
}

// PATCH /api/assets/[id] - Update an asset
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...TECHNICAL_ROLES, "MANAGER"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateAssetSchema);
    if (!parsed.ok) return parsed.response;

    const existing = await prisma.asset.findUnique({
      where: { id },
      include: {
        meters: { select: { type: true, active: true } },
        requests: {
          select: {
            initiatorId: true,
            documents: { select: { type: true, verified: true } },
          },
        },
      },
    });
    if (!existing) return apiError(404, "NOT_FOUND", "دارایی پیدا نشد.", { request });
    if (!canAccessParty(auth.user, existing.ownerId)) return forbiddenResponse();
    if (existing.archivedAt) {
      throw new BusinessRuleError(
        "دارایی بایگانی‌شده قابل ویرایش یا فعال‌سازی مجدد نیست.",
        "CONFLICT",
        409,
      );
    }

    const {
      ownerId,
      name,
      type,
      status,
      province,
      city,
      address,
      latitude,
      longitude,
      gridCompany,
      connectionPoint,
      connectionStatus,
      capacityNominal,
      capacitySellable,
      technology,
      operationalDate,
      connectionDate,
    } = parsed.data;

    const finalNominal = capacityNominal ?? existing.capacityNominal;
    const finalSellable = capacitySellable ?? existing.capacitySellable;
    if (finalSellable > finalNominal) {
      return apiError(422, "VALIDATION_ERROR", "ظرفیت قابل فروش از ظرفیت نامی بیشتر است.", {
        request,
        details: { capacitySellable: ["ظرفیت قابل فروش نمی‌تواند از ظرفیت نامی بیشتر باشد."] },
      });
    }

    if (status === "ACTIVE" && existing.status !== "ACTIVE") {
      const readiness = evaluateOperationalReadiness({
        status: "ACTIVE",
        operationalDate: operationalDate === undefined ? existing.operationalDate : operationalDate,
        connectionStatus: connectionStatus === undefined ? existing.connectionStatus : connectionStatus,
        hasActiveMainMeter: existing.meters.some(({ type: meterType, active }) => meterType === "MAIN" && active),
        verifiedDocumentTypes: existing.requests.flatMap(({ documents }) =>
          documents.filter(({ verified }) => verified).map(({ type: documentType }) => documentType),
        ),
      });
      if (!readiness.ready) {
        throw new BusinessRuleError(
          "نیروگاه هنوز آماده بهره‌برداری نیست.",
          "CONFLICT",
          409,
          { status: readiness.blockers },
        );
      }
    }

    if (ownerId) {
      const ownerExists = await prisma.party.findUnique({ where: { id: ownerId }, select: { id: true } });
      if (!ownerExists) {
        return apiError(422, "VALIDATION_ERROR", "مالک انتخاب‌شده وجود ندارد.", {
          request,
          details: { ownerId: ["مالک انتخاب‌شده وجود ندارد."] },
        });
      }
    }

    const asset = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.asset.update({
        where: { id },
        data: {
        ...(ownerId && { ownerId }),
        name,
        type,
        ...(status && { status }),
        province,
        city,
        address,
        latitude,
        longitude,
        gridCompany,
        connectionPoint,
        connectionStatus,
        capacityNominal,
        capacitySellable,
        technology,
        operationalDate,
        connectionDate,
        },
        include: { owner: true },
      });
      if (status === "ACTIVE" && existing.status !== "ACTIVE") {
        await transaction.request.updateMany({
          where: { assetId: id },
          data: { operationalStatus: "ACTIVE" },
        });
        const initiatorIds = existing.requests
          .map(({ initiatorId }) => initiatorId)
          .filter((userId): userId is string => Boolean(userId));
        const recipients = await transaction.user.findMany({
          where: { active: true, OR: [{ partyId: existing.ownerId }, { id: { in: initiatorIds } }] },
          select: { id: true },
        });
        if (recipients.length > 0) await transaction.notification.createMany({
          data: [...new Set(recipients.map(({ id: userId }) => userId))].map((userId) => ({
            userId,
            partyId: existing.ownerId,
            title: `بهره‌برداری نیروگاه ${updated.name} تأیید شد`,
            message: "نیروگاه آماده فعال‌سازی قرارداد و شروع دوره تحویل است.",
            type: "ALERT" as const,
            link: `/customer/assets/${id}`,
          })),
        });
        const [signedContracts, internalRecipients] = await Promise.all([
          transaction.contract.findMany({
            where: { status: "SIGNED", assets: { some: { assetId: id } } },
            select: { id: true, contractNumber: true },
          }),
          transaction.user.findMany({
            where: { active: true, role: { in: ["ADMIN", "STAFF_SUPPLY"] } },
            select: { id: true },
          }),
        ]);
        if (signedContracts.length > 0 && internalRecipients.length > 0) {
          await transaction.notification.createMany({
            data: signedContracts.flatMap((contract) => internalRecipients.map(({ id: userId }) => ({
              userId,
              title: `بهره‌برداری نیروگاه قرارداد ${contract.contractNumber} تأیید شد`,
              message: "آمادگی سایر نیروگاه‌های قرارداد را بررسی و در صورت رفع همه محدودیت‌ها قرارداد را فعال کنید.",
              type: "CONTRACT" as const,
              link: `/admin/contracts/${contract.id}`,
            }))),
          });
        }
      }
      return updated;
    });

    return apiJson(asset);
  } catch (error) {
    return handleRouteError(request, error, "update asset");
  }
}
