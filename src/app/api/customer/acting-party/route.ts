import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { ACTING_PARTY_COOKIE, serializeActingPartySelection } from "@/domain/parties";
import { selectActingPartySchema } from "@/lib/api-schemas";
import { apiError, handleRouteError, parseJsonBody } from "@/lib/api-response";
import { getAuditMetadata } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12,
};

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser(["CUSTOMER", "CUSTOMER_REPRESENTATIVE"]);
    if (!auth.ok) return auth.response;

    return apiJson({
      actingPartyId: auth.user.actingPartyId,
      parties: auth.user.actingPartyOptions,
      requiresSelection:
        auth.user.role === "CUSTOMER_REPRESENTATIVE" &&
        auth.user.actingPartyOptions.length > 0 &&
        !auth.user.actingPartyId,
    });
  } catch (error) {
    return handleRouteError(request, error, "fetch acting party context");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(["CUSTOMER_REPRESENTATIVE"]);
    if (!auth.ok) return auth.response;

    const parsed = await parseJsonBody(request, selectActingPartySchema);
    if (!parsed.ok) return parsed.response;
    const selectedParty = auth.user.actingPartyOptions.find(
      ({ id }) => id === parsed.data.actingPartyId
    );
    if (!selectedParty) {
      return apiError(403, "FORBIDDEN", "طرف فعالیت انتخاب‌شده در محدوده دسترسی شما نیست.", {
        correlationId: parsed.correlationId,
      });
    }

    if (auth.user.actingPartyId !== selectedParty.id) {
      await prisma.auditLog.create({
        data: {
          entityType: "User",
          entityId: auth.user.id,
          action: "SELECT_ACTING_PARTY",
          userId: auth.user.id,
          changes: {
            previousPartyId: auth.user.actingPartyId,
            actingPartyId: selectedParty.id,
          },
          ...getAuditMetadata(request, parsed.correlationId),
        },
      });
    }

    const response = apiJson({
      actingParty: selectedParty,
      correlationId: parsed.correlationId,
    });
    response.cookies.set(
      ACTING_PARTY_COOKIE,
      serializeActingPartySelection(auth.user.loginSessionId, selectedParty.id),
      cookieOptions
    );
    return response;
  } catch (error) {
    return handleRouteError(request, error, "select acting party context");
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiUser(["CUSTOMER_REPRESENTATIVE"]);
    if (!auth.ok) return auth.response;

    const response = apiJson({ actingPartyId: null });
    response.cookies.set(ACTING_PARTY_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return handleRouteError(request, error, "clear acting party context");
  }
}
