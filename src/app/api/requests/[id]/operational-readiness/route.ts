import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { canSubmitOperationalReadiness } from "@/domain/assets/operational-readiness";
import { CUSTOMER_ROLES, canAccessParty } from "@/lib/access-control";
import { getAuditMetadata } from "@/lib/audit";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { operationalReadinessSubmissionSchema } from "@/lib/api-schemas";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const REQUIRED_OPERATIONAL_DOCUMENTS = ["CONNECTION", "METER"] as const;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiUser(CUSTOMER_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, operationalReadinessSubmissionSchema);
    if (!parsed.ok) return parsed.response;

    const requestRecord = await prisma.request.findUnique({
      where: { id },
      include: {
        asset: { include: { meters: true } },
        documents: { select: { type: true } },
      },
    });
    if (!requestRecord) {
      throw new BusinessRuleError("درخواست پیدا نشد.", "NOT_FOUND", 404);
    }
    if (!canAccessParty(auth.user, requestRecord.partyId)) {
      throw new BusinessRuleError("این درخواست متعلق به حساب شما نیست.", "FORBIDDEN", 403);
    }
    if (!requestRecord.asset) {
      throw new BusinessRuleError("اطلاعات پایه نیروگاه هنوز ثبت نشده است.", "CONFLICT", 409);
    }
    if (!canSubmitOperationalReadiness(requestRecord.status) || requestRecord.asset.status === "ACTIVE") {
      throw new BusinessRuleError(
        "در وضعیت فعلی امکان تغییر اطلاعات بهره‌برداری وجود ندارد.",
        "CONFLICT",
        409,
      );
    }

    const { mode, meters, ...operationalData } = parsed.data;
    const now = new Date();
    if (mode === "SUBMIT" && operationalData.operationalDate && operationalData.operationalDate > now) {
      throw new BusinessRuleError(
        "تاریخ بهره‌برداری واقعی نمی‌تواند در آینده باشد.",
        "VALIDATION_ERROR",
        422,
        { operationalDate: ["تاریخ بهره‌برداری واقعی نمی‌تواند در آینده باشد."] },
      );
    }
    if (operationalData.connectionDate && operationalData.connectionDate > now) {
      throw new BusinessRuleError(
        "تاریخ اتصال نمی‌تواند در آینده باشد.",
        "VALIDATION_ERROR",
        422,
        { connectionDate: ["تاریخ اتصال نمی‌تواند در آینده باشد."] },
      );
    }
    if (mode === "SUBMIT") {
      const uploadedTypes = new Set(requestRecord.documents.map(({ type }) => type));
      const missingDocuments = REQUIRED_OPERATIONAL_DOCUMENTS.filter((type) => !uploadedTypes.has(type));
      if (missingDocuments.length > 0) {
        throw new BusinessRuleError(
          "پیش از اعلام آمادگی، مدارک اتصال و کنتور را بارگذاری کنید.",
          "VALIDATION_ERROR",
          422,
          { documents: ["مدرک اتصال و مدرک کنتور الزامی است."] },
        );
      }
    }

    const auditMetadata = getAuditMetadata(request, parsed.correlationId);
    const result = await prisma.$transaction(async (transaction) => {
      const asset = await transaction.asset.update({
        where: { id: requestRecord.asset!.id },
        data: operationalData,
      });

      for (const meterInput of meters) {
        const existingMeter = requestRecord.asset!.meters.find(({ type }) => type === meterInput.type);
        const meterData = {
          serialNumber: meterInput.serialNumber,
          manufacturer: meterInput.manufacturer ?? null,
          model: meterInput.model ?? null,
          readInterval: meterInput.readInterval,
          dataSource: meterInput.dataSource,
          installDate: meterInput.installDate ?? null,
          active: true,
        };
        if (existingMeter) {
          await transaction.meter.update({ where: { id: existingMeter.id }, data: meterData });
        } else {
          await transaction.meter.create({
            data: { assetId: asset.id, type: meterInput.type, ...meterData },
          });
        }
      }

      await transaction.auditLog.create({
        data: {
          entityType: "Asset",
          entityId: asset.id,
          action: mode === "SUBMIT" ? "SUBMIT_OPERATIONAL_READINESS" : "SAVE_OPERATIONAL_DRAFT",
          userId: auth.user.id,
          changes: {
            requestId: id,
            allowedFields: [
              "operationalDate",
              "connectionDate",
              "gridCompany",
              "connectionPoint",
              "connectionStatus",
              "meters",
            ],
          },
          ...auditMetadata,
        },
      });

      if (mode === "SUBMIT") {
        await transaction.requestReview.create({
          data: {
            requestId: id,
            reviewerId: auth.user.id,
            action: "SUBMIT_INFORMATION",
            fromStatus: requestRecord.status,
            toStatus: requestRecord.status,
            notes: "آمادگی بهره‌برداری نیروگاه برای بررسی فنی اعلام شد.",
          },
        });
        const recipients = await transaction.user.findMany({
          where: {
            active: true,
            role: { in: ["ADMIN", "STAFF_SUPPLY", "STAFF_TECHNICAL"] },
          },
          select: { id: true },
        });
        if (recipients.length > 0) {
          await transaction.notification.createMany({
            data: recipients.map(({ id: userId }) => ({
              userId,
              title: `اعلام آمادگی بهره‌برداری ${asset.name}`,
              message: "فروشنده اطلاعات عملیاتی و کنتور را تکمیل کرده است؛ مدارک و آمادگی نیروگاه را بررسی کنید.",
              type: "ALERT" as const,
              link: `/admin/assets/${asset.id}`,
            })),
          });
        }
      }

      return transaction.asset.findUnique({
        where: { id: asset.id },
        include: { meters: true },
      });
    });

    return apiJson(result);
  } catch (error) {
    return handleRouteError(request, error, "submit operational readiness");
  }
}
