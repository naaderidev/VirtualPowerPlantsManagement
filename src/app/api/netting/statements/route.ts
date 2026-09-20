import { apiJson } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { CUSTOMER_ROLES, NETTING_READ_ROLES, isCustomerUser } from "@/lib/access-control";
import { paginationSchema } from "@/lib/api-schemas";
import { handleRouteError, parseSearchParams } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser([...NETTING_READ_ROLES, ...CUSTOMER_ROLES]);
    if (!auth.ok) return auth.response;
    const query = parseSearchParams(request, paginationSchema);
    if (!query.ok) return query.response;
    if (isCustomerUser(auth.user) && auth.user.accessiblePartyIds.length === 0) {
      return apiJson([]);
    }
    const statements = await prisma.nettingStatement.findMany({
      where: isCustomerUser(auth.user)
        ? { partyId: { in: auth.user.accessiblePartyIds } }
        : {},
      include: {
        party: { select: { id: true, displayName: true } },
        batch: {
          include: {
            group: { select: { id: true, name: true, code: true } },
            approvals: {
              include: { reviewer: { select: { id: true, name: true, role: true } } },
              orderBy: { decidedAt: "asc" },
            },
            items: {
              include: {
                settlement: {
                  include: {
                    asset: { select: { id: true, name: true } },
                    contract: { select: { id: true, contractNumber: true } },
                    schedule: {
                      include: { pricingPlan: { select: { id: true, name: true, model: true, currency: true } } },
                    },
                  },
                },
              },
            },
          },
        },
        allocations: {
          include: {
            payment: {
              select: { id: true, paymentNumber: true, paymentDate: true, status: true, reference: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.data.page - 1) * query.data.limit,
      take: query.data.limit,
    });
    return apiJson(statements);
  } catch (error) {
    return handleRouteError(request, error, "fetch netting statements");
  }
}
