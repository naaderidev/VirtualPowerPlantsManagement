import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_ROLES, FINANCIAL_ROLES, isCustomerUser } from "@/lib/access-control";
import { requireApiUser } from "@/lib/server-auth";
import { paginationSchema } from "@/lib/api-schemas";
import { handleRouteError, parseSearchParams } from "@/lib/api-response";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser([...FINANCIAL_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;

    if (isCustomerUser(auth.user) && auth.user.accessiblePartyIds.length === 0) {
      return apiJson([]);
    }

    const where = isCustomerUser(auth.user)
      ? {
          contract: {
            parties: {
              some: {
                partyId: { in: auth.user.accessiblePartyIds },
              },
            },
          },
        }
      : {};

    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    const { page, limit } = query.data;

    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        contract: {
          include: {
            parties: {
              include: {
                party: true,
              },
            },
          },
        },
        asset: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiJson(settlements);
  } catch (error) {
    return handleRouteError(request, error, "fetch settlements");
  }
}
