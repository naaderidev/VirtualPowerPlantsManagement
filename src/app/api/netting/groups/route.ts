import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { getAuditMetadata } from "@/lib/audit";
import { NETTING_READ_ROLES } from "@/lib/access-control";
import { createNettingGroupSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { isNettingEnabled } from "@/lib/netting-feature";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const groupInclude = {
  party: { select: { id: true, displayName: true, type: true, status: true } },
  contracts: {
    select: {
      id: true,
      contractNumber: true,
      status: true,
      assets: { select: { assetId: true, asset: { select: { name: true } } } },
    },
  },
  _count: { select: { batches: true } },
} as const;

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(NETTING_READ_ROLES);
    if (!auth.ok) return auth.response;
    const groups = await prisma.nettingGroup.findMany({
      include: groupInclude,
      orderBy: { createdAt: "desc" },
    });
    return apiJson({ enabled: isNettingEnabled(), groups });
  } catch (error) {
    return handleRouteError(request, error, "fetch netting groups");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(["ADMIN"]);
    if (!auth.ok) return auth.response;
    if (!isNettingEnabled()) {
      throw new BusinessRuleError("قابلیت خالص‌سازی در این محیط فعال نیست.", "CONFLICT", 409);
    }
    const parsed = await parseJsonBody(request, createNettingGroupSchema);
    if (!parsed.ok) return parsed.response;
    const { name, code, contractId, legalBasis } = parsed.data;
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        parties: { include: { party: true } },
        assets: true,
        schedules: { include: { pricingPlan: { select: { currency: true } } } },
      },
    });
    if (!contract) throw new BusinessRuleError("قرارداد پیدا نشد.", "NOT_FOUND", 404);
    if (contract.status !== "ACTIVE" && contract.status !== "TERMINATION_PENDING") {
      throw new BusinessRuleError("گروه خالص‌سازی فقط برای قرارداد فعال قابل ایجاد است.");
    }
    if (contract.nettingGroupId) {
      throw new BusinessRuleError("این قرارداد قبلاً به یک گروه خالص‌سازی متصل شده است.", "CONFLICT", 409);
    }
    if (!contract.nettingEnabled || contract.schedules.some(({ nettingEnabled }) => !nettingEnabled)) {
      throw new BusinessRuleError("خالص‌سازی باید در قرارداد و تمام برنامه‌های تجاری آن فعال باشد.");
    }
    if (contract.assets.length < 2 || contract.schedules.length !== contract.assets.length) {
      throw new BusinessRuleError("قرارداد باید حداقل دو نیروگاه با برنامه‌های تجاری مستقل داشته باشد.");
    }
    const sellers = contract.parties.filter(({ role, isPrimary }) => role === "SELLER" && isPrimary);
    if (sellers.length !== 1) throw new BusinessRuleError("فروشنده اصلی قرارداد به‌صورت یکتا مشخص نیست.");
    const [seller] = sellers;
    if (seller.party.type !== "COMPANY" || seller.party.status !== "ACTIVE") {
      throw new BusinessRuleError("فروشنده قرارداد باید یک شرکت فعال باشد.");
    }
    const currencies = new Set(contract.schedules.map(({ pricingPlan }) => pricingPlan.currency));
    if (currencies.size !== 1) {
      throw new BusinessRuleError("ارز تمام برنامه‌های تجاری قرارداد باید یکسان باشد.");
    }
    const currency = [...currencies][0];
    const audit = getAuditMetadata(request, parsed.correlationId);
    const group = await prisma.$transaction(async (transaction) => {
      const created = await transaction.nettingGroup.create({
        data: {
          name,
          code,
          partyId: seller.partyId,
          mode: "MANUAL",
          type: "FINANCIAL",
          currency,
          legalBasis,
          validFrom: contract.effectiveDate,
          validTo: contract.expirationDate,
          createdBy: auth.user.id,
          contracts: { connect: { id: contractId } },
        },
        include: groupInclude,
      });
      await transaction.auditLog.create({
        data: {
          entityType: "NettingGroup",
          entityId: created.id,
          action: "CREATE",
          userId: auth.user.id,
          changes: { contractId, partyId: seller.partyId, currency, mode: "MANUAL" },
          ...audit,
        },
      });
      return created;
    });
    return apiJson(group, { status: 201 });
  } catch (error) {
    return handleRouteError(request, error, "create netting group");
  }
}
