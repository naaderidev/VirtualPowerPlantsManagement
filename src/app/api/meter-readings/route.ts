import { apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import {
  CUSTOMER_ROLES,
  METER_READING_ROLES,
  TECHNICAL_ROLES,
  isCustomerUser,
} from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createMeterReadingSchema, paginationSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams, requireExistingRecord } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser([...METER_READING_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    if (isCustomerUser(auth.user) && auth.user.accessiblePartyIds.length === 0) {
      return apiJson([]);
    }

    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const { page, limit } = query.data;

    const readings = await prisma.meterReading.findMany({
      where: isCustomerUser(auth.user)
        ? { asset: { ownerId: { in: auth.user.accessiblePartyIds } } }
        : undefined,
      include: {
        asset: true,
        meter: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiJson(readings);
  } catch (error) {
    return handleRouteError(request, error, "fetch meter readings");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(TECHNICAL_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createMeterReadingSchema);
    if (!parsed.ok) return parsed.response;
    const {
      assetId,
      meterId,
      periodStart,
      periodEnd,
      rawEnergy,
      rawPeak,
      rawOffPeak,
      source,
    } = parsed.data;
    if (periodEnd > new Date()) {
      throw new BusinessRuleError("پایان دورهٔ قرائت نمی‌تواند در آینده باشد.", "VALIDATION_ERROR", 422, {
        periodEnd: ["بازهٔ پایان‌یافته را انتخاب کنید."],
      });
    }

    await requireExistingRecord(
      prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } }),
      "دارایی انتخاب‌شده پیدا نشد."
    );
    if (meterId) {
      const meter = await requireExistingRecord(
        prisma.meter.findUnique({ where: { id: meterId }, select: { assetId: true } }),
        "کنتور انتخاب‌شده پیدا نشد."
      );
      if (meter.assetId !== assetId) {
        throw new BusinessRuleError("کنتور انتخاب‌شده متعلق به این دارایی نیست.", "VALIDATION_ERROR", 422, {
          meterId: ["کنتور انتخاب‌شده متعلق به این دارایی نیست."],
        });
      }
    }

    const reading = await prisma.meterReading.create({
      data: {
        assetId,
        meterId: meterId ?? null,
        periodStart,
        periodEnd,
        rawEnergy,
        rawPeak: rawPeak ?? null,
        rawOffPeak: rawOffPeak ?? null,
        acceptedEnergy: null,
        rejectedEnergy: null,
        source,
        status: "RAW",
        submittedBy: auth.user.id,
      },
      include: {
        asset: true,
        meter: true,
      },
    });

    return apiJson(reading, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(request, error, "create meter reading");
  }
}
