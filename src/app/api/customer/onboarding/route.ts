import { apiJson } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { customerOnboardingSchema } from "@/lib/api-schemas";
import { BusinessRuleError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(["CUSTOMER", "CUSTOMER_REPRESENTATIVE"]);
    if (!auth.ok) return auth.response;

    return apiJson({
      ready: auth.user.representedParties.length > 0,
      partyId: auth.user.partyId,
      accessiblePartyIds: auth.user.accessiblePartyIds,
      representedParties: auth.user.representedParties,
      actingPartyId: auth.user.actingPartyId,
      requiresPartyProfile: auth.user.role === "CUSTOMER" && !auth.user.partyId,
      requiresRepresentativeAssignment:
        auth.user.role === "CUSTOMER_REPRESENTATIVE" && auth.user.representedParties.length === 0,
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch customer onboarding state");
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(["CUSTOMER"]);
    if (!auth.ok) return auth.response;
    const parsed = await parseJsonBody(request, customerOnboardingSchema);
    if (!parsed.ok) return parsed.response;
    const audit = getAuditMetadata(request, parsed.correlationId);

    const party = await prisma.$transaction(async (transaction) => {
      const currentUser = await transaction.user.findUnique({
        where: { id: auth.user.id },
        select: { partyId: true },
      });
      if (!currentUser) throw new BusinessRuleError("کاربر پیدا نشد.", "NOT_FOUND", 404);
      if (currentUser.partyId) {
        const existing = await transaction.party.findUnique({ where: { id: currentUser.partyId } });
        if (!existing) throw new BusinessRuleError("پروفایل طرف تجاری معتبر نیست.", "CONFLICT", 409);
        return existing;
      }

      const created = await transaction.party.create({ data: parsed.data });
      const linked = await transaction.user.updateMany({
        where: { id: auth.user.id, partyId: null },
        data: { partyId: created.id },
      });
      if (linked.count !== 1) {
        throw new BusinessRuleError("پروفایل هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.", "CONFLICT", 409);
      }
      await transaction.auditLog.create({
        data: {
          entityType: "Party",
          entityId: created.id,
          action: "CUSTOMER_ONBOARDING",
          userId: auth.user.id,
          changes: { type: created.type, displayName: created.displayName },
          ...audit,
        },
      });
      return created;
    });

    return apiJson(party, { status: auth.user.partyId ? 200 : 201 });
  } catch (error) {
    return handleRouteError(request, error, "complete customer onboarding");
  }
}
