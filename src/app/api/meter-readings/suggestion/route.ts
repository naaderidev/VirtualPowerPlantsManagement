import { apiJson, handleRouteError, parseSearchParams } from "@/lib/api-response";
import { TECHNICAL_ROLES } from "@/lib/access-control";
import { suggestReadingPeriod } from "@/domain/metering/reading-period-suggestion";
import { calendarMonthPeriod } from "@/domain/settlement/calendar-month";
import { parseApiDate, toPersianMonthKey } from "@/lib/persian-date";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";
import { z } from "zod";

const querySchema = z.object({
  assetId: z.string().min(1),
  meterId: z.string().min(1),
}).strict();

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(TECHNICAL_ROLES);
    if (!auth.ok) return auth.response;

    const parsed = parseSearchParams(request, querySchema);
    if (!parsed.ok) return parsed.response;
    const { assetId, meterId } = parsed.data;

    const meter = await prisma.meter.findUnique({
      where: { id: meterId },
      select: { assetId: true, active: true, readInterval: true },
    });
    if (!meter || meter.assetId !== assetId || !meter.active) {
      return apiJson({ suggestion: null, message: "کنتور فعال برای این نیروگاه انتخاب نشده است." });
    }

    const schedule = await prisma.commercialSchedule.findFirst({
      where: { assetId, active: true, contract: { status: { in: ["ACTIVE", "TERMINATION_PENDING", "TERMINATED"] } } },
      select: {
        startDate: true,
        endDate: true,
        contract: { select: { contractNumber: true, effectiveDate: true, expirationDate: true, terminationDate: true } },
      },
      orderBy: { startDate: "desc" },
    });
    if (!schedule) {
      return apiJson({ suggestion: null, message: "برای این نیروگاه برنامهٔ تجاری در قرارداد فعال یافت نشد؛ بازه را دستی تعیین کنید." });
    }

    const lastReading = await prisma.meterReading.findFirst({
      where: { assetId, status: { not: "REJECTED" } },
      select: { periodEnd: true },
      orderBy: { periodEnd: "desc" },
    });
    const scheduleStart = new Date(Math.max(schedule.startDate.getTime(), schedule.contract.effectiveDate.getTime()));
    const scheduleEnd = new Date(Math.min(
      schedule.endDate.getTime(),
      schedule.contract.expirationDate?.getTime() ?? Infinity,
      schedule.contract.terminationDate?.getTime() ?? Infinity,
    ));
    const suggestion = suggestReadingPeriod({
      scheduleStart,
      scheduleEnd,
      lastReadingEnd: lastReading?.periodEnd ?? null,
      interval: meter.readInterval,
      now: new Date(),
    });
    const nextMonth = suggestion && meter.readInterval === "MONTHLY" && !suggestion.fullSettlementMonth && suggestion.periodEnd.endsWith("/01")
      ? calendarMonthPeriod(toPersianMonthKey(parseApiDate(suggestion.periodEnd)!))
      : null;
    const firstFullSettlementMonth = nextMonth && parseApiDate(nextMonth.periodEnd)! <= scheduleEnd
      ? nextMonth
      : null;

    return apiJson({
      suggestion,
      firstFullSettlementMonth,
      contractNumber: schedule.contract.contractNumber,
      interval: meter.readInterval,
      message: suggestion
        ? null
        : "بازهٔ کامل دیگری در محدودهٔ برنامهٔ تجاری وجود ندارد؛ تاریخ قرارداد و قرائت‌های قبلی را بررسی کنید.",
    });
  } catch (error) {
    return handleRouteError(request, error, "suggest meter reading period");
  }
}
