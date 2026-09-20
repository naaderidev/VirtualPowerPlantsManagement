import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  METER_READING_ROLES,
  TECHNICAL_ROLES,
  canAccessParty,
} from "@/lib/access-control";
import { forbiddenResponse, requireApiUser } from "@/lib/server-auth";
import { updateMeterReadingSchema } from "@/lib/api-schemas";
import { BusinessRuleError, apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { canTransitionReading } from "@/domain/metering/workflow";
import { getAuditMetadata } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser([...METER_READING_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const reading = await prisma.meterReading.findUnique({
      where: { id },
      include: {
        asset: true,
        meter: true,
        settlements: true,
        settlementReadings: true,
      },
    });

    if (!reading) {
      return apiError(404, "NOT_FOUND", "قرائت پیدا نشد.", { request });
    }

    if (!canAccessParty(auth.user, reading.asset.ownerId)) {
      return forbiddenResponse();
    }

    return apiJson(reading);
  } catch (error) {
    return handleRouteError(request, error, "fetch meter reading");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(TECHNICAL_ROLES);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const parsed = await parseJsonBody(request, updateMeterReadingSchema);
    if (!parsed.ok) return parsed.response;
    const {
      acceptedEnergy,
      rejectedEnergy,
      rejectionReason,
      status,
    } = parsed.data;

    const existing = await prisma.meterReading.findUnique({
      where: { id },
      include: { settlementReadings: { select: { settlementId: true } } },
    });
    if (!existing) throw new BusinessRuleError("قرائت پیدا نشد.", "NOT_FOUND", 404);

    if (existing.settlementReadings.length > 0) throw new BusinessRuleError("قرائت استفاده‌شده در تسویه قابل ویرایش نیست؛ نسخه اصلاحی تسویه ایجاد کنید.", "CONFLICT", 409);
    if (status && !canTransitionReading(existing.status, status)) throw new BusinessRuleError("تغییر وضعیت قرائت در گردش‌کار مجاز نیست.");
    const finalAccepted = status === "REJECTED" ? 0 : acceptedEnergy ?? existing.acceptedEnergy ?? (status === "ACCEPTED" ? existing.rawEnergy : 0);
    const finalRejected = status === "REJECTED" ? existing.rawEnergy : rejectedEnergy ?? existing.rejectedEnergy ?? Math.max(0, existing.rawEnergy - finalAccepted);
    if (finalAccepted + finalRejected > existing.rawEnergy) {
      throw new BusinessRuleError("مجموع انرژی پذیرفته و ردشده از انرژی خام بیشتر است.", "VALIDATION_ERROR", 422, {
        acceptedEnergy: ["مجموع انرژی پذیرفته و ردشده نمی‌تواند از انرژی خام بیشتر باشد."],
      });
    }

    if (status === "ACCEPTED" && finalAccepted <= 0) throw new BusinessRuleError("برای پذیرش قرائت، انرژی پذیرفته‌شده باید مثبت باشد.");
    const audit = getAuditMetadata(request, parsed.correlationId);
    const reading = await prisma.$transaction(async (transaction) => {
      const changed = await transaction.meterReading.updateMany({ where: { id, status: existing.status }, data: {
        ...(acceptedEnergy !== undefined && { acceptedEnergy }),
        ...(rejectedEnergy !== undefined && { rejectedEnergy }),
        ...(rejectionReason !== undefined && { rejectionReason }),
        ...(status && { status }),
        ...(status === "ACCEPTED" && { acceptedEnergy: finalAccepted, rejectedEnergy: finalRejected, rejectionReason: finalRejected > 0 ? rejectionReason : null }),
        ...(status === "REJECTED" && { acceptedEnergy: 0, rejectedEnergy: existing.rawEnergy }),
        ...(status && status !== "RAW" && { validatedBy: auth.user.id }),
      } });
      if (changed.count !== 1) throw new BusinessRuleError("قرائت هم‌زمان تغییر کرده است.", "CONFLICT", 409);
      await transaction.auditLog.create({ data: { entityType: "MeterReading", entityId: id, action: status ? "STATUS_CHANGE" : "UPDATE", userId: auth.user.id, changes: { before: { status: existing.status, acceptedEnergy: existing.acceptedEnergy, rejectedEnergy: existing.rejectedEnergy }, after: { status: status ?? existing.status, acceptedEnergy: finalAccepted, rejectedEnergy: finalRejected, rejectionReason } }, ...audit } });
      return transaction.meterReading.findUnique({ where: { id }, include: { asset: true, meter: true } });
    });

    return apiJson(reading);
  } catch (error) {
    return handleRouteError(request, error, "update meter reading");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const existing = await prisma.meterReading.findUnique({
      where: { id },
      select: { settlementReadings: { select: { settlementId: true } } },
    });
    if (!existing) throw new BusinessRuleError("قرائت پیدا نشد.", "NOT_FOUND", 404);
    if (existing.settlementReadings.length > 0) {
      throw new BusinessRuleError("قرائت استفاده‌شده در تسویه قابل حذف نیست.", "CONFLICT", 409);
    }
    await prisma.meterReading.delete({
      where: { id },
    });

    return apiJson({ message: "قرائت حذف شد" });
  } catch (error) {
    return handleRouteError(request, error, "delete meter reading");
  }
}
