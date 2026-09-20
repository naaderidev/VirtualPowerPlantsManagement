import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, canAccessParty } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { completeRequestSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import {
  canCompleteRequestInformation,
  nextStatusAfterInformationSubmission,
} from "@/domain/requests/workflow";

const COMPLETE_INFORMATION_ROLES = ["ADMIN", ...CUSTOMER_ROLES] as const;

function assetStatusFromRequest(status: "ACTIVE" | "UNDER_CONSTRUCTION" | "PLANNING" | "TEMPORARILY_STOPPED") {
  if (status === "ACTIVE") return "ACTIVE" as const;
  if (status === "UNDER_CONSTRUCTION") return "UNDER_CONSTRUCTION" as const;
  if (status === "TEMPORARILY_STOPPED") return "INACTIVE" as const;
  return "PLANNING" as const;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(COMPLETE_INFORMATION_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, completeRequestSchema);
    if (!parsed.ok) return parsed.response;

    const existingRequest = await prisma.request.findUnique({
      where: { id },
      include: { asset: { include: { meters: true, generationProfile: true } } },
    });
    if (!existingRequest) throw new BusinessRuleError("درخواست پیدا نشد.", "NOT_FOUND", 404);
    if (!canAccessParty(auth.user, existingRequest.partyId)) {
      throw new BusinessRuleError("این درخواست متعلق به حساب شما نیست.", "FORBIDDEN", 403);
    }
    if (!canCompleteRequestInformation(existingRequest.status)) {
      throw new BusinessRuleError("در وضعیت فعلی امکان تکمیل اطلاعات نیروگاه وجود ندارد.", "CONFLICT", 409);
    }

    const { mode, asset: assetInput, meters, generationProfile, existingContract } = parsed.data;
    if (mode === "SUBMIT" && existingRequest.hasExistingContract && !existingContract) {
      throw new BusinessRuleError(
        "جزئیات قرارداد فروش موجود باید تکمیل شود.",
        "VALIDATION_ERROR",
        422,
        { existingContract: ["اطلاعات قرارداد فروش موجود را وارد و حق فروش ظرفیت آزاد را تأیید کنید."] },
      );
    }
    if (mode === "SUBMIT" && !assetInput.operationalDate) {
      throw new BusinessRuleError(
        existingRequest.operationalStatus === "ACTIVE"
          ? "تاریخ بهره‌برداری واقعی الزامی است."
          : "تاریخ پیش‌بینی‌شده بهره‌برداری الزامی است.",
        "VALIDATION_ERROR",
        422,
        { operationalDate: ["تاریخ بهره‌برداری را وارد کنید."] },
      );
    }
    if (
      mode === "SUBMIT" &&
      existingRequest.operationalStatus === "ACTIVE" &&
      (assetInput.connectionStatus !== "CONNECTED" || !meters.some(({ type }) => type === "MAIN"))
    ) {
      throw new BusinessRuleError(
        "نیروگاه فعال باید اتصال شبکه و کنتور اصلی داشته باشد.",
        "VALIDATION_ERROR",
        422,
        {
          connectionStatus: assetInput.connectionStatus === "CONNECTED" ? [] : ["وضعیت اتصال باید «متصل» باشد."],
          meters: meters.some(({ type }) => type === "MAIN") ? [] : ["ثبت کنتور اصلی الزامی است."],
        },
      );
    }
    const nextStatus = mode === "SUBMIT"
      ? nextStatusAfterInformationSubmission(existingRequest.status)
      : existingRequest.status;
    const isStatusChange = nextStatus !== existingRequest.status;
    const auditMetadata = getAuditMetadata(request, parsed.correlationId);

    const result = await prisma.$transaction(async (transaction) => {
      const assetData = {
        internalCode: assetInput.internalCode ?? null,
        name: assetInput.name,
        type: assetInput.type,
        status: existingRequest.asset?.status === "ACTIVE"
          ? "ACTIVE" as const
          : assetStatusFromRequest(existingRequest.operationalStatus),
        province: assetInput.province,
        city: assetInput.city,
        address: assetInput.address ?? null,
        latitude: assetInput.latitude ?? null,
        longitude: assetInput.longitude ?? null,
        gridCompany: assetInput.gridCompany ?? null,
        connectionPoint: assetInput.connectionPoint ?? null,
        connectionStatus: assetInput.connectionStatus ?? null,
        capacityNominal: assetInput.capacityNominal,
        capacitySellable: assetInput.capacitySellable,
        ownershipPercent: assetInput.ownershipPercent,
        requesterRole: assetInput.requesterRole,
        technology: assetInput.technology ?? null,
        operationalDate: assetInput.operationalDate ?? null,
        connectionDate: assetInput.connectionDate ?? null,
      };

      const asset = existingRequest.asset
        ? await transaction.asset.update({ where: { id: existingRequest.asset.id }, data: assetData })
        : await transaction.asset.create({
            data: { ownerId: existingRequest.partyId, ...assetData },
          });

      for (const meterInput of meters) {
        const existingMeter = existingRequest.asset?.meters.find(({ type }) => type === meterInput.type);
        const meterData = {
          serialNumber: meterInput.serialNumber,
          manufacturer: meterInput.manufacturer ?? null,
          model: meterInput.model ?? null,
          readInterval: meterInput.readInterval,
          dataSource: meterInput.dataSource,
          installDate: meterInput.installDate ?? null,
        };

        if (existingMeter) {
          await transaction.meter.update({ where: { id: existingMeter.id }, data: meterData });
        } else {
          await transaction.meter.create({
            data: { assetId: asset.id, type: meterInput.type, ...meterData },
          });
        }
      }

      if (generationProfile) {
        const annualTotal = [
          generationProfile.jan,
          generationProfile.feb,
          generationProfile.mar,
          generationProfile.apr,
          generationProfile.may,
          generationProfile.jun,
          generationProfile.jul,
          generationProfile.aug,
          generationProfile.sep,
          generationProfile.oct,
          generationProfile.nov,
          generationProfile.dec,
        ].reduce((sum, month) => sum + month, 0);

        await transaction.generationProfile.upsert({
          where: { assetId: asset.id },
          create: { assetId: asset.id, ...generationProfile, annualTotal },
          update: { ...generationProfile, annualTotal },
        });

        if (mode === "SUBMIT") {
          const latestVersion = await transaction.generationProfileVersion.findFirst({
            where: { assetId: asset.id, year: generationProfile.year },
            orderBy: { version: "desc" },
            select: { version: true },
          });
          const version = (latestVersion?.version ?? 0) + 1;
          const versionedProfile = await transaction.generationProfileVersion.create({
            data: {
              assetId: asset.id,
              ...generationProfile,
              annualTotal,
              version,
              status: "REVIEW",
              createdBy: auth.user.id,
              submittedAt: new Date(),
            },
          });
          await transaction.auditLog.create({
            data: {
              entityType: "GenerationProfileVersion",
              entityId: versionedProfile.id,
              action: "SUBMIT_VERSION",
              userId: auth.user.id,
              changes: { assetId: asset.id, year: generationProfile.year, version, annualTotal },
              ...auditMetadata,
            },
          });
        }
      }

      const updateResult = await transaction.request.updateMany({
        where: { id, status: existingRequest.status },
        data: {
          assetId: asset.id,
          ...(isStatusChange && { status: nextStatus }),
          ...(existingRequest.hasExistingContract && existingContract && {
            existingContractStart: existingContract.startDate,
            existingContractEnd: existingContract.endDate,
            existingContractCounterparty: existingContract.counterparty,
            existingContractCommittedCapacity: existingContract.committedCapacity,
            existingContractExclusive: existingContract.exclusive,
            existingContractRestrictions: existingContract.restrictions ?? null,
            existingContractRightToSellConfirmed: existingContract.rightToSellConfirmed,
          }),
        },
      });
      if (updateResult.count !== 1) {
        throw new BusinessRuleError("وضعیت درخواست هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید.", "CONFLICT", 409);
      }

      if (isStatusChange) {
        await transaction.requestReview.create({
          data: {
            requestId: id,
            reviewerId: auth.user.id,
            action: "SUBMIT_INFORMATION",
            fromStatus: existingRequest.status,
            toStatus: nextStatus,
            notes: "اطلاعات کامل نیروگاه ارسال شد.",
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          entityType: "Asset",
          entityId: asset.id,
          action: existingRequest.asset ? "UPDATE" : "CREATE",
          userId: auth.user.id,
          changes: {
            requestId: id,
            mode,
            before: existingRequest.asset
              ? {
                  name: existingRequest.asset.name,
                  capacityNominal: existingRequest.asset.capacityNominal,
                  capacitySellable: existingRequest.asset.capacitySellable,
                }
              : null,
            after: {
              name: asset.name,
              capacityNominal: asset.capacityNominal,
              capacitySellable: asset.capacitySellable,
            },
          },
          ...auditMetadata,
        },
      });

      if (isStatusChange) {
        await transaction.auditLog.create({
          data: {
            entityType: "Request",
            entityId: id,
            action: "STATUS_CHANGE",
            userId: auth.user.id,
            changes: {
              before: { status: existingRequest.status, assetId: existingRequest.assetId },
              after: { status: nextStatus, assetId: asset.id },
            },
            ...auditMetadata,
          },
        });
      }

      return transaction.request.findUnique({
        where: { id },
        include: { asset: { include: { meters: true, generationProfile: true } } },
      });
    });

    return apiJson(result);
  } catch (error) {
    return handleRouteError(request, error, "complete request information");
  }
}
