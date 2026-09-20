import { apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { TECHNICAL_ROLES } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { createMeterSchema, paginationSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody, parseSearchParams, requireExistingRecord } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(TECHNICAL_ROLES);
    if (!auth.ok) return auth.response;

    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const { page, limit } = query.data;

    const meters = await prisma.meter.findMany({
      include: {
        asset: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiJson(meters);
  } catch (error) {
    return handleRouteError(request, error, "fetch meters");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(TECHNICAL_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, createMeterSchema);
    if (!parsed.ok) return parsed.response;
    const { assetId, type, serialNumber, manufacturer, model, readInterval, dataSource, installDate } = parsed.data;
    if (installDate && installDate > new Date()) {
      throw new BusinessRuleError("تاریخ نصب واقعی کنتور نمی‌تواند در آینده باشد.", "VALIDATION_ERROR", 422, {
        installDate: ["تاریخ نصب انجام‌شده را انتخاب کنید."],
      });
    }

    await requireExistingRecord(
      prisma.asset.findUnique({ where: { id: assetId }, select: { id: true } }),
      "دارایی انتخاب‌شده پیدا نشد."
    );

    const meter = await prisma.meter.create({
      data: {
        assetId,
        type,
        serialNumber,
        manufacturer: manufacturer ?? null,
        model: model ?? null,
        readInterval,
        dataSource,
        installDate: installDate ?? null,
        active: true,
      },
      include: {
        asset: true,
      },
    });

    return apiJson(meter, { status: 201 });
  } catch (error: unknown) {
    return handleRouteError(request, error, "create meter");
  }
}
