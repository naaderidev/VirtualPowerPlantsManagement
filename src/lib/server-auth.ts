import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACTING_PARTY_COOKIE,
  parseActingPartySelection,
  resolveActingPartyId,
  type ActingPartyOption,
} from "@/domain/parties";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { type AppRole, hasAnyRole, isAppRole } from "@/lib/access-control";
import { apiError } from "@/lib/api-response";

export type AuthenticatedUser = {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: AppRole;
  partyId: string | null;
  accessiblePartyIds: string[];
  authorizedSignatoryPartyIds: string[];
  representedParties: Array<{ id: string; displayName: string }>;
  actingPartyOptions: ActingPartyOption[];
  actingPartyId: string | null;
  loginSessionId: string;
};

type AuthorizedResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; response: NextResponse };

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) return null;

  const user = await prisma.user.findFirst({
    where: { id: userId, active: true },
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      role: true,
      partyId: true,
      party: { select: { id: true, displayName: true } },
    },
  });

  if (!user || !isAppRole(user.role)) return null;

  if (user.role === "CUSTOMER_REPRESENTATIVE" && user.partyId && user.party) {
    const now = new Date();
    const relationships = await prisma.relationship.findMany({
      where: {
        fromEntityId: user.partyId,
        type: { in: ["REPRESENTATIVE", "AUTHORIZED_SIGNATORY"] },
        active: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
        toEntity: { status: "ACTIVE" },
      },
      select: {
        toEntityId: true,
        type: true,
        toEntity: { select: { id: true, displayName: true } },
      },
    });
    const representedParties = [
      ...new Map(
        relationships
          .filter(({ type }) => type === "REPRESENTATIVE")
          .map(({ toEntity }) => [toEntity.id, toEntity])
      ).values(),
    ];
    const loginSessionId = session.user.loginSessionId;
    const selectedPartyId = parseActingPartySelection(
      (await cookies()).get(ACTING_PARTY_COOKIE)?.value ?? null,
      loginSessionId
    );
    const actingPartyId = resolveActingPartyId(
      "CUSTOMER_REPRESENTATIVE",
      user.partyId,
      representedParties.map(({ id }) => id),
      selectedPartyId
    );
    const actingPartyOptions: ActingPartyOption[] = [
      { id: user.party.id, displayName: user.party.displayName, kind: "PERSONAL" },
      ...representedParties.map((party) => ({ ...party, kind: "REPRESENTED" as const })),
    ];
    const authorizedSignatoryPartyIds = [
      ...new Set([
        user.partyId,
        ...relationships
          .filter(({ type }) => type === "AUTHORIZED_SIGNATORY")
          .map(({ toEntityId }) => toEntityId),
      ]),
    ];

    return {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      partyId: user.partyId,
      representedParties,
      actingPartyOptions,
      actingPartyId,
      accessiblePartyIds: actingPartyId ? [actingPartyId] : [],
      authorizedSignatoryPartyIds,
      loginSessionId,
    };
  }

  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    email: user.email,
    role: user.role,
    partyId: user.partyId,
    accessiblePartyIds: user.partyId ? [user.partyId] : [],
    authorizedSignatoryPartyIds: user.partyId ? [user.partyId] : [],
    representedParties: user.party ? [user.party] : [],
    actingPartyOptions: user.party
      ? [{ id: user.party.id, displayName: user.party.displayName, kind: "PERSONAL" }]
      : [],
    actingPartyId: resolveActingPartyId(
      user.role === "CUSTOMER" ? "CUSTOMER" : "INTERNAL",
      user.partyId,
      [],
      null
    ),
    loginSessionId: session.user.loginSessionId,
  };
}

export async function requireApiUser(
  allowedRoles?: readonly AppRole[]
): Promise<AuthorizedResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      ok: false,
      response: apiError(401, "UNAUTHORIZED", "برای ادامه باید وارد حساب کاربری شوید."),
    };
  }

  if (allowedRoles && !hasAnyRole(user, allowedRoles)) {
    return {
      ok: false,
      response: apiError(403, "FORBIDDEN", "اجازه انجام این عملیات را ندارید."),
    };
  }

  return { ok: true, user };
}

export function forbiddenResponse(): NextResponse {
  return apiError(403, "FORBIDDEN", "اجازه انجام این عملیات را ندارید.");
}

export function notFoundResponse(resource = "Resource"): NextResponse {
  return apiError(404, "NOT_FOUND", `${resource} پیدا نشد.`);
}
