import type { Prisma } from "@prisma/client";
import { CUSTOMER_ROLES } from "@/lib/access-control";
import type { AuthenticatedUser } from "@/lib/server-auth";

type NotificationIdentity = Pick<AuthenticatedUser, "id" | "role" | "actingPartyId">;

export function notificationScopeFor(user: NotificationIdentity): Prisma.NotificationWhereInput | null {
  if (!CUSTOMER_ROLES.includes(user.role as (typeof CUSTOMER_ROLES)[number])) {
    return { userId: user.id };
  }

  if (!user.actingPartyId) return null;
  return { userId: user.id, partyId: user.actingPartyId };
}
